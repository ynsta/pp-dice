# Opus 5.5 Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement all verified fixes from the Claude Opus 5.5 review (`~/Work/2026-09-23-pp-dice-review-claude-opus-5.5.md`) covering scene controls on v14, resolver error/key capture hardening, secret roll detection, input validation, DSN animation skip, code quality, i18n, privacy, and docs.

**Architecture:**

- Scene controls: defensively adapt to v14 `Record<string, SceneControl>` with `tokens` key and `onChange` callback while retaining backwards compatibility.
- Resolver: catch async dialog render failures to avoid roll queue deadlocks; scope window keydown capture to dialog element or body; validate numeric inputs in `1..faces`.
- Roll Secrecy & Detection: unify secret roll detection (`options.messageMode`, `rollMode`, `core.messageMode` setting) in a shared helper; check `roll._root` for sub-rolls; detect fortune/misfortune via `DiceTerm.modifiers` instead of substring matching; restrict token fallback to player-owned actors.
- DSN Integration: suppress 3D dice via `diceSoNiceMessagePreProcess` hook and `dice-so-nice.skip` chat flag without mutating roll options.
- UI/Chat: adopt `renderChatMessageHTML` with native DOM element construction.

**Tech Stack:** TypeScript, Foundry VTT v14 API, Vitest, Vite.

**Spec:** `docs/spec/physical-dice-interception.md`, `docs/design/architecture.md`, `~/Work/2026-09-23-pp-dice-review-claude-opus-5.5.md`

## Global Constraints

- Target Foundry version floor: `14.360`, verified `14.368`.
- Strictly adhere to TDD: write failing test, verify failure, implement minimal code, verify pass.
- Maintain existing test passing rate (36/36 tests currently pass).
- All code, comments, identifiers, doc strings, and commit messages in English.

---

### Task 1: Fix Scene Controls on Foundry v14 (H1)

**Files:**

- Modify: `src/ui/controls.ts:31-54`
- Test: `tests/controls.test.ts`

**Interfaces:**

- `registerSceneControls(): void`
- Hook `getSceneControlButtons`: handles both `Record<string, any>` (Foundry v13+) and array (v12-). In v13+, uses `controls.tokens.tools` record and `onChange: (event: any, active: boolean) => void`.

- [ ] **Step 1: Write the failing tests for v14 scene controls**

In `tests/controls.test.ts`, add test cases for v14 record-based structure with `tokens` layer and `onChange`:

```ts
it('registers scene control toggle on Foundry v14 record-based controls', () => {
  let registeredHook: ((controls: any) => void) | undefined;
  (globalThis as any).Hooks = {
    on: vi.fn((event: string, callback: any) => {
      if (event === 'getSceneControlButtons') registeredHook = callback;
    }),
  };

  registerSceneControls();
  expect(registeredHook).toBeDefined();

  const v14Controls: Record<string, any> = {
    tokens: {
      name: 'tokens',
      tools: {},
    },
  };

  registeredHook!(v14Controls);

  const tool = v14Controls.tokens.tools['pp-dice-toggle'] || v14Controls.tokens.tools.ppDiceToggle;
  expect(tool).toBeDefined();
  expect(tool.toggle).toBe(true);
  expect(typeof tool.onChange).toBe('function');

  tool.onChange(null, false);
  expect((globalThis as any).game.settings.set).toHaveBeenCalledWith('pp-dice', 'enabled', false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL with `controls.find is not a function` or missing tool property on v14 object.

- [ ] **Step 3: Implement defensive v14/v13 scene controls registration**

In `src/ui/controls.ts`:
Update `registerSceneControls`:

```ts
export function registerSceneControls(): void {
  const game = (globalThis as any).game;
  const Hooks = (globalThis as any).Hooks;

  Hooks?.on('getSceneControlButtons', (controls: any[] | Record<string, any>) => {
    const isEnabled = game?.settings?.get(MODULE_ID, SETTINGS.ENABLED) ?? true;
    const toolDef = {
      name: 'pp-dice-toggle',
      title: 'PP_DICE.ToggleTitle',
      icon: 'fa-solid fa-dice-d20',
      toggle: true,
      active: isEnabled,
      onChange: (_event: any, active: boolean) => {
        game?.settings?.set(MODULE_ID, SETTINGS.ENABLED, active);
      },
      onClick: (toggled: boolean) => {
        game?.settings?.set(MODULE_ID, SETTINGS.ENABLED, toggled);
      },
    };

    // Foundry v13+ Record structure
    if (controls && !Array.isArray(controls) && typeof controls === 'object') {
      const tokensLayer = controls.tokens ?? controls.token;
      if (tokensLayer) {
        if (tokensLayer.tools && !Array.isArray(tokensLayer.tools)) {
          tokensLayer.tools['pp-dice-toggle'] = toolDef;
        } else if (Array.isArray(tokensLayer.tools)) {
          tokensLayer.tools.push(toolDef);
        }
      }
      return;
    }

    // Foundry v12 and legacy Array structure
    if (Array.isArray(controls)) {
      const tokenControls = controls.find((c: any) => c.name === 'tokens' || c.name === 'token');
      if (tokenControls && Array.isArray(tokenControls.tools)) {
        tokenControls.tools.push(toolDef);
      }
    }
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/ui/controls.ts tests/controls.test.ts
git commit -m "fix: support Foundry v14 scene controls Record API (H1)"
```

---

### Task 2: Resolver Async Render Catch & Scoped Keydown Capture (H2 & H3)

**Files:**

- Modify: `src/ui/pp-dice-resolver.ts:42-53, 164-207`
- Test: `tests/resolver.test.ts`

**Interfaces:**

- `PPDiceResolver.renderDialog(): void` catches rejection from `app.render({ force: true })` and triggers `this.submitDigital()`.
- `PPDiceResolverApp._onKeyDown(e: KeyboardEvent): void` checks `this.element?.contains(e.target as Node) || e.target === document.body || e.target === null`.

- [ ] **Step 1: Write failing tests for render rejection and scoped keydown**

In `tests/resolver.test.ts`:

```ts
it('falls back to submitDigital if app.render rejects asynchronously (H2)', async () => {
  const roll = { formula: '1d20', terms: [{ faces: 20, number: 1 }] } as any;
  const context = { title: 'Test' } as any;
  const resolver = new PPDiceResolver(roll, context, roll.terms);

  (globalThis as any).foundry = {
    applications: {
      api: {
        ApplicationV2: class MockApp {
          async render() {
            throw new Error('Async render failure');
          }
        },
      },
    },
  };

  const result = await resolver.awaitInput();
  expect(result.isDigital).toBe(true);
});

it('ignores keydown when target is an outside input like chat (H3)', () => {
  const roll = { formula: '1d20', terms: [] } as any;
  const resolver = new PPDiceResolver(roll, {} as any, []);
  const app = new PPDiceResolverApp(resolver);
  app.element = { contains: vi.fn(() => false) };

  const submitDigitalSpy = vi.spyOn(resolver, 'submitDigital');
  const chatInput = document.createElement('input');

  const event = new KeyboardEvent('keydown', { key: 'r', bubbles: true });
  Object.defineProperty(event, 'target', { value: chatInput });

  app._onKeyDown(event);
  expect(submitDigitalSpy).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL on render rejection test (hangs or unhandled rejection).

- [ ] **Step 3: Implement render error handling and keydown scoping**

In `src/ui/pp-dice-resolver.ts`:

1. In `renderDialog()`:

```ts
  private renderDialog(): void {
    const foundryGlobal = (globalThis as unknown as { foundry?: any }).foundry;
    const foundryApp = foundryGlobal?.applications;

    if (foundryApp?.api?.ApplicationV2) {
      try {
        const app = new PPDiceResolverApp(this);
        const renderPromise = app.render({ force: true });
        if (renderPromise && typeof renderPromise.catch === 'function') {
          renderPromise.catch((err: any) => {
            console.error(`[${MODULE_ID}] Failed to render resolver dialog:`, err);
            this.submitDigital();
          });
        }
      } catch (err) {
        console.error(`[${MODULE_ID}] Error launching resolver dialog:`, err);
        this.submitDigital();
      }
    } else {
      this.submitDigital();
    }
  }
```

2. In `_onKeyDown(e: KeyboardEvent)`:

```ts
  _onKeyDown(e: KeyboardEvent): void {
    const target = e.target as HTMLElement | null;
    const doc = (globalThis as any).document;
    const isInsideDialog = Boolean(this.element && this.element.contains?.(target));
    const isBody = target === doc?.body || target === null;

    if (!isInsideDialog && !isBody) {
      return;
    }

    if (e.code === 'Space') {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    if (e.ctrlKey || e.altKey || e.metaKey) return;

    if (
      e.key === 'Escape' ||
      e.code === 'Escape' ||
      e.key === 'r' ||
      e.key === 'R' ||
      e.code === 'KeyR'
    ) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      this.resolver.submitDigital();
      this.close();
    }
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/ui/pp-dice-resolver.ts tests/resolver.test.ts
git commit -m "fix: catch resolver render rejection and scope keydown capture (H2, H3)"
```

---

### Task 3: Unified Secret Detection, Sub-Roll Bypass, Fortune Check, and Token Overmatch (H4, M4, M5, M6)

**Files:**

- Create: `src/core/roll-helpers.ts`
- Modify: `src/providers/generic.ts`, `src/providers/pf2e.ts`, `src/core/interceptor.ts:31-47`
- Test: `tests/roll-helpers.test.ts`, `tests/context-manager.test.ts`

**Interfaces:**

- `isSecretRoll(roll: any, options?: Record<string, any>): boolean`
  - Checks `options.allowInteractive === false`
  - Checks `roll.options?.isPrivate === true`
  - Checks `options.messageMode ?? roll.options?.messageMode ?? mapLegacy(roll.options?.rollMode) ?? game.settings.get('core', 'messageMode')`
  - Anything other than `'public'` is considered secret.
- `isFortuneRoll(roll: any): boolean`, `isMisfortuneRoll(roll: any): boolean`
  - Checks `term.faces === 20 && term.number === 2 && term.modifiers?.some(...)`
- In `interceptor.ts`: check if `(roll as any)._root` is present; if so, skip interception.
- In providers: require `actor?.hasPlayerOwner` or party membership, only using controlled token if the roll explicitly targets an actor.

- [ ] **Step 1: Write failing tests for roll helpers**

In `tests/roll-helpers.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { isSecretRoll, isFortuneRoll, isMisfortuneRoll } from '../src/core/roll-helpers';

describe('Roll Helpers', () => {
  it('detects secret rolls across v14 messageMode values (H4)', () => {
    expect(isSecretRoll({ options: { messageMode: 'public' } })).toBe(false);
    expect(isSecretRoll({ options: { messageMode: 'gm' } })).toBe(true);
    expect(isSecretRoll({ options: { messageMode: 'blind' } })).toBe(true);
    expect(isSecretRoll({ options: { messageMode: 'self' } })).toBe(true);
    expect(isSecretRoll({ options: { rollMode: 'selfroll' } })).toBe(true);
    expect(isSecretRoll({ options: { rollMode: 'gmroll' } })).toBe(true);
    expect(isSecretRoll({ options: { rollMode: 'blindroll' } })).toBe(true);
    expect(isSecretRoll({ options: { rollMode: 'roll' } })).toBe(false);
  });

  it('detects fortune and misfortune only on 2d20 with modifiers, not flavor text (M5)', () => {
    const khopeshRoll = {
      formula: '1d20 + 5[khopesh]',
      terms: [{ faces: 20, number: 1, modifiers: [] }],
    };
    expect(isFortuneRoll(khopeshRoll)).toBe(false);

    const fortuneRoll = { formula: '2d20kh', terms: [{ faces: 20, number: 2, modifiers: ['kh'] }] };
    expect(isFortuneRoll(fortuneRoll)).toBe(true);

    const misfortuneRoll = {
      formula: '2d20kl',
      terms: [{ faces: 20, number: 2, modifiers: ['kl'] }],
    };
    expect(isMisfortuneRoll(misfortuneRoll)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL because `roll-helpers.ts` does not exist yet.

- [ ] **Step 3: Create `src/core/roll-helpers.ts` and integrate in providers & interceptor**

Create `src/core/roll-helpers.ts`:

```ts
export function mapLegacyRollMode(rollMode?: string): string | undefined {
  switch (rollMode) {
    case 'publicroll':
    case 'roll':
      return 'public';
    case 'gmroll':
      return 'gm';
    case 'blindroll':
      return 'blind';
    case 'selfroll':
      return 'self';
    default:
      return rollMode;
  }
}

export function isSecretRoll(roll: any, options: Record<string, any> = {}): boolean {
  if (options.allowInteractive === false) return true;
  if (roll.options?.isPrivate === true) return true;

  const game = (globalThis as any).game;
  const rawMode =
    options.messageMode ??
    roll.options?.messageMode ??
    mapLegacyRollMode(roll.options?.rollMode) ??
    game?.settings?.get?.('core', 'messageMode') ??
    'public';

  const mode = mapLegacyRollMode(rawMode);
  if (mode && mode !== 'public') {
    return true;
  }

  // Check PF2e traits or domains if present
  const domains = roll.options?.domains;
  if (Array.isArray(domains) && domains.includes('secret')) return true;

  const traits = roll.options?.traits;
  if (Array.isArray(traits) && traits.includes('secret')) return true;

  return false;
}

export function isFortuneRoll(roll: any): boolean {
  if (roll.options?.rollTwice === 'keep-higher') return true;
  const domains = roll.options?.domains;
  if (Array.isArray(domains) && domains.includes('fortune')) return true;

  if (Array.isArray(roll.terms)) {
    return roll.terms.some(
      (t: any) =>
        t &&
        t.faces === 20 &&
        t.number === 2 &&
        Array.isArray(t.modifiers) &&
        t.modifiers.some((m: string) => m.toLowerCase() === 'kh' || m.toLowerCase() === 'kh1')
    );
  }
  return false;
}

export function isMisfortuneRoll(roll: any): boolean {
  if (roll.options?.rollTwice === 'keep-lower') return true;
  const domains = roll.options?.domains;
  if (Array.isArray(domains) && domains.includes('misfortune')) return true;

  if (Array.isArray(roll.terms)) {
    return roll.terms.some(
      (t: any) =>
        t &&
        t.faces === 20 &&
        t.number === 2 &&
        Array.isArray(t.modifiers) &&
        t.modifiers.some((m: string) => m.toLowerCase() === 'kl' || m.toLowerCase() === 'kl1')
    );
  }
  return false;
}
```

Update `src/core/interceptor.ts`:
Check `if ((roll as any)._root) return wrapped(options);` at the top of `interceptRollEvaluation`.

Update `src/providers/generic.ts` and `src/providers/pf2e.ts`:
Use `isSecretRoll`, `isFortuneRoll`, `isMisfortuneRoll`, and tighten controlled-token fallback (require `hasPlayerOwner`).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/roll-helpers.ts src/core/interceptor.ts src/providers/generic.ts src/providers/pf2e.ts tests/roll-helpers.test.ts tests/context-manager.test.ts
git commit -m "fix: normalize secret roll detection, fortune term check, sub-roll bypass (H4, M4, M5, M6)"
```

---

### Task 4: Input Validation in Resolver (M1)

**Files:**

- Modify: `src/ui/pp-dice-resolver.ts:250-307`
- Modify: `src/core/interceptor.ts:96-113`
- Test: `tests/resolver.test.ts`, `tests/interceptor.test.ts`

**Interfaces:**

- In resolver submit: if any field is populated, all populated fields must be integers within `1..faces`. If any field is invalid or out of range, show validation error, do not submit silent random dice as physical.
- In `applyPhysicalResults`: clamp each number to `[1, term.faces]`.

- [ ] **Step 1: Write failing test for input validation and partial entry**

In `tests/resolver.test.ts`:

```ts
it('rejects values out of range (greater than faces or <= 0) and does not call submitPhysical', () => {
  const roll = { formula: '1d6', terms: [{ faces: 6, number: 1 }] } as any;
  const resolver = new PPDiceResolver(roll, {} as any, roll.terms);
  const app = new PPDiceResolverApp(resolver);

  const form = document.createElement('form');
  const input = document.createElement('input');
  input.className = 'die-input';
  input.name = 'die_0_0';
  input.value = '99'; // Out of range for d6
  form.appendChild(input);
  app.element = form;

  const submitPhysicalSpy = vi.spyOn(resolver, 'submitPhysical');
  const event = new Event('submit', { cancelable: true });
  form.dispatchEvent(event);

  expect(submitPhysicalSpy).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL (currently submits 99 or silently falls back to random).

- [ ] **Step 3: Implement validation in `pp-dice-resolver.ts` and clamping in `interceptor.ts`**

In `src/ui/pp-dice-resolver.ts`:
On submit:

1. Verify if any value is out of range (`num < 1 || num > term.faces || !Number.isInteger(num)`).
2. If invalid, highlight the input or show error and `return`.
3. If partial (some blank while others filled), show error or prevent silent RNG badged as Physical.

In `src/core/interceptor.ts`:
In `applyPhysicalResults`:

```ts
export function applyPhysicalResults(
  diceTerms: FoundryDiceTerm[],
  valuesMap: Map<FoundryDiceTerm, number[]> | Record<string, number[]>
): void {
  for (const term of diceTerms) {
    const values =
      valuesMap instanceof Map
        ? valuesMap.get(term)
        : (valuesMap as Record<string, number[]>)[term.id ?? term.denomination ?? ''];

    if (Array.isArray(values) && values.length > 0) {
      term.results = values.map((val) => {
        const num = Math.min(Math.max(1, Math.floor(Number(val))), term.faces);
        return {
          result: num,
          active: true,
        };
      });
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/ui/pp-dice-resolver.ts src/core/interceptor.ts tests/resolver.test.ts tests/interceptor.test.ts
git commit -m "fix: validate physical dice inputs and clamp values in applyPhysicalResults (M1)"
```

---

### Task 5: Proper DSN 3D Animation Skip & `renderChatMessageHTML` (M2, M3)

**Files:**

- Modify: `src/main.ts:59-72`
- Modify: `src/core/interceptor.ts:80-87`
- Modify: `src/ui/chat-badge.ts:1-65`
- Test: `tests/chat-badge.test.ts`, `tests/interceptor.test.ts`

**Interfaces:**

- In `main.ts`: register hook `diceSoNiceMessagePreProcess` to set `interception.willTrigger3DRoll = false` when `animateDSN === false` and message has physical roll.
- Register hook `preCreateChatMessage` to set `flags['dice-so-nice'].skip = true`.
- Switch `Hooks.on('renderChatMessage', ...)` to `Hooks.on('renderChatMessageHTML', (message: any, html: HTMLElement) => { renderChatBadge(message, html); })`.
- In `interceptor.ts`: stop mutating `options.skip3d` and `roll.ghost`.
- In `chat-badge.ts`: work directly on `HTMLElement`, replace `badge.innerHTML = ...` with DOM element creation.

- [ ] **Step 1: Write failing tests for DSN pre-process hook and renderChatMessageHTML**

In `tests/chat-badge.test.ts`:
Verify `renderChatBadge` accepts plain `HTMLElement` and creates elements with `textContent`.

- [ ] **Step 2: Run test to verify it fails if applicable**

Run: `npm test`

- [ ] **Step 3: Implement DSN hooks and renderChatMessageHTML**

Update `src/main.ts`:

```ts
// Register DSN animation suppression hooks
Hooks.on(
  'diceSoNiceMessagePreProcess',
  (messageId: string, interception: { willTrigger3DRoll: boolean }) => {
    const game = (globalThis as any).game;
    const animateDSN = game?.settings?.get(MODULE_ID, SETTINGS.ANIMATE_DSN) ?? true;
    if (!animateDSN && interception) {
      const msg = game?.messages?.get?.(messageId);
      if (msg?.rolls?.some((r: any) => r?.options?.[FLAGS.PHYSICAL_ROLL])) {
        interception.willTrigger3DRoll = false;
      }
    }
  }
);

Hooks.on('preCreateChatMessage', (message: any) => {
  const game = (globalThis as any).game;
  const animateDSN = game?.settings?.get(MODULE_ID, SETTINGS.ANIMATE_DSN) ?? true;
  if (!animateDSN && message?.rolls?.some((r: any) => r?.options?.[FLAGS.PHYSICAL_ROLL])) {
    message.updateSource?.({ 'flags.dice-so-nice.skip': true });
  }
});

// Register chat badge renderer with modern Foundry v13/v14 hook
Hooks.on('renderChatMessageHTML', (message: any, html: HTMLElement) => {
  renderChatBadge(message, html);
});
```

Update `src/ui/chat-badge.ts` to construct DOM nodes (`i` icon element + text node) instead of `innerHTML`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/main.ts src/core/interceptor.ts src/ui/chat-badge.ts tests/chat-badge.test.ts tests/interceptor.test.ts
git commit -m "fix: use official DSN skip hooks and switch to renderChatMessageHTML (M2, M3)"
```

---

### Task 6: Code Quality & Vite Build Improvements (L2, L3, L4, L5, L6, L8)

**Files:**

- Modify: `vite.config.ts`
- Modify: `src/main.ts`
- Modify: `src/ui/controls.ts`
- Modify: `src/ui/pp-dice-resolver.ts`
- Modify: `src/ui/chat-badge.ts`

**Interfaces:**

- In `vite.config.ts`: guard `foundrySyncPlugin` so it runs only during `build` and not during `vitest` (`!process.env.VITEST`). Define `__APP_VERSION__` from `package.json`.
- In `src/main.ts`: use `__APP_VERSION__` instead of hardcoded `'1.0.9'`. Remove unreachable pre-init keybinding check.
- In `src/ui/controls.ts`: remove unused `registerControls`. Localize toggle notification.
- In `src/ui/chat-badge.ts`: fix import from `'../constants.js'` to `'../constants'`.
- In `src/ui/pp-dice-resolver.ts`: eliminate redundant keydown listeners.

- [ ] **Step 1: Update `vite.config.ts` and test that `npm test` does not run foundry sync**

Update `vite.config.ts` with:

```ts
const isTest = Boolean(process.env.VITEST);
...
define: {
  __APP_VERSION__: JSON.stringify(pkg.version),
},
plugins: [
  ...(!isTest ? [foundrySyncPlugin()] : []),
]
```

- [ ] **Step 2: Run `npm test` and check output**

Verify output does NOT include `[pp-dice] Synced build to ...`.

- [ ] **Step 3: Update `src/main.ts`, `src/ui/controls.ts`, `src/ui/pp-dice-resolver.ts`, `src/ui/chat-badge.ts`**

Clean up dead code, redundant listeners, and hardcoded version.

- [ ] **Step 4: Run tests and lint**

Run: `npm test && npm run lint && npm run typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add vite.config.ts src/main.ts src/ui/controls.ts src/ui/pp-dice-resolver.ts src/ui/chat-badge.ts
git commit -m "chore: clean up dead code, deduplicate listeners, and guard test sync (L2-L6, L8)"
```

---

### Task 7: Translation & I18n Cleanup (§6)

**Files:**

- Modify: `lang/en.json`
- Modify: `lang/fr.json`

**Interfaces:**

- Remove unused keys: `Title`, `DiePrompt`, `DieRange`, `ActorLabel`, `ActionLabel`, `FormulaLabel`, `BypassedSecret`.
- Ensure `InvalidInput`, `ToggleEnabled`, `ToggleDisabled`, `FallbackRollTitle` exist.
- Update French strings:
  - `PhysicalBadge`: `"Dés physiques"` (or `"Jet réel"`)
  - `DigitalRoll`: `"Jet numérique (Échap / R)"`
  - `DigitalRollHint`: `"Échap / R / Entrée à vide = jet numérique"`
  - `SubmitHint`: `"Entrée = valider le jet physique"`
  - `ResolverTitle`: `"Saisie des dés physiques"`
  - `AnimateDSNHint`: `"Anime les dés 3D avec Dice So Nice s'arrêtant sur le résultat saisi."`
  - `Fortune`: `"Fortune (garder le meilleur)"`
  - `Misfortune`: `"Infortune (garder le pire)"`
  - `ToggleTitle`: `"Activer/désactiver Physical Play Dice"`

- [ ] **Step 1: Update `lang/en.json` and `lang/fr.json`**
- [ ] **Step 2: Run lint and format check**

Run: `npm run format:check`
Expected: PASS (or run `npm run format`)

- [ ] **Step 3: Run tests**

Run: `npm test`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add lang/en.json lang/fr.json
git commit -m "i18n: polish French tabletop RPG terminology and remove unused keys (§6)"
```

---

### Task 8: Privacy Scrubbing & Documentation Alignment (§8, §5)

**Files:**

- Modify: `foundryconfig.json.example`
- Modify: `docs/DEVELOPMENT.md`
- Modify: `docs/dev/wsl-windows-workflow.md`
- Modify: `README.md`
- Modify: `docs/user-guide.md`
- Modify: `docs/spec/physical-dice-interception.md`
- Modify: `docs/design/architecture.md`
- Modify: `docs/CODEMAP.md`
- Modify: `CHANGELOG.md`
- Delete: `docs/superpowers/plans/2026-09-23-resolver-shortcuts-and-codex-fixes.md`
- Modify: `.agents/last-docs-consolidate`

- [ ] **Step 1: Scrub personal Windows username / home paths in tracked files (§8.1)**

Replace `/mnt/c/Users/stany/...` with `/mnt/c/Users/<your-username>/...` and `cd ~/Work/pp-dice` with generic path.

- [ ] **Step 2: Delete transient plan file (D7)**

Delete `docs/superpowers/plans/2026-09-23-resolver-shortcuts-and-codex-fixes.md`.

- [ ] **Step 3: Update docs with consistent terminology & fixes (D1-D6, D9, D10)**

- Update `README.md`, `docs/user-guide.md`, `docs/spec/physical-dice-interception.md`, and `docs/design/architecture.md`.
- Update `docs/CODEMAP.md` with `chat-badge.ts` and all test files.
- Repair `CHANGELOG.md` duplicate `### Fixed` sections.
- Update `.agents/last-docs-consolidate` timestamp.

- [ ] **Step 4: Run format & lint check**

Run: `npm run format && npm run lint`
Expected: Clean.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "docs: scrub personal paths, align documentation with v14 reality, and update codemap (§8, §5)"
```

---

### Task 9: CI Workflow Hardening & Release Check (L9, §7)

**Files:**

- Modify: `.github/workflows/ci.yml`
- Modify: `.github/workflows/release.yml`

- [ ] **Step 1: Add `permissions: contents: read` to `ci.yml`**
- [ ] **Step 2: Add format check and version validation check to `release.yml`**
- [ ] **Step 3: Verify all test and quality gates pass**

Run: `npm test && npm run lint && npm run typecheck && npm run format:check`
Expected: All green.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml .github/workflows/release.yml
git commit -m "ci: add permissions block and release consistency checks (L9, §7)"
```
