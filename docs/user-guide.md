# Physical Play Dice (`pp-dice`) — User Manual & Guide

Welcome to the comprehensive user manual for **Physical Play Dice (`pp-dice`)**, a module built specifically for **in-person tabletop gaming sessions** with Foundry Virtual Tabletop v14.

---

## 1. Tabletop Concept & Philosophy

When playing tabletop RPGs around a physical table, many groups enjoy:

- The tactile sensation of rolling physical dice.
- Looking at a shared TV, monitor, or projector showing the battlemap without clutter or player HUDs (e.g. using [Monk's Common Display](https://foundryvtt.com/packages/monks-common-display)).
- Letting the GM operate Foundry VTT on a secondary screen to run combats, measure ranges, and manage initiative.

However, standard Foundry VTT rolls rely on a digital random number generator (RNG). Entering physical rolls manually by modifying character sheets or typing `/r` formulas slows down play and bypasses system automation.

**`pp-dice` solves this problem with hybrid interception:**
Players roll their physical dice at the table. When the GM clicks an action (attack, save, skill, damage) on Foundry, `pp-dice` opens a fast, keyboard-first modal asking for the raw dice results. Foundry and Pathfinder 2e then calculate all modifiers, multiple attack penalties, criticals, and degrees of success automatically.

<p align="center">
  <img src="images/screenshot00.webp" alt="Physical Roll Input Dialog" width="600" />
</p>

---

## 2. Requirements & Installation

### Requirements

- **Foundry VTT**: Version 14 (Build 14.360+, verified on 14.368+).
- **Game System**: Pathfinder 2e (v8.5.1+) or System-Agnostic Core d20 rolls.
- **Required Library**: [`lib-wrapper`](https://foundryvtt.com/packages/lib-wrapper) (ensures reliable, conflict-free interception of Foundry roll evaluation).

### Installation via Manifest

1. In Foundry VTT, go to **Configuration and Setup** $\rightarrow$ **Add-on Modules**.
2. Click **Install Module**.
3. Paste the manifest URL into the **Manifest URL** field:
   ```text
   https://github.com/ynsta/pp-dice/releases/latest/download/module.json
   ```
4. Click **Install**.
5. Launch your world and enable **Physical Play Dice** in **Manage Modules**.

---

## 3. Recommended In-Person Setup

For the smoothest in-person gaming experience, pair `pp-dice` with:

| Module                                                                            | Purpose                                                                                             |
| --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| **[Monk's Common Display](https://foundryvtt.com/packages/monks-common-display)** | Broadcasts a clean player view (no sidebar, no macros, no GM tools) to a shared TV or projector.    |
| **[Dice So Nice!](https://foundryvtt.com/packages/dice-so-nice)**                 | Simulates 3D physics dice on screen that land directly on the numbers rolled at the physical table. |

---

## 4. How It Works

### Smart Player & Party Detection

`pp-dice` automatically determines whether a roll belongs to a player character:

- In **Pathfinder 2e**: Checks party membership (`game.actors.party.members`, `actor.parties`, or alliance set to `"party"`).
- In **Generic/Core**: Checks if the actor has a player owner (`actor.hasPlayerOwner`) or character type.

### Selective Interception Rules

```
                      ┌────────────────────────┐
                      │   Action / Roll Made   │
                      └───────────┬────────────┘
                                  │
                   Is Player Actor & Enabled?
                                  │
                 ┌────────────────┴────────────────┐
                 │ YES                             │ NO (NPC / Monster)
                 ▼                                 ▼
         Is Secret / Blind?                   Digital Roll
                 │                           (Core Foundry RNG)
         ┌───────┴────────┐
         │ NO             │ YES
         ▼                ▼
    GM Input Modal   Digital Roll
   (Physical Dice)  (Keeps Secret)
```

- **Public Player Rolls** (Attacks, Saves, Skills, Perception, Damage) $\rightarrow$ **Intercepted**. The GM dialog pops up to accept the physical dice.
- **Secret / Blind Rolls** (Recall Knowledge, Stealth, Secret Perception, Sense Motive) $\rightarrow$ **Digital Fallback**. Evaluated via digital RNG so the GM and players do not inadvertently learn secret information.
- **NPC & Monster Rolls** $\rightarrow$ **Digital Fallback**. The GM never needs to enter numbers for monsters, keeping enemy turns fast.

---

## 5. Using the Dice Resolver Modal

When a roll is intercepted, the `PPDiceResolver` dialog opens instantly:

1. **Autofocus**: The cursor is immediately placed inside the primary die field. You do not need to click with the mouse.
2. **Key Shortcuts**:
   - **`Enter`**: Submit the entered physical values and complete the roll.
   - **`Space`** or **Roll Digital**: Instantly abort physical entry and roll digital RNG (convenient if a player forgot to roll or prefers digital).
   - **`Tab`**: Move between multiple dice inputs (e.g. 2d6 damage).
3. **Multi-Die Groups**: For multi-die rolls (such as `3d6` fire damage or `2d8` striking weapon), separate input boxes are provided for each die.
4. **Validation**: Enforces valid face ranges (e.g. 1–20 for a d20, 1–6 for a d6).

### Fortune & Misfortune

If a Pathfinder 2e roll has the **Fortune** or **Misfortune** trait (or 5e advantage/disadvantage):

- The modal displays an amber badge: `Fortune — Keep Highest` or `Misfortune — Keep Lowest`.
- Two d20 fields are provided for the player's two physical dice.
- Foundry/PF2e applies the highest or lowest value according to the game rules.

### Area of Effect (AoE) & Sequential Queue

When a dragon breathes fire on 4 party members, 4 Reflex saves trigger back-to-back:

- `pp-dice` queues each roll sequentially.
- As soon as the GM confirms Player 1's physical roll, the dialog transitions to Player 2, then Player 3, etc.
- No dialog overlapping or lost rolls.

### Chat Log Feedback

When a roll is completed using physical input, a discrete **`Physical Roll`** badge is affixed to the chat message header, clearly indicating the result was verified from a physical table roll.

---

## 6. Controls & Hotkeys

- **`Alt+P`**: Global hotkey to quickly enable or disable physical interception on the fly.
- **Token Scene Controls**: A dedicated dice icon tool button in the left token controls toolbar provides one-click visual toggling with live status indicators.

---

## 7. Troubleshooting & FAQ

#### The dialog does not open when my players roll?

1. Ensure the module is enabled in **Manage Modules**.
2. Check the toggle status via `Alt+P` or the left toolbar button to make sure interception is **Active**.
3. In PF2e, ensure the player actor is assigned to the active **Party** sheet (`game.actors.party`).
4. Ensure the roll is not secret/blind (secret rolls always use digital RNG by design).

#### What if a player accidentally rolls digital or wants to roll digital?

Simply hit `Space` or click **Roll Digital** in the dialog. The module immediately triggers standard core RNG.

#### Does this work with Dice So Nice?

Yes. The 3D dice animation will roll and naturally show the exact numbers you typed into the dialog.
