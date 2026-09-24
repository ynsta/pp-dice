import { RollContextProvider, RollEvaluationContext } from './base';
import { isSecretRoll, isFortuneRoll, isMisfortuneRoll } from '../core/roll-helpers';

export class GenericContextProvider implements RollContextProvider {
  name = 'generic';

  supports(): boolean {
    return true; // Always available as fallback
  }

  resolveContext(roll: any, options: Record<string, any> = {}): RollEvaluationContext {
    const canvas = (globalThis as any).canvas;

    let actor = roll.data?.actor ?? (roll as any)._actor ?? (roll as any)._combatant?.actor ?? null;
    let token = roll.data?.token ?? (roll as any)._combatant?.token ?? null;

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

    // Action resolution
    let action = roll.options?.action ?? null;
    if (
      !action &&
      (roll.options?.type === 'initiative' ||
        Boolean(roll.options?.initiative) ||
        (roll as any)._combatant != null)
    ) {
      action = 'initiative';
    }

    // Player owned or character type (supports GM in-person tabletop sessions)
    const isPlayer = this.isPlayerActor(actor);
    const isSecret = isSecretRoll(roll, options);
    const rollMode = roll.options?.messageMode ?? roll.options?.rollMode;
    const title = this.resolveTitle(roll, actor, null, options);

    return {
      actor,
      token,
      isPlayer,
      isSecret,
      title,
      action: action ?? undefined,
      rollMode,
      sourceSystem: (globalThis as any).game?.system?.id ?? 'generic',
      isFortune: isFortuneRoll(roll),
      isMisfortune: isMisfortuneRoll(roll),
    };
  }

  isPlayerActor(actor: any): boolean {
    if (!actor) return false;
    return Boolean(actor.hasPlayerOwner === true || actor.type === 'character');
  }

  resolveTitle(roll: any, actor: any, _item?: any, _options?: Record<string, any>): string {
    const isInitiative =
      roll?.options?.type === 'initiative' ||
      roll?.options?.initiative === true ||
      (roll as any)?._combatant != null;

    if (isInitiative) {
      const actorName = actor?.name;
      return actorName ? `${actorName} — Initiative` : 'Initiative';
    }

    return actor?.name ? `${actor.name} — Roll` : 'Roll';
  }
}
