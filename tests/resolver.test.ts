import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PPDiceResolverApp } from '../src/ui/pp-dice-resolver';

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

  constructor(tagName = 'div', attrs: Record<string, string> = {}) {
    this.tagName = tagName.toLowerCase();
    this.className = attrs.class || '';
    this.value = attrs.value || '';
    this.name = attrs.name || '';
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
    if (!event.target) event.target = this;
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
    mockWindowListeners = new Map();

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

    it('attaches keydown directly to input in _onRender and handles Escape/R on focused input', () => {
      const { app, input } = setupAppWithForm();
      const closeSpy = vi.spyOn(app, 'close').mockResolvedValue(undefined as any);

      app._onRender({}, {});

      const escEvent = new MockKeyboardEvent('keydown', {
        key: 'Escape',
        code: 'Escape',
        target: input,
      });
      input.dispatchEvent(escEvent);

      expect(escEvent.defaultPrevented).toBe(true);
      expect(mockResolver.submitDigital).toHaveBeenCalledTimes(1);
      expect(closeSpy).toHaveBeenCalledTimes(1);
    });

    it('suppresses Space on focused die input', () => {
      const { app, input } = setupAppWithForm();

      app._onRender({}, {});

      const spaceEvent = new MockKeyboardEvent('keydown', {
        key: ' ',
        code: 'Space',
        target: input,
      });
      input.dispatchEvent(spaceEvent);

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

    it('cleans up window keydown listener on close', () => {
      const { app } = setupAppWithForm();
      app._attachFrameListeners();

      expect(mockWindowListeners.get('keydown')?.length).toBe(1);

      app._onClose({});

      expect(mockWindowListeners.get('keydown')?.length).toBe(0);
    });
  });
});
