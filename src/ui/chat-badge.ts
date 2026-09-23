import { FLAGS, MODULE_ID, SETTINGS } from '../constants.js';

/**
 * Attaches the physical roll badge to a chat message HTML element if the roll
 * was completed using physical dice.
 *
 * @param message The ChatMessage document or roll data object
 * @param html The HTML container or jQuery array from renderChatMessage
 * @returns boolean indicating whether the badge was attached
 */
export function renderChatBadge(message: any, html: any): boolean {
  const game = (globalThis as any).game;
  const doc = (globalThis as any).document;
  if (!doc) return false;

  const showBadge = game?.settings?.get(MODULE_ID, SETTINGS.SHOW_CHAT_BADGE) ?? true;
  if (!showBadge) return false;

  const isPhysical = message?.rolls?.some((r: any) => r?.options?.[FLAGS.PHYSICAL_ROLL]);
  if (!isPhysical) return false;

  const isElement = (el: any) =>
    (typeof HTMLElement !== 'undefined' && el instanceof HTMLElement) ||
    (el && typeof el.querySelector === 'function');

  const element = isElement(html) ? html : (html?.[0] ?? html);
  if (!isElement(element)) return false;

  const target =
    element.querySelector('.message-header .message-metadata') ||
    element.querySelector('.message-header');
  if (!target) return false;

  if (target.classList?.contains?.('pp-dice-metadata')) return true;
  target.classList?.add('pp-dice-metadata');

  // Wrap existing metadata elements (timestamp, delete icon, etc.) in row 1
  const metaRow = doc.createElement('div');
  metaRow.className = 'pp-dice-meta-row';
  const existingChildren = Array.from((target.children as any[]) || []);
  for (const child of existingChildren) {
    if (target.removeChild) {
      try {
        target.removeChild(child);
      } catch {
        // Ignore if child already detached
      }
    }
    metaRow.appendChild(child);
  }
  target.appendChild(metaRow);

  // Append badge container in row 2
  const container = doc.createElement('div');
  container.className = 'pp-dice-badge-container';

  const badge = doc.createElement('span');
  badge.className = 'pp-dice-chat-tag';
  badge.innerHTML = `<i class="fa-solid fa-dice-d20"></i> ${game?.i18n?.localize('PP_DICE.PhysicalBadge') ?? 'Physical'}`;

  container.appendChild(badge);
  target.appendChild(container);
  return true;
}
