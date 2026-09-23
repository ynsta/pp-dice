# WSL + Windows Foundry Development Workflow

## Environment Layout

- **Source Code & Tooling (WSL 2):** `/path/to/pp-dice`
- **Foundry Data & Runtime (Windows 11):** `/mnt/c/Users/<your-username>/AppData/Local/FoundryVTT/Data/modules/pp-dice`

## Live Synchronization

The build pipeline in `vite.config.ts` reads `foundryconfig.json`. When running in watch mode:

```bash
npm run dev
```

Every change made to TypeScript files, CSS, Handlebars templates, or localization files compiles and mirrors immediately into the Windows Foundry modules folder.

## Reloading in Foundry

Press `F5` in Foundry VTT on Windows to reload the application with the newly compiled module code.
