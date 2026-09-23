# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.9] - 2026-09-23

### Fixed

- Forced vertical column layout for chat card metadata so the physical roll badge always stacks cleanly under the timestamp and delete icon across all systems (including PF2e grid headers).
- Wrapped existing metadata elements inside a dedicated row container (`.pp-dice-meta-row`) and applied `flex-direction: column !important` with high specificity.
- Updated documentation screenshot in `docs/images/screenshot00.webp`.

### Changed

- Repositioned the chat card physical roll badge to stack neatly under the timestamp and trash icon, avoiding horizontal crowding with the character name.
- Shortened badge copy to compact "Physical" (EN) / "Physique" (FR) alongside the d20 die icon.
- Modularized chat badge rendering logic into dedicated `chat-badge.ts` with comprehensive unit tests.

### Added

- Support for empty `Enter` in dice resolver: pressing `Enter` with empty input fields triggers an immediate digital roll.
- Direct input and frame keydown listener for `Escape` and `R` (`KeyR`), ensuring instant digital roll even when input fields are focused.
- Canvas pause suppression: `Space` key events inside the resolver dialog are suppressed to avoid pausing Foundry during input.

### Fixed

- Fixed dice modifier evaluation bypass: physical dice terms no longer set `_evaluated = true` prematurely, allowing Foundry's native `_evaluateModifiers()` to process keep/drop (`kh`/`kl`) modifiers correctly.
- Isolated roll interceptor error boundary: input prompt failures safely fall back to digital rolls, while AST evaluation errors avoid redundant re-execution on mutated term state.
- Standardized `Alt+P` keybinding registration in `init` hook with core modifier formatting so it is reliably listed and customizable in Foundry's **Configure Controls** menu.

## [1.0.4] - 2026-09-23

### Changed

- Added `Escape` (alongside `R`) as an immediate digital roll trigger inside the resolver modal.
- Updated digital button label to `Roll Digital (Esc)` (`Lancer virtuel (Échap)`).

## [1.0.3] - 2026-09-23

### Changed

- Replaced `Space` digital roll shortcut with `R` in resolver modal to avoid conflict with Foundry's default game pause keybinding.
- Blocked `Space` from bubbling to prevent accidental game pauses while entering dice.
- Registered toggle keybinding in `init` hook so `Alt+P` is fully configurable in Foundry's **Configure Controls** menu.
- Added live visual re-rendering of the token control tool button on keypress toggle.

## [1.0.2] - 2026-09-23

### Changed

- Declared module system-agnostic in manifest (`relationships.requires` with `lib-wrapper`, removed system restriction).
- Documented broad system compatibility with primary testing and deep integration on Pathfinder 2e.
- Added comprehensive user manual in `docs/user-guide.md`.

## [1.0.1] - 2026-09-23

### Added

- UI preview screenshot in README documentation.
- Upgraded GitHub Actions workflow to runner actions (`checkout@v7`, `setup-node@v7`, `action-gh-release@v3`).
- Licensed under Apache-2.0.

## [1.0.0] - 2026-09-23

### Added

- Initial project release with TypeScript, Vite, Vitest, ESLint, and Prettier.
- In-person physical play dice roll interception for Foundry VTT v14.
- Pathfinder 2e Party actor and alliance detection.
- Fast keyboard-driven `PPDiceResolver` modal using `ApplicationV2`.
- Fortune & Misfortune trait/formula detection and visual badges.
- Sequential roll queue for multi-target saving throws.
- Chat card badge for manual rolls.
- Dice So Nice 3D dice animation synchronization.
- Automatic WSL-to-Windows Foundry synchronization.
