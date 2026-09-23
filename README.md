# Physical Play Dice (`pp-dice`)

[![Foundry VTT v14](https://img.shields.io/badge/Foundry-v14-orange.svg)](https://foundryvtt.com)
[![PF2e Compatible](https://img.shields.io/badge/PF2e-8.5.1+-blue.svg)](https://github.com/foundryvtt/pf2e)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)

**Physical Play Dice** (`pp-dice`) is a Foundry VTT module built for in-person tabletop gaming sessions.

When playing around a physical table with a projector/TV showing the map to players without a HUD (e.g. using [_Monk's Common Display_](https://foundryvtt.com/packages/monks-common-display)), players roll their real physical dice. The GM triggers actions in Foundry on their behalf. `pp-dice` intercepts public player rolls to prompt for the raw physical dice results, allowing Foundry and Pathfinder 2e to automatically calculate all modifiers, multiple attack penalties, criticals, and degrees of success.

<p align="center">
  <img src="docs/images/screenshot00.webp" alt="Physical Roll Input Dialog" width="600" />
</p>

> 📖 **[Read the Complete User Manual & Guide](docs/user-guide.md)** for full workflows, keyboard shortcuts, and configuration.

---

## Features

- **Smart Party & Player Detection**: Automatically identifies player characters via party membership, character type, and token ownership.
- **Selective Interception**:
  - **Public Player Rolls** (Attacks, Saves, Skills, Damage) $\rightarrow$ Fast popup on GM screen to input physical dice.
  - **Secret / Blind Rolls** (Recall Knowledge, Stealth, Secret Perception) $\rightarrow$ Automatically rolls digital RNG (keeps results hidden).
  - **NPC & Monster Rolls** $\rightarrow$ Automatically rolls digital RNG.
- **Keyboard-First Dialog**:
  - Automatically focuses the primary die input.
  - Press `Enter` to confirm roll.
  - Press `Space` or click "Roll Digital" for instantaneous fallback to digital RNG.
  - Grouped inputs for multi-die damage (e.g., 2d6, 3d8).
- **Fortune & Misfortune Support**: Shows clear visual badges (`Fortune — Keep Highest` / `Misfortune — Keep Lowest`) and prompts for both d20 dice.
- **Sequential Queue**: Seamlessly queues rolls when multiple saving throws or actions trigger sequentially (e.g., Area of Effect spells).
- **Chat Log Badges**: Tags manual rolls with a subtle `Physical Roll` badge in chat.
- **Dice So Nice Support**: 3D dice land directly on the numbers rolled physically at the table.
- **Quick Session Toggle**: Press `Alt+P` or use the token control tool to enable/disable interception on the fly.

---

## Recommended Companion Modules

- **[Monk's Common Display](https://foundryvtt.com/packages/monks-common-display)**: Send a clean, HUD-less map and combat view to a shared TV or projector.
- **[Dice So Nice!](https://foundryvtt.com/packages/dice-so-nice)**: Animate 3D dice on the common display that land exactly on the physical results entered by the GM.

---

## Installation

### Manifest URL

In Foundry VTT, navigate to **Configuration and Setup** $\rightarrow$ **Add-on Modules** $\rightarrow$ **Install Module**, and paste the manifest link:

```
https://github.com/ynsta/pp-dice/releases/latest/download/module.json
```

---

## Development & Architecture

### Technical Highlights

- **Roll Interception**: Uses `libWrapper` to wrap `Roll.prototype._evaluate`, injecting physical dice results into `term.results` before evaluation while preserving core AST math, Pathfinder 2e multiple attack penalties, and degrees of success.
- **Modern UI (`ApplicationV2`)**: Built on Foundry v14's `foundry.applications.api.ApplicationV2` with `HandlebarsApplicationMixin` for responsive, accessible keyboard navigation.
- **Context Resolution**: Modular provider architecture (`PF2eContextProvider`, `GenericContextProvider`) checking `game.actors.party.members`, `actor.parties`, and `actor.hasPlayerOwner`.
- **Sequential Queue**: Concurrency-safe queue preventing overlapping modals during multi-target spells.
- **Documentation Plane**: Detailed specifications and architecture design docs are available in [`docs/design/`](docs/design/00-index.md), [`docs/spec/`](docs/spec/00-index.md), and [`docs/adr/`](docs/adr/00-index.md).

### Dev Workflow & Build

Developed in WSL 2 with live synchronization to Windows Foundry.

```bash
# Install dependencies
npm install

# Dev loop with auto-sync to Windows Foundry
npm run dev

# Run unit tests (Vitest)
npm run test

# Run strict linter
npm run lint

# Compile for production
npm run build
```

---

## License

[Apache-2.0](LICENSE) © [ynsta](https://github.com/ynsta)
