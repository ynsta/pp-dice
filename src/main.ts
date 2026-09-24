import { FLAGS, MODULE_ID, SETTINGS } from './constants';
import { registerInterception, registerInitiativeInterception } from './core/interceptor';
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

  // Register roll and initiative interception
  registerInterception();
  registerInitiativeInterception();
});

export function onDiceSoNiceMessagePreProcess(
  messageId: string,
  interception: { willTrigger3DRoll: boolean }
): void {
  const game = (globalThis as any).game;
  const animateDSN = game?.settings?.get(MODULE_ID, SETTINGS.ANIMATE_DSN) ?? true;
  if (!animateDSN && interception) {
    const msg = game?.messages?.get?.(messageId);
    if (msg?.rolls?.some((r: any) => r?.options?.[FLAGS.PHYSICAL_ROLL])) {
      interception.willTrigger3DRoll = false;
    }
  }
}

export function onPreCreateChatMessage(message: any): void {
  const game = (globalThis as any).game;
  const animateDSN = game?.settings?.get(MODULE_ID, SETTINGS.ANIMATE_DSN) ?? true;
  if (!animateDSN && message?.rolls?.some((r: any) => r?.options?.[FLAGS.PHYSICAL_ROLL])) {
    if (typeof message.updateSource === 'function') {
      message.updateSource({ 'flags.dice-so-nice.skip': true });
    } else {
      message.flags = message.flags || {};
      message.flags['dice-so-nice'] = message.flags['dice-so-nice'] || {};
      message.flags['dice-so-nice'].skip = true;
    }
  }
}

Hooks?.once('ready', () => {
  // Register scene controls button
  registerSceneControls();

  // Ensure initiative wrappers are bound if system initialized after module init
  registerInitiativeInterception();

  // Register DSN animation suppression hooks
  Hooks.on('diceSoNiceMessagePreProcess', onDiceSoNiceMessagePreProcess);
  Hooks.on('preCreateChatMessage', onPreCreateChatMessage);

  // Register chat badge renderer with modern Foundry v13/v14 hook
  Hooks.on('renderChatMessageHTML', (message: any, html: HTMLElement) => {
    renderChatBadge(message, html);
  });

  console.log(
    `%c[${MODULE_ID}] v${__APP_VERSION__} Ready! Physical dice interception active for player rolls.`,
    'color: #00aa44; font-weight: bold;'
  );
});
