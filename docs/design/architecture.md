# Architecture: `pp-dice`

## Overview

`pp-dice` bridges physical tabletop dice rolling with Foundry VTT's automated math engine.

```
+-----------------------------------------------------------+
|                      Foundry VTT v14                      |
|                                                           |
|   Roll.prototype._evaluate()                              |
|          |                                                |
|          v                                                |
|   [libWrapper Hook] ---> InterceptorEngine                |
|                                |                          |
|                                v                          |
|                        ContextManager                     |
|                        /            \                     |
|                 PF2eProvider     GenericProvider          |
|                                                           |
|          +--------------------------------------+         |
|          | Roll is Player + Public?             |         |
|          |   NO  ---> Delegate to native RNG    |         |
|          |   YES ---> PPDiceResolver (AppV2)    |         |
|          +--------------------------------------+         |
|                                |                          |
|                                v                          |
|                       TermInjector                        |
|                                |                          |
|                                v                          |
|                       Native AST Evaluation               |
+-----------------------------------------------------------+
```

## Key Components

1. **`ContextManager`**: Queries registered `RollContextProvider`s to extract the initiating Actor, Token, RollMode, and Secrecy flags.
2. **`PF2eProvider`**: Extracts party membership (`game.actors.party`, `actor.parties`, `alliance: "party"`), action names, and `secret` traits.
3. **`GenericProvider`**: Fallback analyzing `actor.hasPlayerOwner` and `actor.type === "character"`.
4. **`InterceptorEngine`**: Hooks into Foundry's roll fulfillment pipeline to pause digital evaluation and request physical input.
5. **`PPDiceResolver`**: Modern `ApplicationV2` with `HandlebarsApplicationMixin` presenting a sleek, keyboard-driven dialog.
