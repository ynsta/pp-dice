import { RollContextProvider, RollEvaluationContext } from './base';

export class GenericContextProvider implements RollContextProvider {
  name = 'generic';

  supports(): boolean {
    return true; // Always available as fallback
  }

  resolveContext(roll: any, options: Record<string, any> = {}): RollEvaluationContext {
    const canvas = (globalThis as any).canvas;

    let actor = roll.data?.actor ?? null;
    let token = roll.data?.token ?? null;

    if (!actor && canvas?.tokens?.controlled?.length === 1) {
      token = canvas.tokens.controlled[0];
      actor = token.actor;
    }

    const isPlayer = Boolean(actor?.hasPlayerOwner || actor?.type === 'character');
    const rollMode = roll.options?.rollMode;
    const isSecret =
      options.allowInteractive === false ||
      rollMode === 'blindroll' ||
      rollMode === 'gmroll' ||
      rollMode === 'selfroll';

    const title = actor?.name ? `${actor.name} — Roll` : 'Roll';

    return {
      actor,
      token,
      isPlayer,
      isSecret,
      title,
      rollMode,
      sourceSystem: (globalThis as any).game?.system?.id ?? 'generic',
    };
  }
}
