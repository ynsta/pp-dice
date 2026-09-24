import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PF2eContextProvider } from '../src/providers/pf2e';
import { setPf2eActiveCheckContext, clearPf2eActiveCheckContext } from '../src/core/interceptor';

describe('PF2e & SF2e Context Provider', () => {
  beforeEach(() => {
    (globalThis as any).game = {
      system: { id: 'pf2e' },
      actors: {
        party: { members: [] },
        get: () => null,
        find: () => null,
      },
    };
    (globalThis as any).canvas = {
      tokens: { controlled: [] },
    };
    (globalThis as any).ui = {
      windows: {},
    };
    clearPf2eActiveCheckContext();
  });

  afterEach(() => {
    clearPf2eActiveCheckContext();
  });

  it('intercepts player character initiative roll from active check context', () => {
    const provider = new PF2eContextProvider();
    const mockActor = {
      id: 'ezren-1',
      name: 'Ezren',
      type: 'character',
      hasPlayerOwner: false,
      getActiveTokens: () => [],
    };

    const roll = {
      formula: '1d20+8',
      options: {
        type: 'initiative',
        domains: ['all', 'initiative', 'perception'],
      },
      terms: [{ faces: 20, results: [] }],
    };

    setPf2eActiveCheckContext({
      actor: mockActor,
      type: 'initiative',
      domains: ['all', 'initiative', 'perception'],
    });

    const ctx = provider.resolveContext(roll);
    clearPf2eActiveCheckContext();

    expect(ctx).not.toBeNull();
    expect(ctx?.isPlayer).toBe(true);
    expect(ctx?.actor).toBe(mockActor);
    expect(ctx?.action).toBe('initiative');
    expect(ctx?.title).toBe('Ezren — Initiative');
  });

  it('does not intercept NPC initiative roll', () => {
    const provider = new PF2eContextProvider();
    const mockNpc = {
      id: 'goblin-1',
      name: 'Goblin Pyro',
      type: 'npc',
      hasPlayerOwner: false,
      getActiveTokens: () => [],
    };

    const roll = {
      formula: '1d20+4',
      options: {
        type: 'initiative',
        domains: ['all', 'initiative', 'perception'],
      },
      terms: [{ faces: 20, results: [] }],
    };

    setPf2eActiveCheckContext({
      actor: mockNpc,
      type: 'initiative',
      domains: ['all', 'initiative', 'perception'],
    });

    const ctx = provider.resolveContext(roll);
    clearPf2eActiveCheckContext();

    expect(ctx).not.toBeNull();
    expect(ctx?.isPlayer).toBe(false);
  });

  it('resolves actor from roll options identifier when set to Actor UUID', () => {
    const provider = new PF2eContextProvider();
    const mockActor = {
      id: 'ezren-1',
      uuid: 'Actor.ezren1',
      name: 'Ezren',
      type: 'character',
      hasPlayerOwner: false,
    };

    (globalThis as any).fromUuidSync = (uuid: string) => {
      if (uuid === 'Actor.ezren1') return mockActor;
      return null;
    };

    const roll = {
      formula: '1d20+8',
      options: {
        type: 'initiative',
        identifier: 'Actor.ezren1',
        domains: ['initiative'],
      },
    };

    const ctx = provider.resolveContext(roll);
    expect(ctx?.actor).toBe(mockActor);
    expect(ctx?.isPlayer).toBe(true);
  });

  it('resolves actor from Scene token UUID in roll options identifier', () => {
    const provider = new PF2eContextProvider();
    const mockActor = {
      id: 'kyra-1',
      uuid: 'Actor.kyra1',
      name: 'Kyra',
      type: 'character',
      hasPlayerOwner: true,
    };
    const mockTokenDoc = {
      uuid: 'Scene.scene1.Token.token1',
      actor: mockActor,
    };

    (globalThis as any).fromUuidSync = (uuid: string) => {
      if (uuid === 'Scene.scene1.Token.token1') return mockTokenDoc;
      return null;
    };

    const roll = {
      formula: '1d20+7',
      options: {
        type: 'initiative',
        identifier: 'Scene.scene1.Token.token1',
        domains: ['initiative'],
      },
    };

    const ctx = provider.resolveContext(roll);
    expect(ctx?.actor).toBe(mockActor);
    expect(ctx?.isPlayer).toBe(true);
    expect(ctx?.title).toBe('Kyra — Initiative');
  });

  it('supports sf2e system and resolves initiative context', () => {
    (globalThis as any).game.system.id = 'sf2e';
    const provider = new PF2eContextProvider();
    expect(provider.supports()).toBe(true);

    const mockActor = {
      id: 'operative-1',
      name: 'Operative',
      type: 'character',
      hasPlayerOwner: true,
    };

    const roll = {
      formula: '1d20+10',
      options: {
        type: 'initiative',
      },
    };

    setPf2eActiveCheckContext({
      actor: mockActor,
      type: 'initiative',
    });

    const ctx = provider.resolveContext(roll);
    expect(ctx?.actor).toBe(mockActor);
    expect(ctx?.isPlayer).toBe(true);
    expect(ctx?.action).toBe('initiative');
    expect(ctx?.title).toBe('Operative — Initiative');
  });
});
