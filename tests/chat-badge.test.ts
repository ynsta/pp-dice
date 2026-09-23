import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderChatBadge } from '../src/ui/chat-badge';
import { FLAGS, MODULE_ID, SETTINGS } from '../src/constants';
import { onDiceSoNiceMessagePreProcess, onPreCreateChatMessage } from '../src/main';
import enJson from '../lang/en.json';
import frJson from '../lang/fr.json';

class MockElement {
  tagName: string;
  className = '';
  innerHTML = '';
  private _textContent = '';
  get textContent(): string {
    if (this._textContent) return this._textContent;
    return this.children.map((c) => c.textContent).join('');
  }
  set textContent(val: string) {
    this._textContent = val;
  }
  children: MockElement[] = [];
  classList: {
    classes: Set<string>;
    add: (c: string) => void;
    contains: (c: string) => boolean;
  };

  constructor(tagName = 'div') {
    this.tagName = tagName.toLowerCase();
    const classes = new Set<string>();
    this.classList = {
      classes,
      add: (c: string) => {
        classes.add(c);
        this.className = Array.from(classes).join(' ');
      },
      contains: (c: string) => classes.has(c),
    };
  }

  get firstChild(): MockElement | null {
    return this.children[0] ?? null;
  }

  get lastElementChild(): MockElement | null {
    return this.children[this.children.length - 1] ?? null;
  }

  parentElement: MockElement | null = null;

  appendChild(child: MockElement) {
    if (child.parentElement) {
      child.parentElement.removeChild(child);
    }
    child.parentElement = this;
    const idx = this.children.indexOf(child);
    if (idx !== -1) {
      this.children.splice(idx, 1);
    }
    this.children.push(child);
    return child;
  }

  removeChild(child: MockElement) {
    const idx = this.children.indexOf(child);
    if (idx !== -1) {
      this.children.splice(idx, 1);
    }
    if (child.parentElement === this) {
      child.parentElement = null;
    }
    return child;
  }

  querySelector(selector: string): MockElement | null {
    if (selector === 'i') {
      if (this.tagName === 'i') return this;
      for (const child of this.children) {
        const found = child.querySelector(selector);
        if (found) return found;
      }
      return null;
    }
    if (selector.includes('.message-header .message-metadata')) {
      const header = this.children.find((c) => c.className.includes('message-header'));
      if (header) {
        return header.children.find((c) => c.className.includes('message-metadata')) ?? null;
      }
      return null;
    }
    if (selector === '.message-header') {
      return this.children.find((c) => c.className.includes('message-header')) ?? null;
    }
    if (selector === '.message-metadata') {
      return this.children.find((c) => c.className.includes('message-metadata')) ?? null;
    }
    if (selector === '.pp-dice-meta-row') {
      if (this.className.includes('pp-dice-meta-row')) return this;
      for (const child of this.children) {
        const found = child.querySelector(selector);
        if (found) return found;
      }
      return null;
    }
    if (selector === '.pp-dice-badge-container') {
      if (this.className.includes('pp-dice-badge-container')) return this;
      for (const child of this.children) {
        const found = child.querySelector(selector);
        if (found) return found;
      }
      return null;
    }
    if (selector === '.pp-dice-chat-tag') {
      if (this.className.includes('pp-dice-chat-tag')) return this;
      for (const child of this.children) {
        const found = child.querySelector(selector);
        if (found) return found;
      }
      return null;
    }
    return null;
  }
}

describe('Chat Badge Localization', () => {
  it('has concise badge text in en.json', () => {
    expect(enJson.PP_DICE.PhysicalBadge).toBe('Physical');
  });

  it('has concise badge text in fr.json', () => {
    expect(frJson.PP_DICE.PhysicalBadge).toBe('Physique');
  });
});

describe('renderChatBadge', () => {
  beforeEach(() => {
    (globalThis as any).document = {
      createElement: (tagName: string) => new MockElement(tagName),
      createTextNode: (text: string) => {
        const el = new MockElement('#text');
        el.textContent = text;
        return el;
      },
    };
    (globalThis as any).game = {
      settings: {
        get: vi.fn((moduleId: string, setting: string) => {
          if (moduleId === MODULE_ID && setting === SETTINGS.SHOW_CHAT_BADGE) return true;
          return undefined;
        }),
      },
      i18n: {
        localize: vi.fn((key: string) => (key === 'PP_DICE.PhysicalBadge' ? 'Physical' : key)),
      },
    };
  });

  it('does nothing when showBadge setting is false', () => {
    (globalThis as any).game.settings.get = vi.fn().mockReturnValue(false);

    const message = { rolls: [{ options: { [FLAGS.PHYSICAL_ROLL]: true } }] };
    const html = new MockElement('li');
    const header = new MockElement('header');
    header.classList.add('message-header');
    const meta = new MockElement('span');
    meta.classList.add('message-metadata');
    header.appendChild(meta);
    html.appendChild(header);

    const result = renderChatBadge(message, html);
    expect(result).toBe(false);
    expect(html.querySelector('.pp-dice-chat-tag')).toBeNull();
  });

  it('does nothing when roll is not physical', () => {
    const message = { rolls: [{ options: {} }] };
    const html = new MockElement('li');
    const header = new MockElement('header');
    header.classList.add('message-header');
    const meta = new MockElement('span');
    meta.classList.add('message-metadata');
    header.appendChild(meta);
    html.appendChild(header);

    const result = renderChatBadge(message, html);
    expect(result).toBe(false);
    expect(html.querySelector('.pp-dice-chat-tag')).toBeNull();
  });

  it('attaches badge container below metadata elements in a flex column when physical roll', () => {
    const message = {
      rolls: [{ options: { [FLAGS.PHYSICAL_ROLL]: true } }],
    };
    const html = new MockElement('li');
    const header = new MockElement('header');
    header.classList.add('message-header');
    const meta = new MockElement('span');
    meta.classList.add('message-metadata');
    const time = new MockElement('time');
    meta.appendChild(time);
    const del = new MockElement('a');
    meta.appendChild(del);
    header.appendChild(meta);
    html.appendChild(header);

    const result = renderChatBadge(message, html);
    expect(result).toBe(true);

    const metadata = header.querySelector('.message-metadata') as MockElement;
    expect(metadata.classList.contains('pp-dice-metadata')).toBe(true);

    // Row 1 should be .pp-dice-meta-row wrapping original elements
    const metaRow = metadata.querySelector('.pp-dice-meta-row') as MockElement;
    expect(metaRow).not.toBeNull();
    expect(metaRow.children).toContain(time);
    expect(metaRow.children).toContain(del);

    // Row 2 should be .pp-dice-badge-container
    const container = metadata.querySelector('.pp-dice-badge-container') as MockElement;
    expect(container).not.toBeNull();
    expect(metadata.lastElementChild).toBe(container);

    const badge = container.querySelector('.pp-dice-chat-tag') as MockElement;
    expect(badge).not.toBeNull();
    const icon = badge.querySelector('i');
    expect(icon).not.toBeNull();
    expect(icon?.className).toBe('fa-solid fa-dice-d20');
    expect(badge.textContent).toContain('Physical');
    expect(badge.innerHTML).toBe('');

    // Idempotency: second call should not re-wrap or duplicate
    const secondCall = renderChatBadge(message, html);
    expect(secondCall).toBe(true);
    expect(metadata.children.length).toBe(2);
  });

  it('accepts plain HTMLElement directly and constructs DOM nodes with textContent (M3, L5)', () => {
    const message = {
      rolls: [{ options: { [FLAGS.PHYSICAL_ROLL]: true } }],
    };
    const html = new MockElement('li');
    const header = new MockElement('header');
    header.classList.add('message-header');
    const meta = new MockElement('span');
    meta.classList.add('message-metadata');
    header.appendChild(meta);
    html.appendChild(header);

    const result = renderChatBadge(message, html as unknown as HTMLElement);
    expect(result).toBe(true);

    const badge = html.querySelector('.pp-dice-chat-tag') as MockElement;
    expect(badge).not.toBeNull();
    const icon = badge.querySelector('i');
    expect(icon).not.toBeNull();
    expect(icon?.className).toBe('fa-solid fa-dice-d20');
    expect(badge.textContent).toContain('Physical');
    expect(badge.innerHTML).toBe('');
  });

  it('works when html is jQuery-like array', () => {
    const message = {
      rolls: [{ options: { [FLAGS.PHYSICAL_ROLL]: true } }],
    };
    const root = new MockElement('li');
    const header = new MockElement('header');
    header.classList.add('message-header');
    const meta = new MockElement('span');
    meta.classList.add('message-metadata');
    header.appendChild(meta);
    root.appendChild(header);
    const jq = [root];

    const result = renderChatBadge(message, jq);
    expect(result).toBe(true);
    expect(root.querySelector('.pp-dice-chat-tag')).not.toBeNull();
  });
});

describe('Dice So Nice 3D Animation Skip Hooks (M2)', () => {
  it('diceSoNiceMessagePreProcess suppresses 3D roll when animateDSN is false and message has physical rolls', () => {
    (globalThis as any).game = {
      settings: {
        get: vi.fn((moduleId: string, setting: string) => {
          if (moduleId === MODULE_ID && setting === SETTINGS.ANIMATE_DSN) return false;
          return undefined;
        }),
      },
      messages: {
        get: vi.fn((id: string) => {
          if (id === 'msg-1') {
            return {
              rolls: [{ options: { [FLAGS.PHYSICAL_ROLL]: true } }],
            };
          }
          return null;
        }),
      },
    };

    const interception = { willTrigger3DRoll: true };
    onDiceSoNiceMessagePreProcess('msg-1', interception);
    expect(interception.willTrigger3DRoll).toBe(false);
  });

  it('diceSoNiceMessagePreProcess does not suppress 3D roll when animateDSN is true', () => {
    (globalThis as any).game = {
      settings: {
        get: vi.fn(() => true),
      },
      messages: {
        get: vi.fn(() => ({
          rolls: [{ options: { [FLAGS.PHYSICAL_ROLL]: true } }],
        })),
      },
    };

    const interception = { willTrigger3DRoll: true };
    onDiceSoNiceMessagePreProcess('msg-1', interception);
    expect(interception.willTrigger3DRoll).toBe(true);
  });

  it('diceSoNiceMessagePreProcess does not suppress 3D roll when message has no physical rolls', () => {
    (globalThis as any).game = {
      settings: {
        get: vi.fn(() => false),
      },
      messages: {
        get: vi.fn(() => ({
          rolls: [{ options: {} }],
        })),
      },
    };

    const interception = { willTrigger3DRoll: true };
    onDiceSoNiceMessagePreProcess('msg-1', interception);
    expect(interception.willTrigger3DRoll).toBe(true);
  });

  it('preCreateChatMessage sets flags.dice-so-nice.skip when animateDSN is false and physical roll', () => {
    (globalThis as any).game = {
      settings: {
        get: vi.fn(() => false),
      },
    };

    const updateSourceSpy = vi.fn();
    const message = {
      rolls: [{ options: { [FLAGS.PHYSICAL_ROLL]: true } }],
      updateSource: updateSourceSpy,
    };

    onPreCreateChatMessage(message);
    expect(updateSourceSpy).toHaveBeenCalledWith({ 'flags.dice-so-nice.skip': true });
  });

  it('preCreateChatMessage sets message.flags fallback when updateSource is absent', () => {
    (globalThis as any).game = {
      settings: {
        get: vi.fn(() => false),
      },
    };

    const message: any = {
      rolls: [{ options: { [FLAGS.PHYSICAL_ROLL]: true } }],
    };

    onPreCreateChatMessage(message);
    expect(message.flags?.['dice-so-nice']?.skip).toBe(true);
  });

  it('preCreateChatMessage does not set skip flag when animateDSN is true', () => {
    (globalThis as any).game = {
      settings: {
        get: vi.fn(() => true),
      },
    };

    const updateSourceSpy = vi.fn();
    const message = {
      rolls: [{ options: { [FLAGS.PHYSICAL_ROLL]: true } }],
      updateSource: updateSourceSpy,
    };

    onPreCreateChatMessage(message);
    expect(updateSourceSpy).not.toHaveBeenCalled();
  });
});
