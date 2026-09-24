import { MODULE_ID, FLAGS } from '../constants';
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
  // Skip sub-rolls evaluated as part of a parent roll (M4)
  if ((roll as any)._root && (roll as any)._root !== roll) {
    return wrapped(options);
  }

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
      term.results = values.map((val) => {
        const num = Math.min(Math.max(1, Math.floor(Number(val))), term.faces);
        return {
          result: num,
          active: true,
        };
      });
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

let activeCheckContext: any = null;

export function getPf2eActiveCheckContext(): any {
  return activeCheckContext;
}

export function setPf2eActiveCheckContext(context: any): void {
  activeCheckContext = context;
}

export function clearPf2eActiveCheckContext(): void {
  activeCheckContext = null;
}

export function registerInitiativeInterception(): void {
  const libWrapper = (globalThis as any).libWrapper;
  const CombatantClass =
    (globalThis as any).CONFIG?.Combatant?.documentClass ?? (globalThis as any).Combatant;

  if (CombatantClass?.prototype?.getInitiativeRoll) {
    if (libWrapper) {
      try {
        libWrapper.register(
          MODULE_ID,
          'Combatant.prototype.getInitiativeRoll',
          function (this: any, wrapped: any, ...args: any[]) {
            const roll = wrapped(...args);
            if (roll) {
              (roll as any)._actor = this.actor;
              (roll as any)._combatant = this;
              roll.options = roll.options || {};
              roll.options.type = 'initiative';
              roll.options.initiative = true;
            }
            return roll;
          },
          'WRAPPER'
        );
      } catch {
        // Ignored if already registered
      }
    } else {
      if (!(CombatantClass.prototype.getInitiativeRoll as any)?._ppDiceWrapped) {
        const originalGetInitiativeRoll = CombatantClass.prototype.getInitiativeRoll;
        const wrappedGetInitiativeRoll = function (this: any, ...args: any[]) {
          const roll = originalGetInitiativeRoll.apply(this, args);
          if (roll) {
            (roll as any)._actor = this.actor;
            (roll as any)._combatant = this;
            roll.options = roll.options || {};
            roll.options.type = 'initiative';
            roll.options.initiative = true;
          }
          return roll;
        };
        (wrappedGetInitiativeRoll as any)._ppDiceWrapped = true;
        CombatantClass.prototype.getInitiativeRoll = wrappedGetInitiativeRoll;
      }
    }
  }

  const checkCls = (globalThis as any).game?.pf2e?.Check ?? (globalThis as any).game?.sf2e?.Check;
  if (checkCls?.roll) {
    if (libWrapper) {
      try {
        libWrapper.register(
          MODULE_ID,
          `${(globalThis as any).game?.pf2e?.Check?.roll ? 'game.pf2e' : 'game.sf2e'}.Check.roll`,
          async function (
            wrapped: any,
            check: any,
            context: any = {},
            event: any = null,
            callback: any = null
          ) {
            if (context?.actor && !context.identifier && context.actor.uuid) {
              context.identifier = context.actor.uuid;
            }
            setPf2eActiveCheckContext(context);
            try {
              return await wrapped(check, context, event, callback);
            } finally {
              clearPf2eActiveCheckContext();
            }
          },
          'WRAPPER'
        );
      } catch {
        // Ignored if already registered
      }
    } else {
      if (!(checkCls.roll as any)?._ppDiceWrapped) {
        const originalCheckRoll = checkCls.roll;
        const wrappedCheckRoll = async function (
          this: any,
          check: any,
          context: any = {},
          event: any = null,
          callback: any = null
        ) {
          if (context?.actor && !context.identifier && context.actor.uuid) {
            context.identifier = context.actor.uuid;
          }
          setPf2eActiveCheckContext(context);
          try {
            return await originalCheckRoll.call(this, check, context, event, callback);
          } finally {
            clearPf2eActiveCheckContext();
          }
        };
        (wrappedCheckRoll as any)._ppDiceWrapped = true;
        checkCls.roll = wrappedCheckRoll;
      }
    }
  }
}
