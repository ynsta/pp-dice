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

    // Controlled token fallback when a single token is selected
    if (!actor && canvas?.tokens?.controlled?.length === 1) {
      token = canvas.tokens.controlled[0];
      actor = token.actor;
    }

    // Fallback to assigned user character (e.g. player client rolling from hotbar macro)
    if (!actor && (globalThis as any).game?.user?.character) {
      actor = (globalThis as any).game.user.character;
    }

    // Fallback: check open actor sheets in ui.windows
    if (!actor && (globalThis as any).ui?.windows) {
      const openSheet = Object.values((globalThis as any).ui.windows).find(
        (w: any) => w?.rendered && w?.actor
      ) as any;
      if (openSheet?.actor) {
        actor = openSheet.actor;
      }
    }

    // Player owned or character type (supports GM in-person tabletop sessions)
    const isPlayer = Boolean(actor?.hasPlayerOwner === true || actor?.type === 'character');
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
