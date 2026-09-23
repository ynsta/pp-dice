# Specification: Physical Dice Interception

## 1. Core Behavior

The module intercepts dice roll evaluation in Foundry VTT v14 to prompt the Game Master for physical dice results rolled by players at the table.

## 2. Trigger Criteria

A roll prompts for manual fulfillment if and only if:

1. `pp-dice` is active (not toggled off).
2. The roll originates from a **Player Character** (Party member or player-owned character).
3. The roll is **Public** (`publicroll`).

## 3. Automatic Bypass Criteria

A roll immediately evaluates via digital RNG without user prompting if:

1. The roll originates from an NPC or GM-owned non-player actor.
2. The roll is **Secret / Blind** (`blindroll`, `gmroll`, or has the PF2e `secret` trait).
3. The GM presses `Space` or clicks "Digital Roll" in the resolver popup.
4. The user toggles `pp-dice` off via scene controls or shortcut (`Alt+P`).

## 4. Evaluation and Calculation

Injected values replace the raw die face results within the `DiceTerm` objects. Foundry's Abstract Syntax Tree (AST) and system modifiers (such as PF2e Multiple Attack Penalty, ability modifiers, and item bonuses) are computed on the resulting sum without modification to game logic.
