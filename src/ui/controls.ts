import { MODULE_ID, SETTINGS } from '../constants';

export function registerControls(): void {
  const game = (globalThis as any).game;
  const Hooks = (globalThis as any).Hooks;

  // 1. Keybinding: Alt+P to toggle module on/off
  if (game?.keybindings) {
    game.keybindings.register(MODULE_ID, 'toggle', {
      name: 'PP_DICE.ToggleTitle',
      hint: 'PP_DICE.EnabledHint',
      editable: [{ key: 'KeyP', modifiers: ['Alt'] }],
      onDown: () => {
        toggleEnabled();
        return true;
      },
    });
  }

  // 2. Scene Controls Button
  Hooks?.on('getSceneControlButtons', (controls: any[]) => {
    const tokenControls = controls.find((c) => c.name === 'token');
    if (!tokenControls) return;

    const isEnabled = game.settings.get(MODULE_ID, SETTINGS.ENABLED);

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

export function toggleEnabled(): boolean {
  const game = (globalThis as any).game;
  const current = game.settings.get(MODULE_ID, SETTINGS.ENABLED);
  const next = !current;
  game.settings.set(MODULE_ID, SETTINGS.ENABLED, next);

  const status = next ? 'Enabled' : 'Disabled';
  (globalThis as any).ui?.notifications?.info(`Physical Play Dice: ${status}`);
  return next;
}
