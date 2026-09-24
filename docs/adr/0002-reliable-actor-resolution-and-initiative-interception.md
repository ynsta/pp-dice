# 0002. Reliable Actor Resolution Hierarchy and Initiative Interception

**Status:** accepted

## Context

In in-person tabletop sessions where the GM operates Foundry on behalf of physical dice-rolling players, two major integration failure modes were observed:

1. **Standard rolls (attacks, checks, saves) failing to intercept:**
   - Players roll from their character sheets or macros without an active canvas token selected (`canvas.tokens.controlled.length === 0`), or with an unrelated token selected.
   - Initial naive heuristics either required `hasPlayerOwner === true` or relied exclusively on `canvas.tokens.controlled`. In solo/in-person GM play, character sheets (e.g. Ezren) are controlled directly by the GM without separate Foundry player user accounts (`hasPlayerOwner === false`).
   - Requiring explicit targets or controlled tokens caused silent bypass (`actor === null`).

2. **Initiative rolls failing to intercept:**
   - Triggering initiative from the Combat Tracker ("Roll All", "Roll All PCs", or combatant d20) selects no token on the canvas.
   - Core Foundry's `Combatant.prototype.getInitiativeRoll` generates rolls using `this.actor.getRollData()`, which strips the `Actor` and `Combatant` document instances from the roll.
   - PF2e's `Check.roll` receives context `{ actor, token, combatant, type: 'initiative' }`, but strips `actor` and `combatant` when instantiating `CheckRoll` options.
   - Furthermore, batch rolls ("Roll All") execute concurrently via `Promise.all`, causing modal collisions if dialogs are not queued sequentially.

## Decision

We establish an immutable resolution hierarchy and upstream initiative tagging:

### 1. Actor Resolution Hierarchy

When `Roll.prototype._evaluate` executes, the actor is resolved in strict order of specificity:

1. **Direct roll data:** `roll.data.actor` or `roll.data.token.actor`.
2. **Tagged / Active check context:** `(roll as any)._actor`, `(roll as any)._combatant?.actor`, or `getPf2eActiveCheckContext()`.
3. **Identifier UUID / Item resolution:** `roll.options.identifier`.
   - If UUID (`Actor.*` or `Scene.*`): resolved via `fromUuidSync`.
   - If Item ID (e.g. `itemId.strike.melee`): search `game.actors` for the item owner.
4. **Canvas token fallback:** used _only_ if exactly 1 token is controlled on the canvas (`canvas.tokens.controlled.length === 1`).
5. **Assigned user character:** `game.user.character` (if non-GM client).
6. **Open character sheet:** inspection of rendered actor sheets in `ui.windows`.

### 2. Character Classification for In-Person Play

To distinguish player characters from NPCs when the GM operates all sheets:

- An actor is considered a player character if `actor.hasPlayerOwner === true || actor.type === 'character' || actor.isOfType?.('character')`.
- NPCs (`actor.type === 'npc'`) and GM utilities are strictly excluded.

### 3. Upstream Initiative Interception Wrappers

Rather than attempting to guess actor context at evaluation time:

- **Foundry Core (`Combatant.prototype.getInitiativeRoll`):** Wrapped via `libWrapper` (with monkey-patch fallback) to tag the generated roll with `_actor = this.actor`, `_combatant = this`, and `options.type = 'initiative'`.
- **PF2e / SF2e (`Check.roll`):** Wrapped to track the active check context during execution and inject `context.identifier = context.actor.uuid` if unset.
- **Dual Hook Registration:** Bound on both `init` and `ready` hooks to defend against late-initializing game system classes.

### 4. Sequential Promise Queue (`queueChain`)

When multiple rolls evaluate concurrently (such as "Roll All PCs"):

- Interception awaits the previous resolution before opening the next dialog.
- Player character initiative rolls prompt sequentially one-by-one (`"<Actor Name> — Initiative"`).
- NPC initiative rolls evaluate immediately with native digital RNG without prompting the GM.

## Consequences

- **Positive:** Unselected tokens, character sheet rolls, and Combat Tracker initiative rolls work reliably across Foundry core, PF2e, and SF2e.
- **Positive:** In-person tabletop setups with zero configured player user accounts function identically to multi-user setups.
- **Positive:** NPC initiative rolls remain 100% automated with zero GM interruption.
- **Negative:** Requires maintaining lightweight upstream wrappers on `Combatant.prototype.getInitiativeRoll` and `Check.roll`.

## Alternatives Tested & Rejected

1. **Relying solely on `canvas.tokens.controlled`:**
   - _Failed:_ Rolling from open sheets or the combat tracker rarely coincides with token selection on canvas.
2. **Requiring `hasPlayerOwner === true`:**
   - _Failed:_ Breaks in-person games where players don't log in via separate browser windows.
3. **Delaying initiative resolution until `_evaluate` without upstream tagging:**
   - _Failed:_ By the time `_evaluate` runs, roll options in core and PF2e have discarded the actor reference.
4. **Parallel modal rendering:**
   - _Failed:_ Browser dialogs overlap and steal focus when multiple PCs roll simultaneously.
