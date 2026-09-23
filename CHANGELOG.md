# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
