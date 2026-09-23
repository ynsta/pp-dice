import { MODULE_ID, SETTINGS, FLAGS } from './constants';
import { registerInterception } from './core/interceptor';
import { registerControls } from './ui/controls';
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

  // Register roll interception
  registerInterception();
});

Hooks?.once('ready', () => {
  // Register scene controls & shortcuts
  registerControls();

  // Register chat badge renderer
  Hooks.on('renderChatMessage', (message: any, html: any) => {
    const game = (globalThis as any).game;
    const showBadge = game?.settings?.get(MODULE_ID, SETTINGS.SHOW_CHAT_BADGE) ?? true;
    if (!showBadge) return;

    const isPhysical = message.rolls?.some((r: any) => r.options?.[FLAGS.PHYSICAL_ROLL]);
    if (isPhysical) {
      const element = html instanceof HTMLElement ? html : (html[0] ?? html);
      if (!element) return;

      const badge = document.createElement('span');
      badge.className = 'pp-dice-chat-tag';
      badge.innerHTML = `<i class="fa-solid fa-dice-d20"></i> ${game.i18n.localize('PP_DICE.PhysicalBadge')}`;

      const target =
        element.querySelector('.message-header .message-metadata') ||
        element.querySelector('.message-header');
      target?.prepend(badge);
    }
  });

  console.log(
    `%c[${MODULE_ID}] Ready! Physical dice interception active for player rolls.`,
    'color: #00aa44; font-weight: bold;'
  );
});
