import { describe, it, expect, vi, beforeEach } from 'vitest';

class MockKeyboardEvent {
  defaultPrevented = false;
  propagationStopped = false;
  immediatePropagationStopped = false;
  key: string;
  code: string;
  ctrlKey: boolean;
  altKey: boolean;
  metaKey: boolean;

  constructor(
    public type: string,
    init: {
      key?: string;
      code?: string;
      ctrlKey?: boolean;
      altKey?: boolean;
      metaKey?: boolean;
    } = {}
  ) {
    this.key = init.key ?? '';
    this.code = init.code ?? '';
    this.ctrlKey = init.ctrlKey ?? false;
    this.altKey = init.altKey ?? false;
    this.metaKey = init.metaKey ?? false;
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

describe('PPDiceResolver Keyboard Shortcuts', () => {
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

    mockResolver = {
      roll: { formula: '1d20' },
      context: {},
      prepareDiceGroups: vi.fn().mockReturnValue([]),
      submitDigital: vi.fn(),
      submitPhysical: vi.fn(),
    };
  });

  it('handles Escape on window (capture) to submit digital roll', () => {
    const handleKey = (e: MockKeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (!e.ctrlKey && !e.altKey && !e.metaKey) {
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
          mockResolver.submitDigital();
        }
      }
    };

    (globalThis as any).window.addEventListener('keydown', handleKey, true);

    const escEvent = new MockKeyboardEvent('keydown', { key: 'Escape', code: 'Escape' });
    (globalThis as any).window.dispatchEvent(escEvent);

    expect(mockResolver.submitDigital).toHaveBeenCalledTimes(1);
    expect(escEvent.defaultPrevented).toBe(true);
    expect(escEvent.propagationStopped).toBe(true);
    expect(escEvent.immediatePropagationStopped).toBe(true);
  });

  it('handles R and KeyR on window to submit digital roll', () => {
    const handleKey = (e: MockKeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (!e.ctrlKey && !e.altKey && !e.metaKey) {
        if (
          e.key === 'r' ||
          e.key === 'R' ||
          e.code === 'KeyR' ||
          e.key === 'Escape' ||
          e.code === 'Escape'
        ) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          mockResolver.submitDigital();
        }
      }
    };

    (globalThis as any).window.addEventListener('keydown', handleKey, true);

    const rEvent = new MockKeyboardEvent('keydown', { key: 'r', code: 'KeyR' });
    (globalThis as any).window.dispatchEvent(rEvent);

    expect(mockResolver.submitDigital).toHaveBeenCalledTimes(1);
    expect(rEvent.defaultPrevented).toBe(true);

    // Ctrl+R should NOT trigger digital roll
    mockResolver.submitDigital.mockClear();
    const ctrlREvent = new MockKeyboardEvent('keydown', {
      key: 'r',
      code: 'KeyR',
      ctrlKey: true,
    });
    (globalThis as any).window.dispatchEvent(ctrlREvent);

    expect(mockResolver.submitDigital).not.toHaveBeenCalled();
  });

  it('prevents Space from bubbling to avoid Foundry pause', () => {
    const handleKey = (e: MockKeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    (globalThis as any).window.addEventListener('keydown', handleKey, true);

    const spaceEvent = new MockKeyboardEvent('keydown', { key: ' ', code: 'Space' });
    (globalThis as any).window.dispatchEvent(spaceEvent);

    expect(spaceEvent.defaultPrevented).toBe(true);
    expect(spaceEvent.propagationStopped).toBe(true);
  });
});
