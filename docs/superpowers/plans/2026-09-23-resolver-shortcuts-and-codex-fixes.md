# Resolver Shortcuts, Empty-Enter Digital Roll, and Codex Findings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix dialog shortcuts (`Escape`, `R`), support pressing `Enter` on empty input for immediate digital roll, guarantee `Alt+P` keybinding in Controls Configuration, and resolve Codex review findings H1 (modifier bypass) and M1 (clean error boundary).

**Architecture:** 
1. UI: Remove HTML5 `required` on `<input class="die-input">`. In form submit, if all inputs are empty, execute digital roll (`submitDigital()`). Attach direct `keydown` listener to inputs and frame listener (`_onKeyDown`) to handle `Escape` and `R` even while input has focus.
2. Controls: Register `pp-dice.toggle` cleanly in `init` with standard modifier strings so it categorizes under "Physical Play Dice" in Foundry's Controls Configuration.
3. Interceptor: Remove premature `term._evaluated = true` in `applyPhysicalResults` so Foundry's `_evaluateModifiers` correctly computes keep/drop (`kh`/`kl`). Isolate error boundary so wrapped native evaluation isn't retried with mutated state.

**Tech Stack:** TypeScript, Foundry VTT v14 (ApplicationV2 / ClientKeybindings / DiceTerm), Handlebars, Vitest.

**Spec:** `docs/spec/physical-dice-interception.md`

## Global Constraints
- Node 22+ runtime, ES modules.
- Hard rule: All code, identifiers, comments, tests, docs in English.
- No false "done": re-read files, verify with test/lint/typecheck/build commands.

---

### Task 1: Resolver Keyboard UX & Empty Enter Handling

**Files:**
- Modify: `templates/dice-resolver.hbs`
- Modify: `src/ui/pp-dice-resolver.ts`
- Modify: `lang/en.json`
- Modify: `lang/fr.json`
- Modify: `tests/resolver.test.ts`

**Interfaces:**
- `PPDiceResolverApp._onKeyDown(e: KeyboardEvent)`
- `PPDiceResolver.submitDigital(): void`
- `PPDiceResolver.submitPhysical(values: Map<FoundryDiceTerm, number[]>): void`

- [ ] **Step 1: Write unit tests in `tests/resolver.test.ts` for empty Enter and keyboard actions**

Cover:
- Pressing Enter with empty input triggers digital roll.
- Pressing Enter with entered numbers triggers physical roll.
- Pressing Escape or 'r' / 'R' triggers digital roll.
- Space is suppressed (prevents Foundry pause).

- [ ] **Step 2: Update `templates/dice-resolver.hbs`**
- Remove `required` attribute from `<input type="number" class="die-input" ... />`.
- Update placeholder and hints to reflect that empty Enter / Esc / R triggers digital roll.

- [ ] **Step 3: Update `src/ui/pp-dice-resolver.ts`**
- Implement `_attachFrameListeners` calling `super._attachFrameListeners()` and binding `_onKeyDown`.
- In `_onRender`, attach `keydown` directly to each `input.die-input`.
- In form submit handler, check if all inputs are blank (`val.trim() === ''`). If so, call `this.resolver.submitDigital(); this.close(); return;`.
- Update localization strings in `lang/en.json` and `lang/fr.json`.

- [ ] **Step 4: Run tests**
Run: `npm test tests/resolver.test.ts`
Expected: PASS

---

### Task 2: Keybinding Registration for Controls Configuration

**Files:**
- Modify: `src/ui/controls.ts`
- Modify: `src/main.ts`
- Modify: `tests/controls.test.ts`

**Interfaces:**
- `registerKeybindings(): void`

- [ ] **Step 1: Write test in `tests/controls.test.ts`**
Verify `game.keybindings.register` is called with:
`namespace: 'pp-dice'`, `action: 'toggle'`, `editable: [{ key: 'KeyP', modifiers: ['Alt'] }]`, `restricted: false`.

- [ ] **Step 2: Update `src/ui/controls.ts` and `src/main.ts`**
- In `src/ui/controls.ts`, use clean `'Alt'` modifier and check for existing registration to prevent double-registration.
- In `src/main.ts`, call `registerKeybindings()` inside `Hooks.once('init')` and provide defensive check if evaluated when init is active.

- [ ] **Step 3: Run tests**
Run: `npm test tests/controls.test.ts`
Expected: PASS

---

### Task 3: Fix Dice Modifier Bypass (Codex H1) & Interceptor Error Boundary (Codex M1)

**Files:**
- Modify: `src/core/interceptor.ts`
- Modify: `tests/interceptor.test.ts`

**Interfaces:**
- `applyPhysicalResults(diceTerms: FoundryDiceTerm[], valuesMap: ...): void`
- `interceptRollEvaluation(...)`

- [ ] **Step 1: Write tests for keep/drop (kh/kl) and modifier evaluation in `tests/interceptor.test.ts`**
Verify that `term._evaluated` is NOT set to true before Foundry's modifier evaluation, allowing keep/drop logic to mark inactive dice.

- [ ] **Step 2: Update `applyPhysicalResults` in `src/core/interceptor.ts`**
Remove `term._evaluated = true;`. Populate `term.results = values.map(...)` with `active: true`. Allow Foundry's native evaluator to run `_evaluateModifiers()`.

- [ ] **Step 3: Narrow error handling in `interceptRollEvaluation`**
Catch errors during the user-input prompt (`resolver.awaitInput()`). If that fails, fallback to digital roll. If native evaluation (`wrapped(options)`) fails, do not re-run on mutated state.

- [ ] **Step 4: Run tests**
Run: `npm test tests/interceptor.test.ts`
Expected: PASS

---

### Task 4: Documentation & Deployment Verification

**Files:**
- Modify: `docs/spec/physical-dice-interception.md`
- Modify: `docs/user-guide.md`
- Modify: `CHANGELOG.md`
- Modify: `src/module.json`
- Modify: `package.json`

- [ ] **Step 1: Update documentation**
Document:
- Enter on empty box = immediate digital roll.
- Typing numbers and Enter = physical roll.
- Escape or R = immediate digital roll.
- Alt+P = toggle keybinding configurable in Settings -> Controls Configuration.
- Keep/drop modifiers (`kh`/`kl`) faithfully evaluated by Foundry.

- [ ] **Step 2: Bump version and sync**
Run `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.
Verify live sync to `/mnt/c/Users/stany/AppData/Local/FoundryVTT/Data/modules/pp-dice/`.

---

### Task 5: Security & CI Hardening (Codex M6, M7, M8, L6)

**Files:**
- Modify: `.github/workflows/release.yml`
- Create: `.github/workflows/ci.yml`
- Modify: `package.json`

- [ ] **Step 1: Pin GitHub Actions to commit SHAs in `.github/workflows/release.yml`**
Pin `actions/checkout`, `actions/setup-node`, and `softprops/action-gh-release` with immutable commit SHAs.

- [ ] **Step 2: Add `.github/workflows/ci.yml`**
Create automated verification workflow triggering on `push` to `main` and `pull_request` (test, lint, typecheck, format check, build).

- [ ] **Step 3: Clean unused dependencies and audit**
Remove unused `fs-extra` from `package.json`. Run audit checks.
