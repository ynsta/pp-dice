# Architecture: `pp-dice`

## Overview

`pp-dice` bridges physical tabletop dice rolling with Foundry VTT's automated math engine.

```mermaid
flowchart TD
    Trigger["Roll Triggered in Foundry\n(Check / Strike / Save / Damage)"] --> Eval["Roll.prototype._evaluate()"]
    Eval --> Hook["libWrapper / InterceptorEngine"]
    Hook --> CheckActive{"Module Enabled?"}
    CheckActive -- No --> RNG["Native Digital RNG"]
    CheckActive -- Yes --> Ctx["ContextManager\n(PF2eProvider / GenericProvider)"]
    Ctx --> CheckPlayer{"Actor is Player / Party?"}
    CheckPlayer -- "No (NPC/GM)" --> RNG
    CheckPlayer -- "Yes (PC)" --> CheckSecret{"Roll is Secret / Blind?"}
    CheckSecret -- "Yes (blindroll / gmroll / secret trait)" --> RNG
    CheckSecret -- "No (Public Roll)" --> Queue["Sequential Roll Queue"]
    Queue --> Resolver["PPDiceResolver (ApplicationV2)"]
    Resolver --> Choice{"User Action"}
    Choice -- "Enter Numbers + Submit" --> Inject["Inject Physical Results into DiceTerms"]
    Choice -- "Esc / R / Empty Enter / Click Digital" --> RNG
    Inject --> Finalize["Native AST Evaluation\nModifiers, Degree of Success, Chat Card"]
```

## Subsystem Architecture

### 1. Context Resolution (`src/core/context-manager.ts`)

- Pluggable architecture implementing `RollContextProvider`.
- **`PF2eContextProvider`**:
  - Direct integration with PF2e Party: `game.actors.party.members`, `actor.parties`, and `actor.system.details.alliance === "party"`.
  - Secrecy inspection: checks `roll.options.domains`, `roll.options.traits` for `"secret"`, and message modes (`"blind"`, `"gm"`, `"self"`).
  - Fortune/Misfortune inspection: checks `roll.options.rollTwice` and `DiceTerm.modifiers` (`kh`/`kl`) on d20 terms.
- **`GenericContextProvider`**:
  - Fallback inspecting `actor.hasPlayerOwner`, `actor.type === "character"`, and `roll.options.rollMode` / `messageMode`.

### 2. Interception & Queue Engine (`src/core/interceptor.ts`)

- Wraps `Roll.prototype._evaluate` via `libWrapper` with fallback monkey-patch.
- **Sub-Roll Bypass**: Bypasses rolls with `_root` set to avoid prompting for internal sub-rolls.
- **Sequential Promise Queue (`queueChain`)**: Prevents overlapping modals when multiple checks trigger simultaneously.
- **Term Injection (`applyPhysicalResults`)**: Replaces `results` array on target `DiceTerm` instances with active results (leaving `_evaluated` for Foundry's native modifier evaluation), and passes `allowInteractive: false` to the wrapped evaluation.

### 3. User Interface (`src/ui/pp-dice-resolver.ts`)

- Implemented with Foundry v14 **`foundry.applications.api.ApplicationV2`** and `HandlebarsApplicationMixin`.
- Keyboard-first interaction:
  - First die input focused on render.
  - `Enter` (with numbers): Submit physical values.
  - Press `Escape`, `R`, `Enter` on an empty input, or click "Roll Digital": Immediate RNG fallback.
  - `Space`: Suppressed inside the dialog to prevent accidental canvas pausing while typing.
- Header display with token/actor art, action name, formula, and Fortune/Misfortune badges.

### 4. Integration Hooks (`src/main.ts` & `src/ui/controls.ts`)

- **Keybinding & Scene Controls**: `Alt+P` or token control toggle to enable/disable module on the fly.
- **Chat Badge**: Hooks `renderChatMessageHTML` to display a `Physical` (or `Dés physiques`) badge on rolls carrying `FLAGS.PHYSICAL_ROLL`.
- **Dice So Nice (DSN)**: Physical rolls trigger 3D dice landing on the entered numbers (can be toggled in settings).
