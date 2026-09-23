import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderChatBadge } from '../src/ui/chat-badge.js';
import { FLAGS, MODULE_ID, SETTINGS } from '../src/constants.js';
import enJson from '../lang/en.json';
import frJson from '../lang/fr.json';

class MockElement {
  tagName: string;
  className = '';
  innerHTML = '';
  textContent = '';
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

  get lastElementChild(): MockElement | null {
    return this.children[this.children.length - 1] ?? null;
  }

  appendChild(child: MockElement) {
    this.children.push(child);
    return child;
  }

  querySelector(selector: string): MockElement | null {
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
    if (selector === '.pp-dice-badge-container') {
      return this.children.find((c) => c.className.includes('pp-dice-badge-container')) ?? null;
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

  it('attaches badge container below metadata elements when physical roll', () => {
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
    header.appendChild(meta);
    html.appendChild(header);

    const result = renderChatBadge(message, html);
    expect(result).toBe(true);

    const metadata = header.querySelector('.message-metadata') as MockElement;
    expect(metadata.classList.contains('pp-dice-metadata')).toBe(true);

    const container = metadata.querySelector('.pp-dice-badge-container') as MockElement;
    expect(container).not.toBeNull();
    // Container should be appended at the end
    expect(metadata.lastElementChild).toBe(container);

    const badge = container.querySelector('.pp-dice-chat-tag') as MockElement;
    expect(badge).not.toBeNull();
    expect(badge.innerHTML).toContain('fa-dice-d20');
    expect(badge.innerHTML).toContain('Physical');
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
