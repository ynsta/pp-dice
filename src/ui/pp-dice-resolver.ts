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
      try {
        const app = new PPDiceResolverApp(this);
        const renderPromise = app.render({ force: true });
        if (renderPromise && typeof renderPromise.catch === 'function') {
          renderPromise.catch((err: unknown) => {
            console.error(`[${MODULE_ID}] Failed to render resolver dialog:`, err);
            this.submitDigital();
          });
        }
      } catch (err) {
        console.error(`[${MODULE_ID}] Error launching resolver dialog:`, err);
        this.submitDigital();
      }
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

// Concrete ApplicationV2 class or fallback base class
function getBaseApplicationClass(): any {
  const foundryGlobal = (globalThis as unknown as { foundry?: any }).foundry;
  if (foundryGlobal?.applications?.api?.ApplicationV2) {
    return foundryGlobal.applications.api.HandlebarsApplicationMixin(
      foundryGlobal.applications.api.ApplicationV2
    );
  }
  return class BaseApplicationV2 {
    options: Record<string, unknown>;
    element: any = null;
    constructor(options: Record<string, unknown> = {}) {
      this.options = options;
    }
    _attachFrameListeners() {}
    _onRender(_context: unknown, _options: unknown) {}
    _onClose(_options: unknown) {}
    async close(_options?: unknown) {}
    async render(_options?: unknown) {
      return this;
    }
  };
}

export class PPDiceResolverApp extends getBaseApplicationClass() {
  public resolver: PPDiceResolver;
  public keyHandler?: (e: KeyboardEvent) => void;

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
      isFortune: this.resolver.context.isFortune,
      isMisfortune: this.resolver.context.isMisfortune,
    };
  }

  async render(options?: unknown) {
    const foundryApp = (globalThis as unknown as { foundry?: any }).foundry?.applications?.api
      ?.ApplicationV2;
    if (foundryApp?.prototype?.render && !(this instanceof foundryApp)) {
      return foundryApp.prototype.render.call(this, options);
    }
    return super.render(options);
  }

  _onKeyDown(e: KeyboardEvent): void {
    const target = e.target as HTMLElement | null;
    const doc = (globalThis as any).document;
    const isInsideDialog = Boolean(this.element && this.element.contains?.(target));
    const isBody = target === doc?.body || target === null;

    if (!isInsideDialog && !isBody) {
      return;
    }

    // Prevent Space from triggering Foundry global pause while resolver is active
    if (e.code === 'Space') {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    // Allow browser reload (Ctrl+R / Cmd+R)
    if (e.ctrlKey || e.altKey || e.metaKey) return;

    // Escape, 'r', 'R', or code 'KeyR' triggers instant digital roll fallback
    if (
      e.key === 'Escape' ||
      e.code === 'Escape' ||
      e.key === 'r' ||
      e.key === 'R' ||
      e.code === 'KeyR'
    ) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      this.resolver.submitDigital();
      this.close();
    }
  }

  _attachFrameListeners(): void {
    super._attachFrameListeners();

    // Clean up previous window listener if any
    if (this.keyHandler && typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.keyHandler, true);
    }

    this.keyHandler = (e: KeyboardEvent) => this._onKeyDown(e);
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.keyHandler, true);
    }

    if (this.element) {
      this.element.addEventListener('keydown', (e: KeyboardEvent) => this._onKeyDown(e));
    }
  }

  _onRender(context: unknown, options: unknown) {
    super._onRender(context, options);

    const html = this.element;
    if (!html) return;

    const firstInput = html.querySelector?.('input.die-input') as HTMLInputElement | null;
    if (firstInput) {
      firstInput.focus?.();
      firstInput.select?.();
    }

    // Attach keydown directly to each input.die-input
    const dieInputs = Array.from(
      html.querySelectorAll?.('input.die-input') ?? []
    ) as HTMLInputElement[];
    for (const input of dieInputs) {
      input.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const form = html as HTMLFormElement;
          if (typeof form.requestSubmit === 'function') {
            form.requestSubmit();
          } else {
            form.dispatchEvent(new Event('submit', { cancelable: true }));
          }
          return;
        }
        this._onKeyDown(e);
      });
    }

    const digitalBtn = html.querySelector?.('.btn-digital');
    digitalBtn?.addEventListener('click', (e: Event) => {
      e.preventDefault();
      this.resolver.submitDigital();
      this.close();
    });

    html.addEventListener('submit', (e: Event) => {
      e.preventDefault();

      // Check if all die inputs are blank (empty/whitespace)
      const inputs = Array.from(
        html.querySelectorAll?.('input.die-input') ?? []
      ) as HTMLInputElement[];
      const allBlank =
        inputs.length > 0
          ? inputs.every((input) => !input.value || input.value.trim() === '')
          : true;

      if (allBlank) {
        this.resolver.submitDigital();
        this.close();
        return;
      }

      let formData: { get(name: string): any } | null = null;
      try {
        formData = new FormData(html as HTMLFormElement);
      } catch {
        // Fallback for mock environments without DOM FormData
      }

      const getFieldValue = (name: string): string => {
        if (formData && typeof formData.get === 'function') {
          const val = formData.get(name);
          return typeof val === 'string' ? val : '';
        }
        const el = html.querySelector?.(`[name="${name}"]`) as HTMLInputElement | null;
        return el?.value ?? '';
      };

      const valuesMap = new Map<FoundryDiceTerm, number[]>();

      for (let tIdx = 0; tIdx < this.resolver.diceTerms.length; tIdx++) {
        const term = this.resolver.diceTerms[tIdx];
        if (!term) continue;
        const count = term.number ?? 1;
        const values: number[] = [];

        for (let dIdx = 0; dIdx < count; dIdx++) {
          const raw = getFieldValue(`die_${tIdx}_${dIdx}`);
          const rawStr = raw.trim();
          const num = Number(rawStr);
          if (rawStr !== '' && !isNaN(num) && num > 0) {
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

  _onClose(options: unknown) {
    if (this.keyHandler && typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.keyHandler, true);
      this.keyHandler = undefined;
    }
    super._onClose(options);
  }

  async close(options?: unknown) {
    if (this.keyHandler && typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.keyHandler, true);
      this.keyHandler = undefined;
    }
    this.resolver.submitDigital();
    return super.close(options);
  }
}
