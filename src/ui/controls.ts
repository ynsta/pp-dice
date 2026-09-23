import { MODULE_ID, SETTINGS } from '../constants';

export function registerKeybindings(): void {
  const game = (globalThis as any).game;

  if (game?.keybindings?.actions?.has(`${MODULE_ID}.toggle`)) {
    return;
  }

  // Keybinding: Alt+P (configurable by user in Configure Controls -> Package Keybindings)
  if (game?.keybindings) {
    try {
      game.keybindings.register(MODULE_ID, 'toggle', {
        name: 'PP_DICE.ToggleTitle',
        hint: 'PP_DICE.ToggleHint',
        editable: [{ key: 'KeyP', modifiers: ['Alt'] }],
        restricted: false,
        precedence: (globalThis as any).CONST?.KEYBINDING_PRECEDENCE?.NORMAL ?? 0,
        onDown: () => {
          toggleEnabled();
          return true;
        },
      });
      console.log(`[${MODULE_ID}] Keybinding 'toggle' registered successfully.`);
    } catch (err) {
      console.error(`[${MODULE_ID}] Failed to register keybindings:`, err);
    }
  }
}

export function registerSceneControls(): void {
  const game = (globalThis as any).game;
  const Hooks = (globalThis as any).Hooks;

  Hooks?.on('getSceneControlButtons', (controls: any[] | Record<string, any>) => {
    const isEnabled = game?.settings?.get(MODULE_ID, SETTINGS.ENABLED) ?? true;
    const toolDef = {
      name: 'pp-dice-toggle',
      title: 'PP_DICE.ToggleTitle',
      icon: 'fa-solid fa-dice-d20',
      toggle: true,
      active: isEnabled,
      onChange: (_event: any, active: boolean) => {
        game?.settings?.set(MODULE_ID, SETTINGS.ENABLED, active);
      },
      onClick: (toggled: boolean) => {
        game?.settings?.set(MODULE_ID, SETTINGS.ENABLED, toggled);
      },
    };

    // Foundry v13+ Record structure
    if (controls && !Array.isArray(controls) && typeof controls === 'object') {
      const tokensLayer = controls.tokens ?? controls.token;
      if (tokensLayer) {
        if (tokensLayer.tools && !Array.isArray(tokensLayer.tools)) {
          tokensLayer.tools['pp-dice-toggle'] = toolDef;
        } else if (Array.isArray(tokensLayer.tools)) {
          tokensLayer.tools.push(toolDef);
        }
      }
      return;
    }

    // Foundry v12 and legacy Array structure
    if (Array.isArray(controls)) {
      const tokenControls = controls.find((c: any) => c.name === 'tokens' || c.name === 'token');
      if (tokenControls && Array.isArray(tokenControls.tools)) {
        tokenControls.tools.push(toolDef);
      }
    }
  });
}

export function toggleEnabled(): boolean {
  const game = (globalThis as any).game;
  const ui = (globalThis as any).ui;
  const current = game.settings.get(MODULE_ID, SETTINGS.ENABLED);
  const next = !current;
  game.settings.set(MODULE_ID, SETTINGS.ENABLED, next);

  const status = next ? 'Enabled' : 'Disabled';
  const fallback = `Physical Play Dice: ${status}`;
  const key = next ? 'PP_DICE.ToggleEnabled' : 'PP_DICE.ToggleDisabled';
  const localized = game?.i18n?.localize ? game.i18n.localize(key) : undefined;
  const message = localized && localized !== key ? localized : fallback;

  ui?.notifications?.info(message);
  ui?.controls?.render();
  return next;
}
