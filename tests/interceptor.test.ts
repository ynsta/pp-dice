import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  extractDiceTerms,
  applyPhysicalResults,
  interceptRollEvaluation,
} from '../src/core/interceptor';
import { contextManager } from '../src/core/context-manager';
import { PPDiceResolver } from '../src/ui/pp-dice-resolver';
import { FLAGS, MODULE_ID, SETTINGS } from '../src/constants';

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

  it('applies physical results into DiceTerm results array without setting _evaluated', () => {
    const d20Term: any = { faces: 20, number: 1, id: 'd20' };
    const d6Term: any = { faces: 6, number: 2, id: 'd6' };

    const valuesMap = new Map();
    valuesMap.set(d20Term, [17]);
    valuesMap.set(d6Term, [4, 5]);

    applyPhysicalResults([d20Term, d6Term], valuesMap);

    expect(d20Term._evaluated).toBeUndefined();
    expect(d20Term.results).toEqual([{ result: 17, active: true }]);

    expect(d6Term._evaluated).toBeUndefined();
    expect(d6Term.results).toEqual([
      { result: 4, active: true },
      { result: 5, active: true },
    ]);
  });

  it('clamps values to [1, term.faces] and floors decimals in applyPhysicalResults (M1)', () => {
    const d20Term: any = { faces: 20, number: 1, id: 'd20' };
    const d6Term: any = { faces: 6, number: 3, id: 'd6' };

    const valuesMap = new Map();
    valuesMap.set(d20Term, [99]);
    valuesMap.set(d6Term, [-5, 0, 4.8]);

    applyPhysicalResults([d20Term, d6Term], valuesMap);

    expect(d20Term.results).toEqual([{ result: 20, active: true }]);
    expect(d6Term.results).toEqual([
      { result: 1, active: true },
      { result: 1, active: true },
      { result: 4, active: true },
    ]);
  });

  it('allows Foundry modifier evaluation for keep-highest (2d20kh) without premature _evaluated flag', async () => {
    vi.spyOn(contextManager, 'shouldIntercept').mockReturnValue({
      intercept: true,
      context: { isPlayer: true, isSecret: false, title: 'Advantage Roll' },
    });

    const d20Term: any = {
      faces: 20,
      number: 2,
      modifiers: ['kh'],
      results: [],
      _evaluated: undefined,
    };
    const mockRoll: any = { formula: '2d20kh', terms: [d20Term] };

    const valuesMap = new Map();
    valuesMap.set(d20Term, [12, 18]);

    vi.spyOn(PPDiceResolver.prototype, 'awaitInput').mockResolvedValue({
      isDigital: false,
      values: valuesMap,
    });

    const mockWrapped = vi.fn().mockImplementation(async (opts) => {
      expect(opts.allowInteractive).toBe(false);
      // Verify term has physical results but _evaluated is NOT set to true prematurely
      expect(d20Term._evaluated).toBeUndefined();
      expect(d20Term.results).toEqual([
        { result: 12, active: true },
        { result: 18, active: true },
      ]);

      // Simulate Foundry's DiceTerm._evaluateModifiers() & _evaluateAsync()
      // Lower die 12 is marked inactive, kept die 18 stays active
      d20Term.results[0].active = false;
      d20Term._evaluated = true;
      return { total: 18, evaluated: true };
    });

    const result = await interceptRollEvaluation(mockRoll, mockWrapped);

    expect(result.total).toBe(18);
    expect(d20Term._evaluated).toBe(true);
    expect(d20Term.results[0].active).toBe(false);
    expect(d20Term.results[1].active).toBe(true);
    expect(mockRoll.options[FLAGS.PHYSICAL_ROLL]).toBe(true);
    expect(mockWrapped).toHaveBeenCalledOnce();
  });

  it('bypasses interception when shouldIntercept is false', async () => {
    vi.spyOn(contextManager, 'shouldIntercept').mockReturnValue({
      intercept: false,
      context: { isPlayer: false, isSecret: false },
    });

    const mockWrapped = vi.fn().mockResolvedValue('normal-roll-result');
    const mockRoll = { formula: '1d20+4', terms: [{ faces: 20, number: 1 }] };

    const result = await interceptRollEvaluation(mockRoll, mockWrapped, { allowInteractive: true });

    expect(result).toBe('normal-roll-result');
    expect(mockWrapped).toHaveBeenCalledWith({ allowInteractive: true });
  });

  it('injects physical values, sets physical flag, and calls wrapped with allowInteractive: false', async () => {
    vi.spyOn(contextManager, 'shouldIntercept').mockReturnValue({
      intercept: true,
      context: { isPlayer: true, isSecret: false, title: 'Valeros — Strike' },
    });

    const d20Term: any = { faces: 20, number: 1 };
    const mockRoll: any = { formula: '1d20+4', terms: [d20Term] };

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
    expect(mockRoll.options[FLAGS.PHYSICAL_ROLL]).toBe(true);
    expect(result.total).toBe(23);
    expect(mockWrapped).toHaveBeenCalled();
  });

  it('falls back to wrapped RNG if user selected digital roll', async () => {
    vi.spyOn(contextManager, 'shouldIntercept').mockReturnValue({
      intercept: true,
      context: { isPlayer: true, isSecret: false },
    });

    const d20Term: any = { faces: 20, number: 1 };
    const mockRoll: any = { formula: '1d20+4', terms: [d20Term] };

    vi.spyOn(PPDiceResolver.prototype, 'awaitInput').mockResolvedValue({
      isDigital: true,
    });

    const mockWrapped = vi.fn().mockResolvedValue('digital-fallback-result');
    const result = await interceptRollEvaluation(mockRoll, mockWrapped, { customOpt: true });

    expect(result).toBe('digital-fallback-result');
    expect(mockWrapped).toHaveBeenCalledWith({ customOpt: true });
    expect(d20Term._evaluated).toBeUndefined();
    expect(mockRoll.options?.[FLAGS.PHYSICAL_ROLL]).toBeUndefined();
  });

  it('processes sequential roll requests in order without collision', async () => {
    vi.spyOn(contextManager, 'shouldIntercept').mockReturnValue({
      intercept: true,
      context: { isPlayer: true, isSecret: false },
    });

    const order: number[] = [];

    const roll1: any = { formula: '1d20', terms: [{ faces: 20, number: 1 }] };
    const roll2: any = { formula: '1d20', terms: [{ faces: 20, number: 1 }] };

    let callCount = 0;
    vi.spyOn(PPDiceResolver.prototype, 'awaitInput').mockImplementation(async () => {
      callCount++;
      const currentCall = callCount;
      // Simulate delay for first roll
      await new Promise((r) => setTimeout(r, currentCall === 1 ? 20 : 5));
      order.push(currentCall);
      return { isDigital: true };
    });

    const p1 = interceptRollEvaluation(roll1, vi.fn());
    const p2 = interceptRollEvaluation(roll2, vi.fn());

    await Promise.all([p1, p2]);

    expect(order).toEqual([1, 2]);
  });

  it('falls back to wrapped RNG when resolver rejects / throws', async () => {
    vi.spyOn(contextManager, 'shouldIntercept').mockReturnValue({
      intercept: true,
      context: { isPlayer: true, isSecret: false },
    });

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const d20Term: any = { faces: 20, number: 1 };
    const mockRoll: any = { formula: '1d20+4', terms: [d20Term] };

    vi.spyOn(PPDiceResolver.prototype, 'awaitInput').mockRejectedValue(
      new Error('Resolver dialog error')
    );

    const mockWrapped = vi.fn().mockResolvedValue('digital-fallback-result');
    const result = await interceptRollEvaluation(mockRoll, mockWrapped, { customOpt: 'abc' });

    expect(result).toBe('digital-fallback-result');
    expect(mockWrapped).toHaveBeenCalledWith({ customOpt: 'abc' });
    expect(consoleSpy).toHaveBeenCalled();
    expect(mockRoll.options?.[FLAGS.PHYSICAL_ROLL]).toBeUndefined();
  });

  it('does not re-invoke wrapped on mutated state if native evaluation throws', async () => {
    vi.spyOn(contextManager, 'shouldIntercept').mockReturnValue({
      intercept: true,
      context: { isPlayer: true, isSecret: false },
    });

    const d20Term: any = { faces: 20, number: 1 };
    const mockRoll: any = { formula: '1d20+4', terms: [d20Term] };

    const valuesMap = new Map();
    valuesMap.set(d20Term, [15]);

    vi.spyOn(PPDiceResolver.prototype, 'awaitInput').mockResolvedValue({
      isDigital: false,
      values: valuesMap,
    });

    const mockWrapped = vi.fn().mockRejectedValue(new Error('Native evaluation syntax failure'));

    await expect(interceptRollEvaluation(mockRoll, mockWrapped)).rejects.toThrow(
      'Native evaluation syntax failure'
    );

    // Ensure wrapped was only called once with physical flags, not retried
    expect(mockWrapped).toHaveBeenCalledOnce();
    expect(mockWrapped).toHaveBeenCalledWith({ allowInteractive: false });
  });

  it('bypasses interception when roll is a sub-roll (_root is set) (M4)', async () => {
    const shouldInterceptSpy = vi.spyOn(contextManager, 'shouldIntercept');
    const mockWrapped = vi.fn().mockResolvedValue('sub-roll-result');
    const subRoll: any = {
      formula: '1d4',
      terms: [{ faces: 4, number: 1 }],
      _root: { formula: '(1d4)d6' },
    };

    const result = await interceptRollEvaluation(subRoll, mockWrapped, { allowInteractive: false });

    expect(result).toBe('sub-roll-result');
    expect(mockWrapped).toHaveBeenCalledWith({ allowInteractive: false });
    expect(shouldInterceptSpy).not.toHaveBeenCalled();
  });

  it('does not mutate options.skip3d or roll.ghost during physical roll evaluation (M2)', async () => {
    (globalThis as any).game = {
      settings: {
        get: vi.fn((moduleId: string, setting: string) => {
          if (moduleId === MODULE_ID && setting === SETTINGS.ANIMATE_DSN) return false;
          return undefined;
        }),
      },
    };

    vi.spyOn(contextManager, 'shouldIntercept').mockReturnValue({
      intercept: true,
      context: { isPlayer: true, isSecret: false, title: 'Strike' },
    });

    const d20Term: any = { faces: 20, number: 1 };
    const mockRoll: any = { formula: '1d20+4', terms: [d20Term], options: {} };
    const valuesMap = new Map();
    valuesMap.set(d20Term, [19]);

    vi.spyOn(PPDiceResolver.prototype, 'awaitInput').mockResolvedValue({
      isDigital: false,
      values: valuesMap,
    });

    const options: Record<string, any> = { customOpt: true };
    const mockWrapped = vi.fn().mockImplementation(async () => {
      return { total: 23, evaluated: true };
    });

    await interceptRollEvaluation(mockRoll, mockWrapped, options);

    expect(options.skip3d).toBeUndefined();
    expect((mockRoll as any).ghost).toBeUndefined();
  });
});
