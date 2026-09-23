import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerKeybindings, registerSceneControls, toggleEnabled } from '../src/ui/controls';
import { MODULE_ID, SETTINGS } from '../src/constants';

describe('Controls & Keybindings', () => {
  let mockGame: any;
  let mockUi: any;

  beforeEach(() => {
    vi.restoreAllMocks();

    mockGame = {
      keybindings: {
        actions: new Map(),
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

  it('does not register keybinding if already present in actions', () => {
    mockGame.keybindings.actions.set(`${MODULE_ID}.toggle`, {});

    registerKeybindings();

    expect(mockGame.keybindings.register).not.toHaveBeenCalled();
  });

  it('toggles enabled setting and renders controls', () => {
    const nextState = toggleEnabled();

    expect(nextState).toBe(false);
    expect(mockGame.settings.set).toHaveBeenCalledWith(MODULE_ID, SETTINGS.ENABLED, false);
    expect(mockUi.notifications.info).toHaveBeenCalledWith('Physical Play Dice: Disabled');
    expect(mockUi.controls.render).toHaveBeenCalled();
  });

  it('registers scene control toggle on Foundry v14 record-based controls', () => {
    let registeredHook: ((controls: any) => void) | undefined;
    (globalThis as any).Hooks = {
      on: vi.fn((event: string, callback: any) => {
        if (event === 'getSceneControlButtons') registeredHook = callback;
      }),
    };

    registerSceneControls();
    expect(registeredHook).toBeDefined();

    const v14Controls: Record<string, any> = {
      tokens: {
        name: 'tokens',
        tools: {},
      },
    };

    registeredHook!(v14Controls);

    const tool =
      v14Controls.tokens.tools['pp-dice-toggle'] || v14Controls.tokens.tools.ppDiceToggle;
    expect(tool).toBeDefined();
    expect(tool.toggle).toBe(true);
    expect(typeof tool.onChange).toBe('function');

    tool.onChange(null, false);
    expect((globalThis as any).game.settings.set).toHaveBeenCalledWith('pp-dice', 'enabled', false);

    tool.onClick(true);
    expect((globalThis as any).game.settings.set).toHaveBeenCalledWith('pp-dice', 'enabled', true);
  });

  it('registers scene control toggle on Foundry v12 array-based controls', () => {
    let registeredHook: ((controls: any) => void) | undefined;
    (globalThis as any).Hooks = {
      on: vi.fn((event: string, callback: any) => {
        if (event === 'getSceneControlButtons') registeredHook = callback;
      }),
    };

    registerSceneControls();
    expect(registeredHook).toBeDefined();

    const v12Controls = [
      {
        name: 'tokens',
        tools: [] as any[],
      },
    ];

    registeredHook!(v12Controls);

    const tool = v12Controls[0]?.tools.find((t: any) => t.name === 'pp-dice-toggle');
    expect(tool).toBeDefined();
    expect(tool.toggle).toBe(true);

    tool.onClick(false);
    expect((globalThis as any).game.settings.set).toHaveBeenCalledWith('pp-dice', 'enabled', false);
  });

  it('handles record-based controls with array tools and token key fallback', () => {
    let registeredHook: ((controls: any) => void) | undefined;
    (globalThis as any).Hooks = {
      on: vi.fn((event: string, callback: any) => {
        if (event === 'getSceneControlButtons') registeredHook = callback;
      }),
    };

    registerSceneControls();
    expect(registeredHook).toBeDefined();

    const controls: Record<string, any> = {
      token: {
        tools: [] as any[],
      },
    };

    registeredHook!(controls);

    expect(controls.token.tools.length).toBe(1);
    expect(controls.token.tools[0].name).toBe('pp-dice-toggle');
  });
});
