import { RollContextProvider, RollEvaluationContext } from './base';
import { isSecretRoll, isFortuneRoll, isMisfortuneRoll } from '../core/roll-helpers';

export class PF2eContextProvider implements RollContextProvider {
  name = 'pf2e';

  supports(): boolean {
    const sys = (globalThis as any).game?.system;
    return sys?.id === 'pf2e' || sys?.id === 'sf2e';
  }

  resolveContext(roll: any, options: Record<string, any> = {}): RollEvaluationContext | null {
    if (!this.supports()) return null;

    const game = (globalThis as any).game;
    const canvas = (globalThis as any).canvas;

    // 1. Identify Actor & Token
    let actor = roll.data?.actor ?? null;
    let token = roll.data?.token ?? null;

    if (!actor && roll.data?.token?.actor) {
      actor = roll.data.token.actor;
    }

    if (!actor && roll.options?.actor) {
      if (typeof roll.options.actor === 'string') {
        actor = game?.actors?.get(roll.options.actor) ?? null;
      } else {
        actor = roll.options.actor;
      }
    }

    if (!actor && roll.options?.origin?.actor) {
      const uuid = roll.options.origin.actor;
      actor = (globalThis as any).fromUuidSync?.(uuid) ?? null;
    }

    // Fallback to currently controlled token on canvas
    if (!actor && canvas?.tokens?.controlled?.length === 1) {
      token = canvas.tokens.controlled[0];
      actor = token.actor;
    }

    // Fallback to assigned user character (e.g. player client rolling from hotbar macro)
    if (!actor && game?.user?.character) {
      actor = game.user.character;
    }

    // Fallback: match item identifier (e.g. "itemId.staff.melee" from PF2e character sheet strikes)
    if (!actor && typeof roll.options?.identifier === 'string') {
      const itemId = roll.options.identifier.split('.')[0];
      if (itemId) {
        actor =
          game?.actors?.find?.((a: any) =>
            typeof a.items?.has === 'function'
              ? a.items.has(itemId)
              : a.items?.some?.((i: any) => i?.id === itemId || i?._id === itemId)
          ) ?? null;
      }
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

    // 2. Check Party & Player Membership
    const isPlayer = this.isPlayerActor(actor);

    // 3. Check Secrecy
    const isSecret = this.isSecretRoll(roll, options);

    // 4. Resolve Title / Action Label
    const title = this.resolveTitle(roll, actor);

    // 5. Fortune / Misfortune
    const isFortune = this.detectFortune(roll);
    const isMisfortune = this.detectMisfortune(roll);

    return {
      actor,
      token,
      isPlayer,
      isSecret,
      title,
      sourceSystem: 'pf2e',
      isFortune,
      isMisfortune,
    };
  }

  isPlayerActor(actor: any): boolean {
    if (!actor) return false;

    const game = (globalThis as any).game;

    // Check active party members
    if (
      game?.actors?.party?.members?.some((m: any) => m?.uuid === actor?.uuid || m?.id === actor?.id)
    ) {
      return true;
    }

    // Check actor party set
    if (actor.parties && actor.parties.size > 0) {
      return true;
    }

    // Check alliance
    if (actor.system?.details?.alliance === 'party') {
      return true;
    }

    // Generic owner checks
    if (actor.hasPlayerOwner === true) {
      return true;
    }

    // Character type (supports GM in-person tabletop sessions and unassigned pregens)
    if (actor.type === 'character') {
      return true;
    }

    return false;
  }

  isSecretRoll(roll: any, options: Record<string, any> = {}): boolean {
    return isSecretRoll(roll, options);
  }

  detectFortune(roll: any): boolean {
    return isFortuneRoll(roll);
  }

  detectMisfortune(roll: any): boolean {
    return isMisfortuneRoll(roll);
  }

  private resolveTitle(roll: any, actor: any): string {
    const parts: string[] = [];
    if (actor?.name) parts.push(actor.name);

    const action = roll.options?.action || roll.options?.type || roll.options?.identifier;
    if (action) {
      parts.push(String(action));
    }

    return parts.length > 0 ? parts.join(' — ') : 'Roll';
  }
}
