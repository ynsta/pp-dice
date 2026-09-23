import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  extractDiceTerms,
  applyPhysicalResults,
  interceptRollEvaluation,
} from '../src/core/interceptor';
import { contextManager } from '../src/core/context-manager';
import { PPDiceResolver } from '../src/ui/pp-dice-resolver';

describe('Dice Interceptor Engine', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('extracts dice terms recursively from roll terms', () => {
    const terms = [
      { faces: 20, number: 1 },
      { operator: '+' },
      { number: 4 },
      {
        dice: [
          { faces: 6, number: 2 },
          { faces: 8, number: 1 },
        ],
      },
    ];

    const extracted = extractDiceTerms(terms);
    expect(extracted.length).toBe(3);
    expect(extracted.map((t) => t.faces)).toEqual([20, 6, 8]);
  });

  it('applies physical results into DiceTerm results array', () => {
    const d20Term: any = { faces: 20, number: 1, id: 'd20' };
    const d6Term: any = { faces: 6, number: 2, id: 'd6' };

    const valuesMap = new Map();
    valuesMap.set(d20Term, [17]);
    valuesMap.set(d6Term, [4, 5]);

    applyPhysicalResults([d20Term, d6Term], valuesMap);

    expect(d20Term._evaluated).toBe(true);
    expect(d20Term.results).toEqual([{ result: 17, active: true }]);

    expect(d6Term._evaluated).toBe(true);
    expect(d6Term.results).toEqual([
      { result: 4, active: true },
      { result: 5, active: true },
    ]);
  });

  it('bypasses interception when shouldIntercept is false', async () => {
    vi.spyOn(contextManager, 'shouldIntercept').mockReturnValue({
      intercept: false,
      context: { isPlayer: false, isSecret: false },
    });

    const mockWrapped = vi.fn().mockResolvedValue('normal-roll-result');
    const mockRoll = { terms: [{ faces: 20, number: 1 }] };

    const result = await interceptRollEvaluation(mockRoll, mockWrapped, { allowInteractive: true });

    expect(result).toBe('normal-roll-result');
    expect(mockWrapped).toHaveBeenCalledWith({ allowInteractive: true });
  });

  it('injects physical values and calls wrapped with allowInteractive: false', async () => {
    vi.spyOn(contextManager, 'shouldIntercept').mockReturnValue({
      intercept: true,
      context: { isPlayer: true, isSecret: false, title: 'Valeros — Strike' },
    });

    const d20Term: any = { faces: 20, number: 1 };
    const mockRoll = { terms: [d20Term] };

    const valuesMap = new Map();
    valuesMap.set(d20Term, [19]);

    vi.spyOn(PPDiceResolver.prototype, 'awaitInput').mockResolvedValue({
      isDigital: false,
      values: valuesMap,
    });

    const mockWrapped = vi.fn().mockImplementation(async (opts) => {
      expect(opts.allowInteractive).toBe(false);
      return { total: 23, evaluated: true };
    });

    const result = await interceptRollEvaluation(mockRoll, mockWrapped);

    expect(d20Term.results).toEqual([{ result: 19, active: true }]);
    expect(result.total).toBe(23);
    expect(mockWrapped).toHaveBeenCalled();
  });

  it('falls back to wrapped RNG if user selected digital roll', async () => {
    vi.spyOn(contextManager, 'shouldIntercept').mockReturnValue({
      intercept: true,
      context: { isPlayer: true, isSecret: false },
    });

    const d20Term: any = { faces: 20, number: 1 };
    const mockRoll = { terms: [d20Term] };

    vi.spyOn(PPDiceResolver.prototype, 'awaitInput').mockResolvedValue({
      isDigital: true,
    });

    const mockWrapped = vi.fn().mockResolvedValue('digital-fallback-result');
    const result = await interceptRollEvaluation(mockRoll, mockWrapped, { customOpt: true });

    expect(result).toBe('digital-fallback-result');
    expect(mockWrapped).toHaveBeenCalledWith({ customOpt: true });
    expect(d20Term._evaluated).toBeUndefined();
  });
});
