import { describe, it, expect, beforeEach } from 'vitest';
import { ContextManager } from '../src/core/context-manager';
import { PF2eContextProvider } from '../src/providers/pf2e';
import { GenericContextProvider } from '../src/providers/generic';
import { MODULE_ID, SETTINGS } from '../src/constants';

describe('ContextManager & Providers', () => {
  let contextManager: ContextManager;
  let mockGame: any;

  beforeEach(() => {
    mockGame = {
      system: { id: 'pf2e' },
      actors: {
        party: {
          members: [{ uuid: 'Actor.valeros', id: 'valeros' }],
        },
        get: (id: string) => (id === 'valeros' ? { id: 'valeros', name: 'Valeros' } : null),
      },
      settings: {
        get: (module: string, setting: string) => {
          if (module === MODULE_ID && setting === SETTINGS.ENABLED) return true;
          return null;
        },
      },
    };
    (globalThis as any).game = mockGame;
    (globalThis as any).canvas = { tokens: { controlled: [] } };

    contextManager = new ContextManager();
  });

  it('correctly identifies party member actor in PF2e', () => {
    const provider = new PF2eContextProvider();
    const actorInParty = {
      uuid: 'Actor.valeros',
      id: 'valeros',
      name: 'Valeros',
      parties: new Set(),
      hasPlayerOwner: false, // Even if GM account owns it without player user!
    };

    expect(provider.isPlayerActor(actorInParty)).toBe(true);
  });

  it('correctly identifies actor with alliance === "party" in PF2e', () => {
    const provider = new PF2eContextProvider();
    const actorWithAlliance = {
      uuid: 'Actor.custom',
      id: 'custom',
      name: 'Custom PC',
      system: { details: { alliance: 'party' } },
      parties: new Set(),
    };

    expect(provider.isPlayerActor(actorWithAlliance)).toBe(true);
  });

  it('does not identify NPC monster as player', () => {
    const provider = new PF2eContextProvider();
    const monsterActor = {
      uuid: 'Actor.goblin',
      id: 'goblin',
      name: 'Goblin Warrior',
      type: 'npc',
      hasPlayerOwner: false,
      system: { details: { alliance: 'opposition' } },
      parties: new Set(),
    };

    expect(provider.isPlayerActor(monsterActor)).toBe(false);
  });

  it('does not identify unowned character as player (M6)', () => {
    const provider = new PF2eContextProvider();
    const unownedCharacter = {
      uuid: 'Actor.pregen',
      id: 'pregen',
      name: 'Unowned Pregen',
      type: 'character',
      hasPlayerOwner: false,
      parties: new Set(),
    };

    expect(provider.isPlayerActor(unownedCharacter)).toBe(false);
  });

  it('identifies secret rolls accurately (H4)', () => {
    const provider = new PF2eContextProvider();

    const publicRoll = { options: { domains: ['attack-roll'] } };
    expect(provider.isSecretRoll(publicRoll)).toBe(false);

    const secretTraitRoll = { options: { traits: ['secret', 'exploration'] } };
    expect(provider.isSecretRoll(secretTraitRoll)).toBe(true);

    const blindMessageRoll = { options: { messageMode: 'blind' } };
    expect(provider.isSecretRoll(blindMessageRoll)).toBe(true);

    const selfMessageRoll = { options: { messageMode: 'self' } };
    expect(provider.isSecretRoll(selfMessageRoll)).toBe(true);

    const nonInteractiveRoll = { options: {} };
    expect(provider.isSecretRoll(nonInteractiveRoll, { allowInteractive: false })).toBe(true);
  });

  it('detects fortune and misfortune traits/options in PF2e via terms and options (M5)', () => {
    const provider = new PF2eContextProvider();

    const normalRoll = {
      formula: '1d20+5',
      terms: [{ faces: 20, number: 1, modifiers: [] }],
      options: {},
    };
    expect(provider.detectFortune(normalRoll)).toBe(false);
    expect(provider.detectMisfortune(normalRoll)).toBe(false);

    // Flavour text with 'kh' does not trigger fortune (M5)
    const khopeshRoll = {
      formula: '1d20+5[khopesh]',
      terms: [{ faces: 20, number: 1, modifiers: [] }],
      options: {},
    };
    expect(provider.detectFortune(khopeshRoll)).toBe(false);

    const fortuneFormula = {
      formula: '2d20kh+5',
      terms: [{ faces: 20, number: 2, modifiers: ['kh'] }],
      options: {},
    };
    expect(provider.detectFortune(fortuneFormula)).toBe(true);

    const fortuneOption = { formula: '2d20+5', options: { rollTwice: 'keep-higher' } };
    expect(provider.detectFortune(fortuneOption)).toBe(true);

    const misfortuneFormula = {
      formula: '2d20kl+5',
      terms: [{ faces: 20, number: 2, modifiers: ['kl'] }],
      options: {},
    };
    expect(provider.detectMisfortune(misfortuneFormula)).toBe(true);

    const misfortuneOption = { formula: '2d20+5', options: { rollTwice: 'keep-lower' } };
    expect(provider.detectMisfortune(misfortuneOption)).toBe(true);
  });

  it('does not use controlled token fallback on untargeted rolls (M6)', () => {
    const pcActor = {
      id: 'pc1',
      name: 'Player Fighter',
      hasPlayerOwner: true,
      type: 'character',
    };
    (globalThis as any).canvas = {
      tokens: {
        controlled: [{ actor: pcActor }],
      },
    };

    // Untargeted roll (e.g. GM rolls /r 1d20 with PC token selected)
    const rawRoll = {
      formula: '1d20',
      data: {},
      options: {},
    };

    const pf2eProvider = new PF2eContextProvider();
    const pf2eCtx = pf2eProvider.resolveContext(rawRoll);
    expect(pf2eCtx?.actor).toBeNull();
    expect(pf2eCtx?.isPlayer).toBe(false);

    mockGame.system.id = 'dnd5e';
    const genericProvider = new GenericContextProvider();
    const genericCtx = genericProvider.resolveContext(rawRoll);
    expect(genericCtx.actor).toBeNull();
    expect(genericCtx.isPlayer).toBe(false);
  });

  it('uses controlled token fallback when roll explicitly targets actor/token (M6)', () => {
    const pcActor = {
      id: 'pc1',
      name: 'Player Fighter',
      hasPlayerOwner: true,
      type: 'character',
    };
    (globalThis as any).canvas = {
      tokens: {
        controlled: [{ actor: pcActor }],
      },
    };

    // Roll with explicit speaker target but unresolved actor
    const targetedRoll = {
      formula: '1d20+3',
      data: {},
      options: { speaker: { token: 'token123' } },
    };

    mockGame.system.id = 'pf2e';
    const pf2eProvider = new PF2eContextProvider();
    const pf2eCtx = pf2eProvider.resolveContext(targetedRoll);
    expect(pf2eCtx?.actor).toBe(pcActor);
    expect(pf2eCtx?.isPlayer).toBe(true);

    mockGame.system.id = 'dnd5e';
    const genericProvider = new GenericContextProvider();
    const genericCtx = genericProvider.resolveContext(targetedRoll);
    expect(genericCtx.actor).toBe(pcActor);
    expect(genericCtx.isPlayer).toBe(true);
  });

  it('shouldIntercept returns true only for public player rolls', () => {
    const playerRoll = {
      data: {
        actor: {
          uuid: 'Actor.valeros',
          id: 'valeros',
          name: 'Valeros',
          hasPlayerOwner: true,
        },
      },
      options: {
        action: 'strike',
      },
    };

    const result = contextManager.shouldIntercept(playerRoll);
    expect(result.intercept).toBe(true);
    expect(result.context.isPlayer).toBe(true);
    expect(result.context.isSecret).toBe(false);

    // Secret roll test
    const secretPlayerRoll = {
      ...playerRoll,
      options: {
        action: 'recall-knowledge',
        domains: ['secret'],
      },
    };
    const secretResult = contextManager.shouldIntercept(secretPlayerRoll);
    expect(secretResult.intercept).toBe(false);
    expect(secretResult.context.isSecret).toBe(true);

    // NPC roll test
    const npcRoll = {
      data: {
        actor: {
          uuid: 'Actor.dragon',
          id: 'dragon',
          name: 'Red Dragon',
          type: 'npc',
          hasPlayerOwner: false,
        },
      },
      options: {},
    };
    const npcResult = contextManager.shouldIntercept(npcRoll);
    expect(npcResult.intercept).toBe(false);
    expect(npcResult.context.isPlayer).toBe(false);
  });

  it('generic provider falls back correctly when not in PF2e', () => {
    mockGame.system.id = 'dnd5e';
    const generic = new GenericContextProvider();

    const pc = { hasPlayerOwner: true, name: 'Fighter' };
    const pcRoll = { data: { actor: pc }, options: { rollMode: 'publicroll' } };
    const ctx = generic.resolveContext(pcRoll);
    expect(ctx.isPlayer).toBe(true);
    expect(ctx.isSecret).toBe(false);

    const gmRoll = { data: { actor: pc }, options: { rollMode: 'gmroll' } };
    const gmCtx = generic.resolveContext(gmRoll);
    expect(gmCtx.isSecret).toBe(true);

    // Advantage / Disadvantage in generic provider
    const advRoll = {
      data: { actor: pc },
      terms: [{ faces: 20, number: 2, modifiers: ['kh'] }],
    };
    const advCtx = generic.resolveContext(advRoll);
    expect(advCtx.isFortune).toBe(true);
    expect(advCtx.isMisfortune).toBe(false);
  });
});
