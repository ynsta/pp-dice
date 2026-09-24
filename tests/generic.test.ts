import { describe, it, expect, beforeEach } from 'vitest';
import { GenericContextProvider } from '../src/providers/generic';

describe('GenericContextProvider', () => {
  beforeEach(() => {
    (globalThis as any).game = {
      system: { id: 'generic' },
      user: {},
    };
    (globalThis as any).canvas = {
      tokens: { controlled: [] },
    };
    (globalThis as any).ui = {
      windows: {},
    };
  });

  it('intercepts player character initiative roll tagged on roll instance', () => {
    const provider = new GenericContextProvider();
    const mockActor = {
      id: 'pc-warrior',
      name: 'Valeros',
      type: 'character',
      hasPlayerOwner: true,
    };

    const roll = {
      formula: '1d20+2',
      options: {
        type: 'initiative',
        initiative: true,
      },
      _actor: mockActor,
      _combatant: { id: 'comb-1', actor: mockActor },
    };

    const ctx = provider.resolveContext(roll);

    expect(ctx).not.toBeNull();
    expect(ctx?.isPlayer).toBe(true);
    expect(ctx?.actor).toBe(mockActor);
    expect(ctx?.action).toBe('initiative');
    expect(ctx?.title).toBe('Valeros — Initiative');
  });

  it('does not intercept generic NPC initiative roll', () => {
    const provider = new GenericContextProvider();
    const mockNpc = {
      id: 'orc-1',
      name: 'Orc Warrior',
      type: 'npc',
      hasPlayerOwner: false,
    };

    const roll = {
      formula: '1d20+1',
      options: {
        type: 'initiative',
        initiative: true,
      },
      _actor: mockNpc,
    };

    const ctx = provider.resolveContext(roll);

    expect(ctx).not.toBeNull();
    expect(ctx?.isPlayer).toBe(false);
  });

  it('resolves actor and token from _combatant when _actor is not directly set', () => {
    const provider = new GenericContextProvider();
    const mockActor = {
      id: 'pc-1',
      name: 'Valeros',
      type: 'character',
      hasPlayerOwner: true,
    };
    const mockToken = {
      id: 'tok-1',
      name: 'Valeros Token',
      actor: mockActor,
    };

    const roll = {
      formula: '1d20+2',
      options: {},
      _combatant: { id: 'comb-1', actor: mockActor, token: mockToken },
    };

    const ctx = provider.resolveContext(roll);

    expect(ctx).not.toBeNull();
    expect(ctx?.actor).toBe(mockActor);
    expect(ctx?.token).toBe(mockToken);
    expect(ctx?.isPlayer).toBe(true);
    expect(ctx?.action).toBe('initiative');
    expect(ctx?.title).toBe('Valeros — Initiative');
  });

  it('formats initiative title with resolveTitle', () => {
    const provider = new GenericContextProvider();
    const mockActor = { name: 'Seelah' };
    const initiativeRoll = { options: { type: 'initiative' } };
    expect(provider.resolveTitle(initiativeRoll, mockActor)).toBe('Seelah — Initiative');
    expect(provider.resolveTitle(initiativeRoll, null)).toBe('Initiative');

    const regularRoll = { options: {} };
    expect(provider.resolveTitle(regularRoll, mockActor)).toBe('Seelah — Roll');
    expect(provider.resolveTitle(regularRoll, null)).toBe('Roll');
  });

  it('correctly identifies player actors via isPlayerActor', () => {
    const provider = new GenericContextProvider();
    expect(provider.isPlayerActor(null)).toBe(false);
    expect(provider.isPlayerActor({ type: 'character' })).toBe(true);
    expect(provider.isPlayerActor({ hasPlayerOwner: true })).toBe(true);
    expect(provider.isPlayerActor({ type: 'npc', hasPlayerOwner: false })).toBe(false);
  });
});
