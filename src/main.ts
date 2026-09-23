import { MODULE_ID, SETTINGS } from './constants';
import { registerInterception } from './core/interceptor';
import { registerKeybindings, registerSceneControls } from './ui/controls';
import { renderChatBadge } from './ui/chat-badge';
import './styles/pp-dice.css';

const Hooks = (globalThis as any).Hooks;

Hooks?.once('init', () => {
  console.log(
    `%c[${MODULE_ID}] Initializing Physical Play Dice...`,
    'color: #ff6400; font-weight: bold;'
  );

  const game = (globalThis as any).game;

  // 1. Enable / Disable setting
  game.settings.register(MODULE_ID, SETTINGS.ENABLED, {
    name: 'PP_DICE.Enabled',
    hint: 'PP_DICE.EnabledHint',
    scope: 'client',
    config: true,
    type: Boolean,
    default: true,
  });

  // 2. Chat Badge setting
  game.settings.register(MODULE_ID, SETTINGS.SHOW_CHAT_BADGE, {
    name: 'PP_DICE.ShowChatBadge',
    hint: 'PP_DICE.ShowChatBadgeHint',
    scope: 'client',
    config: true,
    type: Boolean,
    default: true,
  });

  // 3. Dice So Nice 3D animation setting
  game.settings.register(MODULE_ID, SETTINGS.ANIMATE_DSN, {
    name: 'PP_DICE.AnimateDSN',
    hint: 'PP_DICE.AnimateDSNHint',
    scope: 'client',
    config: true,
    type: Boolean,
    default: true,
  });

  // Register keybindings in init so they show up in Configure Controls
  registerKeybindings();

  // Register roll interception
  registerInterception();
});

// Defensive keybinding registration if module is loaded when init is already running
if ((globalThis as any).game?.keybindings && !(globalThis as any).game?.keybindings?.bindings) {
  registerKeybindings();
}

Hooks?.once('ready', () => {
  // Register scene controls button
  registerSceneControls();

  // Register chat badge renderer
  Hooks.on('renderChatMessage', (message: any, html: any) => {
    renderChatBadge(message, html);
  });

  console.log(
    `%c[${MODULE_ID}] v1.0.9 Ready! Physical dice interception active for player rolls.`,
    'color: #00aa44; font-weight: bold;'
  );
});
