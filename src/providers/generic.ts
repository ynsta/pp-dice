import { RollContextProvider, RollEvaluationContext } from './base';
import { isSecretRoll, isFortuneRoll, isMisfortuneRoll } from '../core/roll-helpers';

export class GenericContextProvider implements RollContextProvider {
  name = 'generic';

  supports(): boolean {
    return true; // Always available as fallback
  }

  resolveContext(roll: any, options: Record<string, any> = {}): RollEvaluationContext {
    const canvas = (globalThis as any).canvas;

    let actor = roll.data?.actor ?? null;
    let token = roll.data?.token ?? null;

    if (!actor && roll.data?.token?.actor) {
      actor = roll.data.token.actor;
    }

    const hasExplicitTarget = Boolean(
      roll.data?.actor ||
      roll.data?.token ||
      roll.options?.actor ||
      roll.options?.origin ||
      roll.options?.speaker ||
      options?.speaker
    );

    // Fallback to controlled token only if the roll explicitly targets an actor (M6)
    if (!actor && hasExplicitTarget && canvas?.tokens?.controlled?.length === 1) {
      token = canvas.tokens.controlled[0];
      actor = token.actor;
    }

    // Require player ownership; do not treat unowned character tokens as players (M6)
    const isPlayer = Boolean(actor?.hasPlayerOwner === true);
    const isSecret = isSecretRoll(roll, options);
    const rollMode = roll.options?.messageMode ?? roll.options?.rollMode;
    const title = actor?.name ? `${actor.name} — Roll` : 'Roll';

    return {
      actor,
      token,
      isPlayer,
      isSecret,
      title,
      rollMode,
      sourceSystem: (globalThis as any).game?.system?.id ?? 'generic',
      isFortune: isFortuneRoll(roll),
      isMisfortune: isMisfortuneRoll(roll),
    };
  }
}
