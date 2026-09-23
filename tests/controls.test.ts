import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerKeybindings, toggleEnabled } from '../src/ui/controls';
import { MODULE_ID, SETTINGS } from '../src/constants';

describe('Controls & Keybindings', () => {
  let mockGame: any;
  let mockUi: any;

  beforeEach(() => {
    vi.restoreAllMocks();

    mockGame = {
      keybindings: {
        register: vi.fn(),
      },
      settings: {
        get: vi.fn().mockReturnValue(true),
        set: vi.fn(),
      },
    };

    mockUi = {
      notifications: {
        info: vi.fn(),
      },
      controls: {
        render: vi.fn(),
      },
    };

    (globalThis as any).game = mockGame;
    (globalThis as any).ui = mockUi;
    (globalThis as any).CONST = {
      KEYBINDING_PRECEDENCE: {
        NORMAL: 0,
      },
    };
  });

  it('registers toggle keybinding with game.keybindings', () => {
    registerKeybindings();

    expect(mockGame.keybindings.register).toHaveBeenCalledWith(
      MODULE_ID,
      'toggle',
      expect.objectContaining({
        name: 'PP_DICE.ToggleTitle',
        hint: 'PP_DICE.ToggleHint',
        restricted: false,
        editable: [{ key: 'KeyP', modifiers: ['Alt'] }],
      })
    );
  });

  it('toggles enabled setting and renders controls', () => {
    const nextState = toggleEnabled();

    expect(nextState).toBe(false);
    expect(mockGame.settings.set).toHaveBeenCalledWith(MODULE_ID, SETTINGS.ENABLED, false);
    expect(mockUi.notifications.info).toHaveBeenCalledWith('Physical Play Dice: Disabled');
    expect(mockUi.controls.render).toHaveBeenCalled();
  });
});
