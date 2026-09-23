import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  mapLegacyRollMode,
  isSecretRoll,
  isFortuneRoll,
  isMisfortuneRoll,
} from '../src/core/roll-helpers';

describe('Roll Helpers', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    (globalThis as any).game = undefined;
  });

  describe('mapLegacyRollMode', () => {
    it('maps legacy roll modes to v14 messageMode values', () => {
      expect(mapLegacyRollMode('publicroll')).toBe('public');
      expect(mapLegacyRollMode('roll')).toBe('public');
      expect(mapLegacyRollMode('gmroll')).toBe('gm');
      expect(mapLegacyRollMode('blindroll')).toBe('blind');
      expect(mapLegacyRollMode('selfroll')).toBe('self');
    });

    it('passes through undefined or unknown modes unchanged', () => {
      expect(mapLegacyRollMode(undefined)).toBeUndefined();
      expect(mapLegacyRollMode('public')).toBe('public');
      expect(mapLegacyRollMode('customMode')).toBe('customMode');
    });
  });

  describe('isSecretRoll (H4)', () => {
    it('detects secret rolls across v14 messageMode values (H4)', () => {
      expect(isSecretRoll({ options: { messageMode: 'public' } })).toBe(false);
      expect(isSecretRoll({ options: { messageMode: 'gm' } })).toBe(true);
      expect(isSecretRoll({ options: { messageMode: 'blind' } })).toBe(true);
      expect(isSecretRoll({ options: { messageMode: 'self' } })).toBe(true);
      expect(isSecretRoll({ options: { rollMode: 'selfroll' } })).toBe(true);
      expect(isSecretRoll({ options: { rollMode: 'gmroll' } })).toBe(true);
      expect(isSecretRoll({ options: { rollMode: 'blindroll' } })).toBe(true);
      expect(isSecretRoll({ options: { rollMode: 'roll' } })).toBe(false);
      expect(isSecretRoll({ options: { rollMode: 'publicroll' } })).toBe(false);
    });

    it('considers non-interactive rolls and private rolls secret', () => {
      expect(isSecretRoll({ options: {} }, { allowInteractive: false })).toBe(true);
      expect(isSecretRoll({ options: { isPrivate: true } })).toBe(true);
    });

    it('falls back to core.messageMode game setting if not specified on roll or options', () => {
      (globalThis as any).game = {
        settings: {
          get: vi.fn((module: string, setting: string) => {
            if (module === 'core' && setting === 'messageMode') return 'blind';
            return null;
          }),
        },
      };

      expect(isSecretRoll({ options: {} })).toBe(true);
      expect((globalThis as any).game.settings.get).toHaveBeenCalledWith('core', 'messageMode');
    });

    it('falls back to public when setting is public and no secret traits/domains exist', () => {
      (globalThis as any).game = {
        settings: {
          get: vi.fn((module: string, setting: string) => {
            if (module === 'core' && setting === 'messageMode') return 'public';
            return null;
          }),
        },
      };

      expect(isSecretRoll({ options: {} })).toBe(false);
    });

    it('detects secret rolls from PF2e domains or traits', () => {
      expect(isSecretRoll({ options: { domains: ['secret', 'perception'] } })).toBe(true);
      expect(isSecretRoll({ options: { traits: ['secret', 'exploration'] } })).toBe(true);
      expect(isSecretRoll({ options: { domains: ['attack-roll'], traits: ['attack'] } })).toBe(
        false
      );
    });
  });

  describe('isFortuneRoll & isMisfortuneRoll (M5)', () => {
    it('detects fortune and misfortune only on 2d20 with modifiers, not flavor text (M5)', () => {
      const khopeshRoll = {
        formula: '1d20 + 5[khopesh]',
        terms: [{ faces: 20, number: 1, modifiers: [] }],
      };
      expect(isFortuneRoll(khopeshRoll)).toBe(false);

      const fortuneRoll = {
        formula: '2d20kh',
        terms: [{ faces: 20, number: 2, modifiers: ['kh'] }],
      };
      expect(isFortuneRoll(fortuneRoll)).toBe(true);

      const fortuneRollKh1 = {
        formula: '2d20kh1',
        terms: [{ faces: 20, number: 2, modifiers: ['kh1'] }],
      };
      expect(isFortuneRoll(fortuneRollKh1)).toBe(true);

      const misfortuneRoll = {
        formula: '2d20kl',
        terms: [{ faces: 20, number: 2, modifiers: ['kl'] }],
      };
      expect(isMisfortuneRoll(misfortuneRoll)).toBe(true);

      const misfortuneRollKl1 = {
        formula: '2d20kl1',
        terms: [{ faces: 20, number: 2, modifiers: ['kl1'] }],
      };
      expect(isMisfortuneRoll(misfortuneRollKl1)).toBe(true);
    });

    it('does not trigger fortune for non-d20 keep-highest rolls like 4d6kh3', () => {
      const abilityScoreRoll = {
        formula: '4d6kh3',
        terms: [{ faces: 6, number: 4, modifiers: ['kh3'] }],
      };
      expect(isFortuneRoll(abilityScoreRoll)).toBe(false);
      expect(isMisfortuneRoll(abilityScoreRoll)).toBe(false);
    });

    it('detects fortune and misfortune from rollTwice option and domains', () => {
      expect(isFortuneRoll({ options: { rollTwice: 'keep-higher' } })).toBe(true);
      expect(isMisfortuneRoll({ options: { rollTwice: 'keep-lower' } })).toBe(true);
      expect(isFortuneRoll({ options: { domains: ['fortune'] } })).toBe(true);
      expect(isMisfortuneRoll({ options: { domains: ['misfortune'] } })).toBe(true);
    });
  });
});
