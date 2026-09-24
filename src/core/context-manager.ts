import { MODULE_ID, SETTINGS } from '../constants';
import { RollContextProvider, RollEvaluationContext } from '../providers/base';
import { PF2eContextProvider } from '../providers/pf2e';
import { GenericContextProvider } from '../providers/generic';

export class ContextManager {
  private providers: RollContextProvider[] = [];
  private initialized = false;

  constructor() {
    // Lazily initialized in ensureProviders() to avoid circular import issues
  }

  private ensureProviders(): void {
    if (!this.initialized) {
      this.initialized = true;
      this.providers.unshift(new PF2eContextProvider());
      this.providers.push(new GenericContextProvider());
    }
  }

  registerProvider(provider: RollContextProvider): void {
    this.ensureProviders();
    this.providers.unshift(provider); // New custom/system providers take precedence over existing
  }

  resolve(roll: any, options: Record<string, any> = {}): RollEvaluationContext {
    this.ensureProviders();
    for (const provider of this.providers) {
      if (provider.supports()) {
        const context = provider.resolveContext(roll, options);
        if (context) return context;
      }
    }

    return {
      isPlayer: false,
      isSecret: false,
      sourceSystem: 'unknown',
    };
  }

  shouldIntercept(
    roll: any,
    options: Record<string, any> = {}
  ): {
    intercept: boolean;
    context: RollEvaluationContext;
  } {
    const game = (globalThis as any).game;
    const isModuleEnabled = game?.settings?.get(MODULE_ID, SETTINGS.ENABLED) ?? true;

    if (!isModuleEnabled) {
      return {
        intercept: false,
        context: { isPlayer: false, isSecret: false },
      };
    }

    const context = this.resolve(roll, options);

    // Prompt if and only if it's a player character AND not secret/blind
    const intercept = context.isPlayer && !context.isSecret;

    return { intercept, context };
  }
}

export const contextManager = new ContextManager();
