import { MODULE_ID, SETTINGS } from './constants';
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

  // Register settings
  game.settings.register(MODULE_ID, SETTINGS.ENABLED, {
    name: 'PP_DICE.Enabled',
    hint: 'PP_DICE.EnabledHint',
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
  console.log(
    `%c[${MODULE_ID}] Ready! Physical dice interception active for player rolls.`,
    'color: #00aa44; font-weight: bold;'
  );
});
