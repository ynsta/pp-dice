# Specification: Physical Dice Interception

## 1. Core Behavior

The module intercepts dice roll evaluation in Foundry VTT v14 to prompt the Game Master for physical dice results rolled by players around a physical gaming table.

## 2. Trigger Criteria

A roll prompts for manual fulfillment if and only if:

1. `pp-dice` is active (not toggled off).
2. The roll originates from a **Player Character** (Party member or player-owned character).
3. The roll is **Public** (`publicroll`).

## 3. Automatic Bypass Criteria

A roll immediately evaluates via digital RNG without user prompting if:

1. The roll originates from an NPC or GM-owned non-player actor.
2. The roll is **Secret / Blind** (`blindroll`, `gmroll`, or has the PF2e `secret` trait like Recall Knowledge or Stealth).
3. The GM presses `Space` or clicks "Roll Digital" in the resolver popup.
4. The user toggles `pp-dice` off via scene controls or shortcut (`Alt+P`).

## 4. Evaluation and Calculation

Injected values replace the raw die face results within the `DiceTerm` objects. Foundry's Abstract Syntax Tree (AST) and system modifiers (such as PF2e Multiple Attack Penalty, ability modifiers, and item bonuses) are computed on the resulting sum without modification to game logic.

## 5. Advanced Mechanics

### 5.1 Fortune & Misfortune (Advantage / Disadvantage)

When a check involves `2d20kh` (Fortune / keep-higher) or `2d20kl` (Misfortune / keep-lower):

- The input UI displays an explicit badge (`Fortune` / `Misfortune`).
- Input fields for both physical dice are prompted.
- Foundry's AST evaluator automatically retains the highest or lowest result per system rules.

### 5.2 Sequential Roll Queue

When multiple rolls trigger near-simultaneously (such as AoE saving throws for several party members):

- Rolls are queued sequentially.
- Dialogs open one after another without overlap or focus collisions.

### 5.3 Chat Log Badges & 3D Dice (Dice So Nice)

- Rolls fulfilled with physical dice receive a `FLAGS.PHYSICAL_ROLL` flag.
- When enabled, a `Physical Roll` badge appears in the chat message header.
- When `animateDSN` is enabled and Dice So Nice is installed, 3D dice animate and land on the physical numbers entered.
