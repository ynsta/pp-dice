import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PPDiceResolver, PPDiceResolverApp } from '../src/ui/pp-dice-resolver';

class MockKeyboardEvent {
  defaultPrevented = false;
  propagationStopped = false;
  immediatePropagationStopped = false;
  key: string;
  code: string;
  ctrlKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  target: any = null;

  constructor(
    public type: string,
    init: {
      key?: string;
      code?: string;
      ctrlKey?: boolean;
      altKey?: boolean;
      metaKey?: boolean;
      target?: any;
    } = {}
  ) {
    this.key = init.key ?? '';
    this.code = init.code ?? '';
    this.ctrlKey = init.ctrlKey ?? false;
    this.altKey = init.altKey ?? false;
    this.metaKey = init.metaKey ?? false;
    this.target = init.target ?? null;
  }

  preventDefault() {
    this.defaultPrevented = true;
  }

  stopPropagation() {
    this.propagationStopped = true;
  }

  stopImmediatePropagation() {
    this.immediatePropagationStopped = true;
  }
}

class MockElement {
  tagName: string;
  className: string;
  value: string;
  name: string;
  listeners: Map<string, Array<(e: any) => void>> = new Map();
  children: MockElement[] = [];
  parent: MockElement | null = null;
  classList: {
    add: (c: string) => void;
    remove: (c: string) => void;
    contains: (c: string) => boolean;
  };

  constructor(tagName = 'div', attrs: Record<string, string> = {}) {
    this.tagName = tagName.toLowerCase();
    this.className = attrs.class || '';
    this.value = attrs.value || '';
    this.name = attrs.name || '';
    const classes = new Set<string>((attrs.class || '').split(/\s+/).filter(Boolean));
    this.classList = {
      add: (c: string) => classes.add(c),
      remove: (c: string) => classes.delete(c),
      contains: (c: string) => classes.has(c),
    };
  }

  appendChild(child: MockElement) {
    child.parent = this;
    this.children.push(child);
    return child;
  }

  addEventListener(type: string, listener: (e: any) => void) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type)!.push(listener);
  }

  removeEventListener(type: string, listener: (e: any) => void) {
    const list = this.listeners.get(type) || [];
    this.listeners.set(
      type,
      list.filter((l) => l !== listener)
    );
  }

  dispatchEvent(event: any): boolean {
    if (!event.target) {
      try {
        event.target = this;
      } catch {
        Object.defineProperty(event, 'target', { value: this, configurable: true });
      }
    }
    const list = this.listeners.get(event.type) || [];
    for (const listener of list) {
      listener(event);
    }
    return !event.defaultPrevented;
  }

  querySelector(sel: string): MockElement | null {
    const matches = this.querySelectorAll(sel);
    return matches.length > 0 ? (matches[0] ?? null) : null;
  }

  querySelectorAll(sel: string): MockElement[] {
    const results: MockElement[] = [];
    const check = (el: MockElement) => {
      if (
        sel === 'input.die-input' &&
        el.tagName === 'input' &&
        el.className.split(/\s+/).includes('die-input')
      ) {
        results.push(el);
      } else if (sel === '.btn-digital' && el.className.split(/\s+/).includes('btn-digital')) {
        results.push(el);
      } else if (sel.startsWith('[name="') && sel.endsWith('"]')) {
        const targetName = sel.slice(7, -2);
        if (el.name === targetName) results.push(el);
      }
      for (const child of el.children) check(child);
    };
    check(this);
    return results;
  }

  contains(node: any): boolean {
    let curr = node;
    while (curr) {
      if (curr === this) return true;
      curr = curr.parent;
    }
    return false;
  }

  focus() {}
  select() {}

  requestSubmit() {
    const event = {
      type: 'submit',
      defaultPrevented: false,
      preventDefault() {
        this.defaultPrevented = true;
      },
      target: this,
    };
    this.dispatchEvent(event);
  }
}

describe('PPDiceResolver & PPDiceResolverApp Keyboard and Submit UX', () => {
  let mockResolver: any;
  let mockWindowListeners: Map<string, Array<{ listener: (e: any) => void; useCapture: boolean }>>;

  beforeEach(() => {
    vi.restoreAllMocks();
    delete (globalThis as any).foundry;
    mockWindowListeners = new Map();

    const mockBody = new MockElement('body');
    (globalThis as any).document = {
      body: mockBody,
      createElement: (tag: string) => new MockElement(tag),
    };
    (globalThis as any).KeyboardEvent = MockKeyboardEvent as any;

    (globalThis as any).window = {
      addEventListener: (type: string, listener: any, useCapture = false) => {
        if (!mockWindowListeners.has(type)) mockWindowListeners.set(type, []);
        mockWindowListeners.get(type)!.push({ listener, useCapture });
      },
      removeEventListener: (type: string, listener: any, useCapture = false) => {
        const list = mockWindowListeners.get(type) || [];
        mockWindowListeners.set(
          type,
          list.filter((entry) => entry.listener !== listener || entry.useCapture !== useCapture)
        );
      },
      dispatchEvent: (event: any) => {
        const list = mockWindowListeners.get(event.type) || [];
        for (const entry of list) {
          entry.listener(event);
        }
      },
    };

    const d20Term = { faces: 20, number: 1, randomFace: vi.fn().mockReturnValue(11) };

    mockResolver = {
      roll: { formula: '1d20' },
      context: {},
      diceTerms: [d20Term],
      prepareDiceGroups: vi.fn().mockReturnValue([]),
      submitDigital: vi.fn(),
      submitPhysical: vi.fn(),
    };
  });

  describe('PPDiceResolverApp._onKeyDown', () => {
    it('submits digital roll and closes on Escape', () => {
      const app = new PPDiceResolverApp(mockResolver);
      const closeSpy = vi.spyOn(app, 'close').mockResolvedValue(undefined as any);

      const event = new MockKeyboardEvent('keydown', { key: 'Escape', code: 'Escape' });
      app._onKeyDown(event as unknown as KeyboardEvent);

      expect(event.defaultPrevented).toBe(true);
      expect(event.propagationStopped).toBe(true);
      expect(event.immediatePropagationStopped).toBe(true);
      expect(mockResolver.submitDigital).toHaveBeenCalledTimes(1);
      expect(closeSpy).toHaveBeenCalledTimes(1);
    });

    it('submits digital roll and closes on R / KeyR', () => {
      const app = new PPDiceResolverApp(mockResolver);
      const closeSpy = vi.spyOn(app, 'close').mockResolvedValue(undefined as any);

      const event = new MockKeyboardEvent('keydown', { key: 'r', code: 'KeyR' });
      app._onKeyDown(event as unknown as KeyboardEvent);

      expect(event.defaultPrevented).toBe(true);
      expect(event.propagationStopped).toBe(true);
      expect(event.immediatePropagationStopped).toBe(true);
      expect(mockResolver.submitDigital).toHaveBeenCalledTimes(1);
      expect(closeSpy).toHaveBeenCalledTimes(1);
    });

    it('ignores Ctrl+R to allow browser reload', () => {
      const app = new PPDiceResolverApp(mockResolver);
      const closeSpy = vi.spyOn(app, 'close').mockResolvedValue(undefined as any);

      const event = new MockKeyboardEvent('keydown', { key: 'r', code: 'KeyR', ctrlKey: true });
      app._onKeyDown(event as unknown as KeyboardEvent);

      expect(mockResolver.submitDigital).not.toHaveBeenCalled();
      expect(closeSpy).not.toHaveBeenCalled();
      expect(event.defaultPrevented).toBe(false);
    });

    it('prevents Space from bubbling to prevent Foundry canvas pause', () => {
      const app = new PPDiceResolverApp(mockResolver);
      const closeSpy = vi.spyOn(app, 'close').mockResolvedValue(undefined as any);

      const event = new MockKeyboardEvent('keydown', { key: ' ', code: 'Space' });
      app._onKeyDown(event as unknown as KeyboardEvent);

      expect(event.defaultPrevented).toBe(true);
      expect(event.propagationStopped).toBe(true);
      expect(mockResolver.submitDigital).not.toHaveBeenCalled();
      expect(closeSpy).not.toHaveBeenCalled();
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

    it('processes keydown when target is document.body or null (H3)', () => {
      const roll = { formula: '1d20', terms: [] } as any;
      const resolver = new PPDiceResolver(roll, {} as any, []);
      const app = new PPDiceResolverApp(resolver);
      app.element = { contains: vi.fn(() => false) };
      vi.spyOn(app, 'close').mockResolvedValue(undefined as any);

      const submitDigitalSpy = vi.spyOn(resolver, 'submitDigital');

      // target is document.body
      const eventBody = new MockKeyboardEvent('keydown', {
        key: 'r',
        target: (globalThis as any).document.body,
      });
      app._onKeyDown(eventBody as unknown as KeyboardEvent);
      expect(submitDigitalSpy).toHaveBeenCalledTimes(1);

      // target is null
      const eventNull = new MockKeyboardEvent('keydown', { key: 'Escape', target: null });
      app._onKeyDown(eventNull as unknown as KeyboardEvent);
      expect(submitDigitalSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('PPDiceResolverApp Lifecycle & Input Listeners', () => {
    function setupAppWithForm() {
      const app = new PPDiceResolverApp(mockResolver);
      const form = new MockElement('form', { class: 'pp-dice-dialog-content' });
      const input = new MockElement('input', {
        class: 'die-input',
        name: 'die_0_0',
        value: '',
      });
      form.appendChild(input);
      app.element = form as any;
      return { app, form, input };
    }

    it('attaches frame listeners and forwards window keydown to _onKeyDown', () => {
      const { app } = setupAppWithForm();
      const onKeyDownSpy = vi.spyOn(app, '_onKeyDown');

      app._attachFrameListeners();

      const event = new MockKeyboardEvent('keydown', { key: 'Escape', code: 'Escape' });
      (globalThis as any).window.dispatchEvent(event);

      expect(onKeyDownSpy).toHaveBeenCalledWith(event);
    });

    it('handles Escape/R on focused input via window capture listener (L2)', () => {
      const { app, input } = setupAppWithForm();
      const closeSpy = vi.spyOn(app, 'close').mockResolvedValue(undefined as any);

      app._attachFrameListeners();

      const escEvent = new MockKeyboardEvent('keydown', {
        key: 'Escape',
        code: 'Escape',
        target: input,
      });
      (globalThis as any).window.dispatchEvent(escEvent);

      expect(escEvent.defaultPrevented).toBe(true);
      expect(mockResolver.submitDigital).toHaveBeenCalledTimes(1);
      expect(closeSpy).toHaveBeenCalledTimes(1);
    });

    it('suppresses Space on focused die input via window capture listener (L2)', () => {
      const { app, input } = setupAppWithForm();

      app._attachFrameListeners();

      const spaceEvent = new MockKeyboardEvent('keydown', {
        key: ' ',
        code: 'Space',
        target: input,
      });
      (globalThis as any).window.dispatchEvent(spaceEvent);

      expect(spaceEvent.defaultPrevented).toBe(true);
      expect(spaceEvent.propagationStopped).toBe(true);
      expect(mockResolver.submitDigital).not.toHaveBeenCalled();
    });

    it('submits digital roll when Enter is pressed on empty input', () => {
      const { app, input } = setupAppWithForm();
      input.value = ''; // empty
      const closeSpy = vi.spyOn(app, 'close').mockResolvedValue(undefined as any);

      app._onRender({}, {});

      const enterEvent = new MockKeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        target: input,
      });
      input.dispatchEvent(enterEvent);

      expect(mockResolver.submitDigital).toHaveBeenCalledTimes(1);
      expect(mockResolver.submitPhysical).not.toHaveBeenCalled();
      expect(closeSpy).toHaveBeenCalledTimes(1);
    });

    it('submits digital roll when form is submitted with whitespace-only inputs', () => {
      const { app, form, input } = setupAppWithForm();
      input.value = '   ';
      const closeSpy = vi.spyOn(app, 'close').mockResolvedValue(undefined as any);

      app._onRender({}, {});

      form.requestSubmit();

      expect(mockResolver.submitDigital).toHaveBeenCalledTimes(1);
      expect(mockResolver.submitPhysical).not.toHaveBeenCalled();
      expect(closeSpy).toHaveBeenCalledTimes(1);
    });

    it('submits physical roll when Enter is pressed with entered number', () => {
      const { app, input } = setupAppWithForm();
      input.value = '17';
      const closeSpy = vi.spyOn(app, 'close').mockResolvedValue(undefined as any);

      app._onRender({}, {});

      const enterEvent = new MockKeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        target: input,
      });
      input.dispatchEvent(enterEvent);

      expect(mockResolver.submitPhysical).toHaveBeenCalledTimes(1);
      expect(mockResolver.submitDigital).not.toHaveBeenCalled();
      expect(closeSpy).toHaveBeenCalledTimes(1);

      const valuesMap = mockResolver.submitPhysical.mock.calls[0][0];
      expect(valuesMap.get(mockResolver.diceTerms[0])).toEqual([17]);
    });

    it('rejects values out of range (greater than faces or <= 0) and does not call submitPhysical', () => {
      const roll = { formula: '1d6', terms: [{ faces: 6, number: 1 }] } as any;
      const resolver = new PPDiceResolver(roll, {} as any, roll.terms);
      const app = new PPDiceResolverApp(resolver);

      const form = document.createElement('form') as any;
      const input = document.createElement('input') as any;
      input.className = 'die-input';
      input.name = 'die_0_0';
      input.value = '99'; // Out of range for d6
      form.appendChild(input);
      app.element = form;

      app._onRender({}, {});

      const submitPhysicalSpy = vi.spyOn(resolver, 'submitPhysical');
      const closeSpy = vi.spyOn(app, 'close');
      const event = new Event('submit', { cancelable: true });
      form.dispatchEvent(event);

      expect(submitPhysicalSpy).not.toHaveBeenCalled();
      expect(closeSpy).not.toHaveBeenCalled();
      expect(input.classList.contains('invalid')).toBe(true);
    });

    it('rejects non-integer values and negative/zero values without calling submitPhysical', () => {
      const roll = { formula: '1d6', terms: [{ faces: 6, number: 1 }] } as any;
      const resolver = new PPDiceResolver(roll, {} as any, roll.terms);
      const app = new PPDiceResolverApp(resolver);

      const form = document.createElement('form') as any;
      const input = document.createElement('input') as any;
      input.className = 'die-input';
      input.name = 'die_0_0';
      input.value = '3.5';
      form.appendChild(input);
      app.element = form;

      app._onRender({}, {});

      const submitPhysicalSpy = vi.spyOn(resolver, 'submitPhysical');
      const closeSpy = vi.spyOn(app, 'close');
      form.dispatchEvent(new Event('submit', { cancelable: true }));

      expect(submitPhysicalSpy).not.toHaveBeenCalled();
      expect(closeSpy).not.toHaveBeenCalled();
      expect(input.classList.contains('invalid')).toBe(true);
    });

    it('rejects partial inputs when some dice are filled and others are blank without calling submitPhysical', () => {
      const roll = { formula: '2d6', terms: [{ faces: 6, number: 2 }] } as any;
      const resolver = new PPDiceResolver(roll, {} as any, roll.terms);
      const app = new PPDiceResolverApp(resolver);

      const form = document.createElement('form') as any;
      const input1 = document.createElement('input') as any;
      input1.className = 'die-input';
      input1.name = 'die_0_0';
      input1.value = '4';
      form.appendChild(input1);

      const input2 = document.createElement('input') as any;
      input2.className = 'die-input';
      input2.name = 'die_0_1';
      input2.value = ''; // blank while other is filled
      form.appendChild(input2);

      app.element = form;
      app._onRender({}, {});

      const submitPhysicalSpy = vi.spyOn(resolver, 'submitPhysical');
      const submitDigitalSpy = vi.spyOn(resolver, 'submitDigital');
      const closeSpy = vi.spyOn(app, 'close');
      form.dispatchEvent(new Event('submit', { cancelable: true }));

      expect(submitPhysicalSpy).not.toHaveBeenCalled();
      expect(submitDigitalSpy).not.toHaveBeenCalled();
      expect(closeSpy).not.toHaveBeenCalled();
      expect(input2.classList.contains('invalid')).toBe(true);
    });

    it('shows warning notification with PP_DICE.InvalidInput when validation fails', () => {
      const roll = { formula: '1d6', terms: [{ faces: 6, number: 1 }] } as any;
      const resolver = new PPDiceResolver(roll, {} as any, roll.terms);
      const app = new PPDiceResolverApp(resolver);

      const form = document.createElement('form') as any;
      const input = document.createElement('input') as any;
      input.className = 'die-input';
      input.name = 'die_0_0';
      input.value = '0';
      form.appendChild(input);
      app.element = form;
      app._onRender({}, {});

      const warnSpy = vi.fn();
      const localizeSpy = vi.fn().mockReturnValue('Invalid input text');
      (globalThis as any).game = { i18n: { localize: localizeSpy } };
      (globalThis as any).ui = { notifications: { warn: warnSpy } };

      form.dispatchEvent(new Event('submit', { cancelable: true }));

      expect(localizeSpy).toHaveBeenCalledWith('PP_DICE.InvalidInput');
      expect(warnSpy).toHaveBeenCalledWith('Invalid input text');
    });

    it('cleans up window keydown listener on close', () => {
      const { app } = setupAppWithForm();
      app._attachFrameListeners();

      expect(mockWindowListeners.get('keydown')?.length).toBe(1);

      app._onClose({});

      expect(mockWindowListeners.get('keydown')?.length).toBe(0);
    });
  });

  describe('PPDiceResolver.renderDialog', () => {
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

    it('falls back to submitDigital if app.render throws synchronously', async () => {
      const roll = { formula: '1d20', terms: [{ faces: 20, number: 1 }] } as any;
      const context = { title: 'Test' } as any;
      const resolver = new PPDiceResolver(roll, context, roll.terms);

      (globalThis as any).foundry = {
        applications: {
          api: {
            ApplicationV2: class MockApp {
              render() {
                throw new Error('Sync render failure');
              }
            },
          },
        },
      };

      const result = await resolver.awaitInput();
      expect(result.isDigital).toBe(true);
    });
  });
});
