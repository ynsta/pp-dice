import { MODULE_ID } from '../constants';
import { RollEvaluationContext } from '../providers/base';
import { FoundryDiceTerm, FoundryRoll } from '../types/foundry';

export interface ResolutionResult {
  isDigital: boolean;
  values?: Map<FoundryDiceTerm, number[]>;
}

export interface DiceGroup {
  termIndex: number;
  denomination: string;
  count: number;
  dice: Array<{
    name: string;
    label: string;
    faces: number;
    min: number;
    max: number;
  }>;
}

export class PPDiceResolver {
  public readonly roll: FoundryRoll;
  public readonly context: RollEvaluationContext;
  public readonly diceTerms: FoundryDiceTerm[];
  private resolvePromise?: (result: ResolutionResult) => void;

  constructor(roll: FoundryRoll, context: RollEvaluationContext, diceTerms: FoundryDiceTerm[]) {
    this.roll = roll;
    this.context = context;
    this.diceTerms = diceTerms;
  }

  async awaitInput(): Promise<ResolutionResult> {
    return new Promise<ResolutionResult>((resolve) => {
      this.resolvePromise = resolve;
      this.renderDialog();
    });
  }

  private renderDialog(): void {
    const foundryGlobal = (globalThis as unknown as { foundry?: any }).foundry;
    const foundryApp = foundryGlobal?.applications;

    if (foundryApp?.api?.ApplicationV2) {
      const app = new PPDiceResolverApp(this);
      app.render({ force: true });
    } else {
      // Fallback for headless / test environment
      this.submitDigital();
    }
  }

  prepareDiceGroups(): DiceGroup[] {
    return this.diceTerms.map((term, tIdx) => {
      const faces = term.faces;
      const count = term.number ?? 1;
      const denomination = `d${faces}`;
      const dice = [];

      for (let dIdx = 0; dIdx < count; dIdx++) {
        dice.push({
          name: `die_${tIdx}_${dIdx}`,
          label: `${denomination} #${dIdx + 1}`,
          faces,
          min: 1,
          max: faces,
        });
      }

      return {
        termIndex: tIdx,
        denomination,
        count,
        dice,
      };
    });
  }

  submitPhysical(values: Map<FoundryDiceTerm, number[]>): void {
    if (this.resolvePromise) {
      const cb = this.resolvePromise;
      this.resolvePromise = undefined;
      cb({ isDigital: false, values });
    }
  }

  submitDigital(): void {
    if (this.resolvePromise) {
      const cb = this.resolvePromise;
      this.resolvePromise = undefined;
      cb({ isDigital: true });
    }
  }
}

// Concrete ApplicationV2 class
function createResolverAppClass() {
  const foundryGlobal = (globalThis as unknown as { foundry?: any }).foundry;
  if (!foundryGlobal?.applications?.api?.ApplicationV2) {
    return class DummyApp {};
  }

  const { ApplicationV2, HandlebarsApplicationMixin } = foundryGlobal.applications.api;

  return class extends HandlebarsApplicationMixin(ApplicationV2) {
    private resolver: PPDiceResolver;

    constructor(resolver: PPDiceResolver, options: Record<string, unknown> = {}) {
      super(options);
      this.resolver = resolver;
    }

    static DEFAULT_OPTIONS = {
      id: 'pp-dice-resolver',
      classes: ['pp-dice-window'],
      tag: 'form',
      window: {
        title: 'PP_DICE.ResolverTitle',
        icon: 'fa-solid fa-dice-d20',
        resizable: false,
      },
      position: {
        width: 440,
        height: 'auto',
      },
    };

    static PARTS = {
      main: {
        template: `modules/${MODULE_ID}/templates/dice-resolver.hbs`,
      },
    };

    async _prepareContext() {
      return {
        title: this.resolver.context.title || 'Roll',
        actor: this.resolver.context.actor,
        formula: this.resolver.roll.formula,
        groups: this.resolver.prepareDiceGroups(),
        isPF2e: this.resolver.context.sourceSystem === 'pf2e',
      };
    }

    _onRender(context: unknown, options: unknown) {
      super._onRender(context, options);

      const html = this.element;
      const firstInput = html.querySelector('input.die-input') as HTMLInputElement | null;
      if (firstInput) {
        firstInput.focus();
        firstInput.select();
      }

      html.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.code === 'Space' && (e.target as HTMLElement)?.tagName !== 'INPUT') {
          e.preventDefault();
          this.resolver.submitDigital();
          this.close();
        }
      });

      const digitalBtn = html.querySelector('.btn-digital');
      digitalBtn?.addEventListener('click', (e: Event) => {
        e.preventDefault();
        this.resolver.submitDigital();
        this.close();
      });

      html.addEventListener('submit', (e: Event) => {
        e.preventDefault();
        const formData = new FormData(html as HTMLFormElement);
        const valuesMap = new Map<FoundryDiceTerm, number[]>();

        for (let tIdx = 0; tIdx < this.resolver.diceTerms.length; tIdx++) {
          const term = this.resolver.diceTerms[tIdx];
          if (!term) continue;
          const count = term.number ?? 1;
          const values: number[] = [];

          for (let dIdx = 0; dIdx < count; dIdx++) {
            const raw = formData.get(`die_${tIdx}_${dIdx}`);
            const num = Number(raw);
            if (!isNaN(num) && num > 0) {
              values.push(num);
            } else {
              values.push(
                term.randomFace ? term.randomFace() : Math.floor(Math.random() * term.faces) + 1
              );
            }
          }
          valuesMap.set(term, values);
        }

        this.resolver.submitPhysical(valuesMap);
        this.close();
      });
    }

    async close(options?: unknown) {
      this.resolver.submitDigital();
      return super.close(options);
    }
  };
}

export const PPDiceResolverApp = createResolverAppClass() as any;
