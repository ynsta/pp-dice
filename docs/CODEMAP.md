# Code Map: `pp-dice`

## Overview

Module for physical dice roll interception in Foundry VTT v14 with deep Pathfinder 2e support.

## UI Singletons (do not duplicate)

- Physical Dice Input Modal $\rightarrow$ `PPDiceResolver` (`src/ui/pp-dice-resolver.ts`). ONE unified `ApplicationV2` modal for manual dice fulfillment.
- Toggle Control $\rightarrow$ `registerControls` (`src/ui/controls.ts`). Single keybinding and scene control toggle.

## Directory Map

```
pp-dice/
├── src/
│   ├── main.ts                    # Module initialization, settings registration, chat message hooks
│   ├── constants.ts               # Module ID, settings keys, and roll flag constants
│   ├── module.json                # Foundry VTT v14 manifest
│   ├── core/
│   │   ├── context-manager.ts     # Resolves actor/party context and determines interception eligibility
│   │   ├── interceptor.ts         # libWrapper hook, sequential roll queue, term value injection
│   │   └── roll-helpers.ts        # Secret roll detection, fortune modifier detection, player token resolution
│   ├── providers/
│   │   ├── base.ts                # RollContextProvider interface and RollEvaluationContext
│   │   ├── pf2e.ts                # PF2e party actor, alliance, secret trait, and fortune detection
│   │   └── generic.ts             # Fallback provider using actor.hasPlayerOwner and character type
│   ├── ui/
│   │   ├── chat-badge.ts          # Chat message badge DOM injection (renderChatMessageHTML)
│   │   ├── controls.ts            # Alt+P keybinding and scene controls toggle tool
│   │   └── pp-dice-resolver.ts    # ApplicationV2 Handlebars dialog for physical dice input
│   ├── styles/
│   │   └── pp-dice.css            # Dark theme styles for resolver modal and chat badges
│   └── types/
│       ├── env.d.ts               # Vite environment definitions
│       └── foundry.d.ts           # Type definitions for Foundry Actor, Token, Roll, DiceTerm
├── templates/
│   └── dice-resolver.hbs          # Handlebars template for physical dice input dialog
├── lang/
│   ├── en.json                    # English translations
│   └── fr.json                    # French translations
├── tests/
│   ├── chat-badge.test.ts         # Tests for chat badge DOM rendering and deduplication
│   ├── context-manager.test.ts    # Unit tests for party detection and roll filtering
│   ├── controls.test.ts           # Scene controls and keybinding registration tests
│   ├── generic.test.ts            # Unit tests for generic Foundry actor and initiative resolution
│   ├── interceptor.test.ts        # Unit tests for term extraction, injection, queueing, and initiative wrappers
│   ├── pf2e.test.ts               # Unit tests for PF2e/SF2e party, identifier, and initiative resolution
│   ├── resolver.test.ts           # Resolver dialog tests, input validation, and keyboard shortcuts
│   └── roll-helpers.test.ts       # Unit tests for secret roll and fortune detection helpers
└── docs/                          # Documentation plane (user-guide, spec, design, adr, dev)
```
