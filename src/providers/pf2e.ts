import { RollContextProvider, RollEvaluationContext } from './base';

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

    // 2. Check Party & Player Membership
    const isPlayer = this.isPlayerActor(actor);

    // 3. Check Secrecy
    const isSecret = this.isSecretRoll(roll, options);

    // 4. Resolve Title / Action Label
    const title = this.resolveTitle(roll, actor);

    return {
      actor,
      token,
      isPlayer,
      isSecret,
      title,
      sourceSystem: 'pf2e',
    };
  }

  isPlayerActor(actor: any): boolean {
    if (!actor) return false;

    const game = (globalThis as any).game;

    // Check active party members
    if (game?.actors?.party?.members?.some((m: any) => m?.uuid === actor?.uuid || m?.id === actor?.id)) {
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

    // Generic owner / character checks
    if (actor.hasPlayerOwner === true) {
      return true;
    }

    if (actor.type === 'character') {
      return true;
    }

    return false;
  }

  isSecretRoll(roll: any, options: Record<string, any> = {}): boolean {
    if (options.allowInteractive === false) return true;
    if (roll.options?.isPrivate === true) return true;

    const mode = roll.options?.messageMode ?? roll.options?.rollMode;
    if (mode === 'blind' || mode === 'blindroll' || mode === 'gm' || mode === 'gmroll') {
      return true;
    }

    // Check domains or traits for 'secret'
    const domains = roll.options?.domains;
    if (Array.isArray(domains) && domains.includes('secret')) {
      return true;
    }

    const traits = roll.options?.traits;
    if (Array.isArray(traits) && traits.includes('secret')) {
      return true;
    }

    return false;
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
