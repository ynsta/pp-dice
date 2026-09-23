# 0001. Hybrid Roll Interception with Context Providers

**Status:** accepted

## Context
In an in-person setup where the GM operates Foundry on behalf of players whose rolls are made using physical dice, the system must prompt for manual dice entry exclusively on public player rolls. Foundry core includes a `manual` fulfillment setting, but it is global to the client and triggers on every NPC attack, table roll, and monster check. Furthermore, PF2e uses specialized `CheckRoll` and `DamageRoll` subclasses with custom traits and party concepts.

## Decision
We implement a hybrid architecture:
1. Wrap Foundry's roll evaluation (`Roll.prototype._evaluate`) via `libWrapper`.
2. Extract execution context (Actor, Party status, RollMode, Secrecy) via a pluggable `ContextManager`.
3. Provide a dedicated `PF2eContextProvider` that inspects `game.actors.party`, actor alliances, and the `secret` trait.
4. Fall back to a `GenericContextProvider` using `actor.hasPlayerOwner` for other game systems.
5. Render dialogs via Foundry v14's native `ApplicationV2`.

## Consequences
- **Positive:** Deep, native-feeling integration with PF2e while preserving system-agnostic fallback.
- **Positive:** Secret rolls remain hidden from players and GM effortlessly.
- **Positive:** Zero overhead and zero disruption for NPC turns and GM actions.
- **Negative:** Requires maintaining lightweight adapter shims if Foundry or PF2e internals undergo major redesigns.

## Alternatives Rejected
- **Pure Core Manual Setting:** Overly intrusive; triggers on all GM and monster rolls.
- **Post-Roll Hooking (`preCreateChatMessage`):** Too late in lifecycle; critical calculation and roll breakdowns are already computed prior to chat card creation.
