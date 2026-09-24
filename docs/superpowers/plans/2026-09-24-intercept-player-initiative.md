# Intercept Player Initiative Rolls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Intercept initiative rolls for player characters across generic Foundry, PF2e, and SF2e systems, prompting the GM for physical dice while letting NPC initiative roll automatically via digital RNG.

**Architecture:** Wrap Foundry core `Combatant.prototype.getInitiativeRoll` and `(game.pf2e ?? game.sf2e).Check.roll` to tag initiative rolls with actor, combatant, and roll type metadata. Update `PF2eContextProvider` and `GenericContextProvider` to resolve player status and contextual initiative titles, while bypassing non-character (NPC) combatants.

**Tech Stack:** TypeScript 5.8+, Vite 6, Vitest, Foundry VTT v14 API (`Roll`, `Combatant`, `Check`).

**Spec:** `docs/spec/physical-dice-interception.md`

## Global Constraints

- Target Foundry version floor: 14.360, verified: 14.368.
- Strictly adhere to TDD: failing test first, verified pass, lint clean.
- All code, comments, identifiers, doc strings, commit messages in English.
- No regression on existing standard roll interception (unselected token fallback, item identifier, open sheet).
- System agnostic: PF2e and SF2e supported with deep integration; generic Foundry core supported with zero required system dependencies.
- NPC initiative rolls must NEVER be intercepted; ONLY player character initiative rolls are intercepted.

---

### Task 1: Initiative Interception Wrappers in Core Interceptor

**Files:**
- Modify: `src/core/interceptor.ts:115-144`
- Test: `tests/interceptor.test.ts`

**Interfaces:**
- Produces:
  - `activeCheckContext: any` tracking module-level active check context.
  - `getPf2eActiveCheckContext(): any`: helper returning current active check context.
  - `setPf2eActiveCheckContext(context: any): void`: helper setting active check context.
  - `clearPf2eActiveCheckContext(): void`: helper resetting active check context.
  - `registerInitiativeInterception(): void`: wraps `Combatant.prototype.getInitiativeRoll` and `(game.pf2e ?? game.sf2e).Check.roll`.

- [ ] **Step 1: Write failing test in `tests/interceptor.test.ts` for initiative interception wrappers**

```typescript
it('tags rolls with actor and combatant in Combatant.prototype.getInitiativeRoll', () => {
  const mockActor = { id: 'actor-pc', name: 'Valeros', type: 'character', hasPlayerOwner: true };
  const mockCombatant = { id: 'combatant-1', actor: mockActor, _getInitiativeFormula: () => '1d20+2' };

  class MockCombatant {
    actor = mockActor;
    _getInitiativeFormula() {
      return '1d20+2';
    }
    getInitiativeRoll(formula?: string) {
      return (globalThis as any).Roll.create(formula || this._getInitiativeFormula());
    }
  }

  (globalThis as any).Combatant = MockCombatant;
  (globalThis as any).CONFIG = { Combatant: { documentClass: MockCombatant } };

  registerInitiativeInterception();

  const combatant = new MockCombatant();
  const roll = combatant.getInitiativeRoll();

  expect((roll as any)._actor).toBe(mockActor);
  expect((roll as any)._combatant).toBe(combatant);
  expect(roll.options?.type).toBe('initiative');
  expect(roll.options?.initiative).toBe(true);
});

it('preserves context in PF2e/SF2e Check.roll wrapper', async () => {
  const mockActor = { id: 'actor-pc', uuid: 'Actor.pc1', name: 'Ezren', type: 'character' };
  const mockContext = { actor: mockActor, type: 'initiative', skipDialog: true };
  let capturedContext: any = null;

  (globalThis as any).game = {
    pf2e: {
      Check: {
        roll: async (_check: any, context: any) => {
          capturedContext = getPf2eActiveCheckContext();
          return { evaluated: true, total: 15 };
        },
      },
    },
  };

  registerInitiativeInterception();

  await (globalThis as any).game.pf2e.Check.roll({}, mockContext);

  expect(capturedContext).toBe(mockContext);
  expect(mockContext.identifier).toBe('Actor.pc1');
  expect(getPf2eActiveCheckContext()).toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/interceptor.test.ts`
Expected: FAIL (`registerInitiativeInterception` not exported / defined)

- [ ] **Step 3: Implement `registerInitiativeInterception` and check context helpers in `src/core/interceptor.ts`**

```typescript
let activeCheckContext: any = null;

export function getPf2eActiveCheckContext(): any {
  return activeCheckContext;
}

export function setPf2eActiveCheckContext(context: any): void {
  activeCheckContext = context;
}

export function clearPf2eActiveCheckContext(): void {
  activeCheckContext = null;
}

export function registerInitiativeInterception(): void {
  const libWrapper = (globalThis as any).libWrapper;
  const CombatantClass =
    (globalThis as any).CONFIG?.Combatant?.documentClass ?? (globalThis as any).Combatant;

  if (CombatantClass?.prototype) {
    if (libWrapper) {
      try {
        libWrapper.register(
          MODULE_ID,
          'Combatant.prototype.getInitiativeRoll',
          function (this: any, wrapped: any, formula: string) {
            const roll = wrapped(formula);
            if (roll) {
              (roll as any)._actor = this.actor;
              (roll as any)._combatant = this;
              roll.options = roll.options || {};
              roll.options.type = 'initiative';
              roll.options.initiative = true;
            }
            return roll;
          },
          'WRAPPER'
        );
      } catch {
        // Ignored if already registered
      }
    } else {
      const originalGetInitiativeRoll = CombatantClass.prototype.getInitiativeRoll;
      CombatantClass.prototype.getInitiativeRoll = function (this: any, formula?: string) {
        const roll = originalGetInitiativeRoll.call(this, formula);
        if (roll) {
          (roll as any)._actor = this.actor;
          (roll as any)._combatant = this;
          roll.options = roll.options || {};
          roll.options.type = 'initiative';
          roll.options.initiative = true;
        }
        return roll;
      };
    }
  }

  const checkCls =
    (globalThis as any).game?.pf2e?.Check ?? (globalThis as any).game?.sf2e?.Check;
  if (checkCls?.roll) {
    if (libWrapper) {
      try {
        libWrapper.register(
          MODULE_ID,
          `${(globalThis as any).game?.pf2e ? 'game.pf2e' : 'game.sf2e'}.Check.roll`,
          async function (wrapped: any, check: any, context: any = {}, event: any = null, callback: any = null) {
            if (context?.actor && !context.identifier && context.actor.uuid) {
              context.identifier = context.actor.uuid;
            }
            setPf2eActiveCheckContext(context);
            try {
              return await wrapped(check, context, event, callback);
            } finally {
              clearPf2eActiveCheckContext();
            }
          },
          'WRAPPER'
        );
      } catch {
        // Ignored if already registered
      }
    } else {
      const originalCheckRoll = checkCls.roll;
      checkCls.roll = async function (
        check: any,
        context: any = {},
        event: any = null,
        callback: any = null
      ) {
        if (context?.actor && !context.identifier && context.actor.uuid) {
          context.identifier = context.actor.uuid;
        }
        setPf2eActiveCheckContext(context);
        try {
          return await originalCheckRoll.call(this, check, context, event, callback);
        } finally {
          clearPf2eActiveCheckContext();
        }
      };
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/interceptor.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/interceptor.ts tests/interceptor.test.ts
git commit -m "feat: add Combatant and PF2e/SF2e Check initiative interception wrappers"
```

---

### Task 2: PF2e & SF2e Provider Initiative Roll Resolution & Title

**Files:**
- Modify: `src/providers/pf2e.ts:12-110`
- Test: `tests/pf2e.test.ts`

**Interfaces:**
- Consumes:
  - `getPf2eActiveCheckContext` from `src/core/interceptor.ts`.
- Produces:
  - `PF2eContextProvider.resolveContext(roll, options)`: handles `activeCheckContext`, `roll.options.identifier` as UUID, and sets `action = 'initiative'` when `type === 'initiative'`.
  - `PF2eContextProvider.resolveTitle(roll, actor, item, options)`: returns `"${actorName} — Initiative"` for initiative rolls.

- [ ] **Step 1: Write failing test in `tests/pf2e.test.ts` for PF2e initiative rolls**

```typescript
it('intercepts player character initiative roll from active check context', () => {
  const provider = new PF2eContextProvider();
  const mockActor = {
    id: 'ezren-1',
    name: 'Ezren',
    type: 'character',
    hasPlayerOwner: false,
    getActiveTokens: () => [],
  };

  const roll = {
    formula: '1d20+8',
    options: {
      type: 'initiative',
      domains: ['all', 'initiative', 'perception'],
    },
    terms: [{ faces: 20, results: [] }],
  };

  setPf2eActiveCheckContext({
    actor: mockActor,
    type: 'initiative',
    domains: ['all', 'initiative', 'perception'],
  });

  const ctx = provider.resolveContext(roll);
  clearPf2eActiveCheckContext();

  expect(ctx).not.toBeNull();
  expect(ctx?.isPlayer).toBe(true);
  expect(ctx?.actor).toBe(mockActor);
  expect(ctx?.action).toBe('initiative');
  expect(ctx?.title).toBe('Ezren — Initiative');
});

it('does not intercept NPC initiative roll', () => {
  const provider = new PF2eContextProvider();
  const mockNpc = {
    id: 'goblin-1',
    name: 'Goblin Pyro',
    type: 'npc',
    hasPlayerOwner: false,
    getActiveTokens: () => [],
  };

  const roll = {
    formula: '1d20+4',
    options: {
      type: 'initiative',
      domains: ['all', 'initiative', 'perception'],
    },
    terms: [{ faces: 20, results: [] }],
  };

  setPf2eActiveCheckContext({
    actor: mockNpc,
    type: 'initiative',
    domains: ['all', 'initiative', 'perception'],
  });

  const ctx = provider.resolveContext(roll);
  clearPf2eActiveCheckContext();

  expect(ctx).not.toBeNull();
  expect(ctx?.isPlayer).toBe(false);
});

it('resolves actor from roll options identifier when set to Actor UUID', () => {
  const provider = new PF2eContextProvider();
  const mockActor = {
    id: 'ezren-1',
    uuid: 'Actor.ezren1',
    name: 'Ezren',
    type: 'character',
    hasPlayerOwner: false,
  };

  (globalThis as any).fromUuidSync = (uuid: string) => {
    if (uuid === 'Actor.ezren1') return mockActor;
    return null;
  };

  const roll = {
    formula: '1d20+8',
    options: {
      type: 'initiative',
      identifier: 'Actor.ezren1',
      domains: ['initiative'],
    },
  };

  const ctx = provider.resolveContext(roll);
  expect(ctx?.actor).toBe(mockActor);
  expect(ctx?.isPlayer).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/pf2e.test.ts`
Expected: FAIL (initiative context / title not resolved)

- [ ] **Step 3: Update `PF2eContextProvider.resolveContext` and `resolveTitle` in `src/providers/pf2e.ts`**

Import `getPf2eActiveCheckContext` in `src/providers/pf2e.ts`:
```typescript
import { getPf2eActiveCheckContext } from '../core/interceptor';
```

In `PF2eContextProvider.resolveContext`:
```typescript
    // Check active check context from Check.roll wrapper
    const activeCheck = getPf2eActiveCheckContext();
    if (!actor && activeCheck?.actor) {
      actor = activeCheck.actor;
      if (!token && activeCheck.token) {
        token = activeCheck.token;
      }
      (roll as any)._pf2eContext = activeCheck;
    }

    if (!actor && (roll as any)._pf2eContext?.actor) {
      actor = (roll as any)._pf2eContext.actor;
    }
```
And in identifier resolution:
```typescript
    // Match item identifier or actor UUID
    if (!actor && typeof roll.options?.identifier === 'string') {
      const identifier = roll.options.identifier;
      if (identifier.startsWith('Actor.') || identifier.startsWith('Scene.')) {
        const doc = (globalThis as any).fromUuidSync?.(identifier);
        actor = doc?.actor ?? doc ?? null;
      } else {
        const itemId = identifier.split('.')[0];
        if (itemId) {
          actor =
            game?.actors?.find?.((a: any) =>
              typeof a.items?.has === 'function'
                ? a.items.has(itemId)
                : a.items?.some?.((i: any) => i?.id === itemId || i?._id === itemId)
            ) ?? null;
        }
      }
    }
```
And in action resolution:
```typescript
    let action = roll.options?.action ?? (roll as any)._pf2eContext?.action ?? null;
    if (!action && (roll.options?.type === 'initiative' || roll.options?.domains?.includes?.('initiative'))) {
      action = 'initiative';
    }
```
In `PF2eContextProvider.resolveTitle`:
```typescript
    const isInitiative =
      roll?.options?.type === 'initiative' ||
      roll?.options?.domains?.includes?.('initiative') ||
      (roll as any)?._pf2eContext?.type === 'initiative';

    if (isInitiative) {
      return `${actorName} — Initiative`;
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/pf2e.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/providers/pf2e.ts tests/pf2e.test.ts
git commit -m "feat: support PF2e and SF2e initiative roll context resolution and title"
```

---

### Task 3: Generic Provider Initiative Roll Resolution & Title

**Files:**
- Modify: `src/providers/generic.ts:10-70`
- Test: `tests/generic.test.ts`

**Interfaces:**
- Produces:
  - `GenericContextProvider.resolveContext(roll, options)`: resolves actor from `(roll as any)._actor` or `(roll as any)._combatant?.actor`.
  - `GenericContextProvider.resolveTitle(roll, actor, item, options)`: returns `"${actorName} — Initiative"` when roll is tagged as initiative.

- [ ] **Step 1: Write failing test in `tests/generic.test.ts` for generic initiative rolls**

```typescript
it('intercepts player character initiative roll tagged on roll instance', () => {
  const provider = new GenericContextProvider();
  const mockActor = {
    id: 'pc-warrior',
    name: 'Valeros',
    type: 'character',
    hasPlayerOwner: true,
  };

  const roll = {
    formula: '1d20+2',
    options: {
      type: 'initiative',
      initiative: true,
    },
    _actor: mockActor,
    _combatant: { id: 'comb-1', actor: mockActor },
  };

  const ctx = provider.resolveContext(roll);

  expect(ctx).not.toBeNull();
  expect(ctx?.isPlayer).toBe(true);
  expect(ctx?.actor).toBe(mockActor);
  expect(ctx?.action).toBe('initiative');
  expect(ctx?.title).toBe('Valeros — Initiative');
});

it('does not intercept generic NPC initiative roll', () => {
  const provider = new GenericContextProvider();
  const mockNpc = {
    id: 'orc-1',
    name: 'Orc Warrior',
    type: 'npc',
    hasPlayerOwner: false,
  };

  const roll = {
    formula: '1d20+1',
    options: {
      type: 'initiative',
      initiative: true,
    },
    _actor: mockNpc,
  };

  const ctx = provider.resolveContext(roll);

  expect(ctx).not.toBeNull();
  expect(ctx?.isPlayer).toBe(false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/generic.test.ts`
Expected: FAIL (actor resolution from `_actor` not handled, title not formatted)

- [ ] **Step 3: Update `GenericContextProvider.resolveContext` and `resolveTitle` in `src/providers/generic.ts`**

In `GenericContextProvider.resolveContext`:
```typescript
    // 1. Identify Actor
    let actor = roll.data?.actor ?? (roll as any)._actor ?? (roll as any)._combatant?.actor ?? null;
    let token = roll.data?.token ?? (roll as any)._combatant?.token ?? null;
```
And action:
```typescript
    let action = roll.options?.action ?? null;
    if (!action && (roll.options?.type === 'initiative' || roll.options?.initiative || (roll as any)._combatant)) {
      action = 'initiative';
    }
```
In `GenericContextProvider.resolveTitle`:
```typescript
    const isInitiative =
      roll?.options?.type === 'initiative' ||
      roll?.options?.initiative === true ||
      (roll as any)?._combatant != null;

    if (isInitiative) {
      return `${actorName} — Initiative`;
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/generic.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/providers/generic.ts tests/generic.test.ts
git commit -m "feat: support generic Foundry combatant initiative resolution and title"
```

---

### Task 4: Main Initialization Hook Integration & Fallback Registration

**Files:**
- Modify: `src/main.ts:1-100`
- Test: `tests/interceptor.test.ts`

**Interfaces:**
- Consumes:
  - `registerInitiativeInterception` from `src/core/interceptor.ts`.
- Produces:
  - Registration of initiative interception on both `init` and `ready` hooks (idempotent) to guarantee coverage whether system initializes early or late.

- [ ] **Step 1: Write test verifying idempotent registration in `tests/interceptor.test.ts`**

```typescript
it('allows multiple calls to registerInitiativeInterception without error', () => {
  expect(() => {
    registerInitiativeInterception();
    registerInitiativeInterception();
  }).not.toThrow();
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npx vitest run tests/interceptor.test.ts`
Expected: PASS

- [ ] **Step 3: Update `src/main.ts` to call `registerInitiativeInterception`**

Import `registerInitiativeInterception` from `./core/interceptor`:
```typescript
import { registerInterception, registerInitiativeInterception } from './core/interceptor';
```

In `Hooks.once('init')`:
```typescript
  // Register roll and initiative interception
  registerInterception();
  registerInitiativeInterception();
```

In `Hooks.once('ready')`:
```typescript
  // Ensure initiative wrappers are bound if system initialized after module init
  registerInitiativeInterception();
```

- [ ] **Step 4: Run full test and validation suite**

Run: `npm test && npm run typecheck && npm run format:check && npm run lint`
Expected: All pass cleanly with zero warnings or errors.

- [ ] **Step 5: Commit**

```bash
git add src/main.ts tests/interceptor.test.ts
git commit -m "feat: initialize initiative interception on init and ready hooks"
```

---

### Task 5: Documentation & Changelog

**Files:**
- Modify: `docs/spec/physical-dice-interception.md`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Update `docs/spec/physical-dice-interception.md`**

Add section 3.5 documenting initiative roll interception:
- Combat Tracker and sheet initiative interception for player characters (`type === 'character'`).
- Automatic digital RNG bypass for NPC combatants.
- Sequential prompt queue when multiple combatants roll at once.
- System coverage: PF2e, SF2e, and Generic Foundry core `Combatant#getInitiativeRoll`.

- [ ] **Step 2: Update `CHANGELOG.md`**

Add `[1.0.13]` entry:
- Feature: Intercept initiative rolls for player characters from the Combat Tracker and character sheet.
- Feature: Support PF2e, SF2e, and generic Foundry systems for player initiative.
- Feature: Sequential prompt queue for multiple player initiatives rolled together ("Roll All PCs" / "Roll All").
- Feature: Automatic digital roll bypass for NPC initiatives (no GM prompt).

- [ ] **Step 3: Run formatting check and build**

Run: `npm run format && npm run build`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add docs/spec/physical-dice-interception.md CHANGELOG.md
git commit -m "docs: document player initiative interception and update changelog for 1.0.13"
```
