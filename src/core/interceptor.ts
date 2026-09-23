import { MODULE_ID, FLAGS, SETTINGS } from '../constants';
import { contextManager } from './context-manager';
import { PPDiceResolver, ResolutionResult } from '../ui/pp-dice-resolver';
import { FoundryDiceTerm, FoundryRoll } from '../types/foundry';

// Sequential promise queue to prevent overlapping dialogs during AoE / multi-target checks
let queueChain: Promise<void> = Promise.resolve();

export function extractDiceTerms(terms: any[]): FoundryDiceTerm[] {
  const diceTerms: FoundryDiceTerm[] = [];

  function traverse(list: any[]) {
    if (!Array.isArray(list)) return;
    for (const term of list) {
      if (term && typeof term.faces === 'number' && term.faces > 0) {
        diceTerms.push(term);
      }
      if (term?.dice && Array.isArray(term.dice)) {
        traverse(term.dice);
      }
      if (term?.terms && Array.isArray(term.terms)) {
        traverse(term.terms);
      }
    }
  }

  traverse(terms);
  return diceTerms;
}

export async function interceptRollEvaluation(
  roll: FoundryRoll,
  wrapped: (opts?: any) => Promise<any>,
  options: Record<string, any> = {}
): Promise<any> {
  const { intercept, context } = contextManager.shouldIntercept(roll, options);

  // If not eligible (e.g. NPC or secret roll), evaluate normally with native RNG
  if (!intercept) {
    return wrapped(options);
  }

  const diceTerms = extractDiceTerms(roll.terms);
  if (diceTerms.length === 0) {
    return wrapped(options);
  }

  // Queue physical dialog sequentially
  const currentTask = queueChain;
  let finishTask: () => void = () => {};
  queueChain = new Promise<void>((resolve) => {
    finishTask = resolve;
  });

  await currentTask;

  try {
    let resolution: ResolutionResult;
    try {
      const resolver = new PPDiceResolver(roll, context, diceTerms);
      resolution = await resolver.awaitInput();
    } catch (err) {
      console.error(`[${MODULE_ID}] Error during physical roll interception:`, err);
      // On resolver error, fall back to digital roll rather than breaking the game
      return await wrapped(options);
    }

    if (resolution.isDigital || !resolution.values) {
      // GM selected digital roll fallback
      return await wrapped(options);
    }

    // Inject physical values into DiceTerms
    applyPhysicalResults(diceTerms, resolution.values);

    // Tag roll as physical
    roll.options = roll.options || {};
    roll.options[FLAGS.PHYSICAL_ROLL] = true;

    // Check DSN 3D dice animation setting
    const game = (globalThis as any).game;
    const animateDSN = game?.settings?.get(MODULE_ID, SETTINGS.ANIMATE_DSN) ?? true;
    if (!animateDSN) {
      options.skip3d = true;
      (roll as any).ghost = true;
    }

    // Call wrapped with allowInteractive: false so core resolver doesn't trigger,
    // and AST evaluation computes the final total and modifiers
    return await wrapped({ ...options, allowInteractive: false });
  } finally {
    finishTask();
  }
}

export function applyPhysicalResults(
  diceTerms: FoundryDiceTerm[],
  valuesMap: Map<FoundryDiceTerm, number[]> | Record<string, number[]>
): void {
  for (const term of diceTerms) {
    const values =
      valuesMap instanceof Map
        ? valuesMap.get(term)
        : (valuesMap as Record<string, number[]>)[term.id ?? term.denomination ?? ''];

    if (Array.isArray(values) && values.length > 0) {
      term.results = values.map((val) => ({
        result: Number(val),
        active: true,
      }));
    }
  }
}

export function registerInterception(): void {
  const libWrapper = (globalThis as any).libWrapper;

  if (libWrapper) {
    libWrapper.register(
      MODULE_ID,
      'Roll.prototype._evaluate',
      async function (this: FoundryRoll, wrapped: any, options: Record<string, any> = {}) {
        return interceptRollEvaluation(this, wrapped, options);
      },
      'MIXED'
    );
    console.log(`[${MODULE_ID}] Registered Roll._evaluate with libWrapper.`);
  } else {
    const RollClass = (globalThis as any).Roll;
    if (RollClass?.prototype) {
      const originalEvaluate = RollClass.prototype._evaluate;
      RollClass.prototype._evaluate = async function (
        this: FoundryRoll,
        options: Record<string, any> = {}
      ) {
        return interceptRollEvaluation(this, originalEvaluate.bind(this), options);
      };
      console.log(
        `[${MODULE_ID}] Registered Roll._evaluate via monkey-patch (libWrapper recommended).`
      );
    }
  }
}
