import { MODULE_ID, SETTINGS } from '../constants';

export function registerKeybindings(): void {
  const game = (globalThis as any).game;

  // Keybinding: Alt+P (configurable by user in Configure Controls -> Package Keybindings)
  if (game?.keybindings) {
    game.keybindings.register(MODULE_ID, 'toggle', {
      name: 'PP_DICE.ToggleTitle',
      hint: 'PP_DICE.ToggleHint',
      editable: [{ key: 'KeyP', modifiers: ['Alt'] }],
      restricted: true,
      precedence: (globalThis as any).CONST?.KEYBINDING_PRECEDENCE?.NORMAL,
      onDown: () => {
        toggleEnabled();
        return true;
      },
    });
  }
}

export function registerSceneControls(): void {
  const game = (globalThis as any).game;
  const Hooks = (globalThis as any).Hooks;

  // Scene Controls Button in Token controls
  Hooks?.on('getSceneControlButtons', (controls: any[]) => {
    const tokenControls = controls.find((c: any) => c.name === 'token');
    if (!tokenControls) return;

    const isEnabled = game?.settings?.get(MODULE_ID, SETTINGS.ENABLED) ?? true;

    tokenControls.tools.push({
      name: 'pp-dice-toggle',
      title: 'PP_DICE.ToggleTitle',
      icon: 'fa-solid fa-dice-d20',
      toggle: true,
      active: isEnabled,
      onClick: (toggled: boolean) => {
        game.settings.set(MODULE_ID, SETTINGS.ENABLED, toggled);
      },
    });
  });
}

export function registerControls(): void {
  registerKeybindings();
  registerSceneControls();
}

export function toggleEnabled(): boolean {
  const game = (globalThis as any).game;
  const ui = (globalThis as any).ui;
  const current = game.settings.get(MODULE_ID, SETTINGS.ENABLED);
  const next = !current;
  game.settings.set(MODULE_ID, SETTINGS.ENABLED, next);

  const status = next ? 'Enabled' : 'Disabled';
  ui?.notifications?.info(`Physical Play Dice: ${status}`);
  ui?.controls?.render();
  return next;
}
