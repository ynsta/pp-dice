# Development Guide: `pp-dice`

## Overview

`pp-dice` (Physical Play Dice) is a Foundry VTT v14 module developed inside WSL 2 and synchronized to a Windows Foundry installation.

## Prerequisites

- Node.js >= 22 (inside WSL)
- Foundry VTT v14 build 368+ installed on Windows
- Pathfinder 2e (PF2e) system installed in Foundry

## Setup & Configuration

1. Clone or navigate to the repository in WSL:
   ```bash
   cd ~/Work/pp-dice
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Verify or adjust `foundryconfig.json`:
   ```json
   {
     "dataPath": "/mnt/c/Users/stany/AppData/Local/FoundryVTT/Data"
   }
   ```

## Development Loop

- **Watch & Sync**: Run continuous compilation and auto-sync to Windows Foundry:
  ```bash
  npm run dev
  ```
- In Foundry VTT on Windows, press `F5` to reload changes instantly.

## Verification & Quality Gates

Before committing, ensure all quality checks pass:

```bash
npm run test         # Vitest unit tests
npm run lint         # ESLint with --max-warnings 0
npm run typecheck    # TypeScript compiler check
npm run format:check # Prettier formatting check
```

## Documentation Map

- `docs/spec/`: Current-state behavior specifications (WHAT)
- `docs/design/`: Subsystem architecture (HOW)
- `docs/adr/`: Architectural Decision Records (WHY)
- `docs/dev/`: Developer workflows and setup
