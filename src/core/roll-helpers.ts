/**
 * Maps legacy Foundry rollMode values to v14 messageMode values.
 */
export function mapLegacyRollMode(rollMode?: string): string | undefined {
  switch (rollMode) {
    case 'publicroll':
    case 'roll':
      return 'public';
    case 'gmroll':
      return 'gm';
    case 'blindroll':
      return 'blind';
    case 'selfroll':
      return 'self';
    default:
      return rollMode;
  }
}

/**
 * Checks if a roll is secret, blind, or GM-only (H4).
 * Unifies options.messageMode, roll.options.messageMode, legacy rollMode,
 * core.messageMode setting, and PF2e secret domains/traits.
 */
export function isSecretRoll(roll: any, options: Record<string, any> = {}): boolean {
  if (options?.allowInteractive === false) return true;
  if (roll?.options?.isPrivate === true) return true;

  const game = (globalThis as any).game;
  const rawMode =
    options?.messageMode ??
    mapLegacyRollMode(options?.rollMode) ??
    roll?.options?.messageMode ??
    mapLegacyRollMode(roll?.options?.rollMode) ??
    game?.settings?.get?.('core', 'messageMode') ??
    'public';

  const mode = mapLegacyRollMode(rawMode);
  if (mode && mode !== 'public') {
    return true;
  }

  // Check PF2e traits or domains if present
  const domains = roll?.options?.domains;
  if (Array.isArray(domains) && domains.includes('secret')) return true;

  const traits = roll?.options?.traits;
  if (Array.isArray(traits) && traits.includes('secret')) return true;

  return false;
}

/**
 * Helper to recursively extract terms with faces from roll terms or dice.
 */
function findDiceTerms(terms: any[]): any[] {
  const result: any[] = [];
  function traverse(list: any[]) {
    if (!Array.isArray(list)) return;
    for (const term of list) {
      if (term && typeof term.faces === 'number') {
        result.push(term);
      }
      if (term?.dice && Array.isArray(term.dice)) traverse(term.dice);
      if (term?.terms && Array.isArray(term.terms)) traverse(term.terms);
    }
  }
  traverse(terms);
  return result;
}

/**
 * Checks if a roll represents fortune (advantage / roll twice keep higher) (M5).
 * Inspects term properties (2d20 with kh/kh1 modifier), domains, or rollTwice option.
 */
export function isFortuneRoll(roll: any): boolean {
  if (roll?.options?.rollTwice === 'keep-higher') return true;
  const domains = roll?.options?.domains;
  if (Array.isArray(domains) && domains.includes('fortune')) return true;

  const terms = Array.isArray(roll?.terms)
    ? findDiceTerms(roll.terms)
    : Array.isArray(roll?.dice)
      ? findDiceTerms(roll.dice)
      : [];

  return terms.some(
    (t: any) =>
      t &&
      t.faces === 20 &&
      t.number === 2 &&
      Array.isArray(t.modifiers) &&
      t.modifiers.some((m: string) => {
        const lower = typeof m === 'string' ? m.toLowerCase() : '';
        return lower === 'kh' || lower === 'kh1';
      })
  );
}

/**
 * Checks if a roll represents misfortune (disadvantage / roll twice keep lower) (M5).
 * Inspects term properties (2d20 with kl/kl1 modifier), domains, or rollTwice option.
 */
export function isMisfortuneRoll(roll: any): boolean {
  if (roll?.options?.rollTwice === 'keep-lower') return true;
  const domains = roll?.options?.domains;
  if (Array.isArray(domains) && domains.includes('misfortune')) return true;

  const terms = Array.isArray(roll?.terms)
    ? findDiceTerms(roll.terms)
    : Array.isArray(roll?.dice)
      ? findDiceTerms(roll.dice)
      : [];

  return terms.some(
    (t: any) =>
      t &&
      t.faces === 20 &&
      t.number === 2 &&
      Array.isArray(t.modifiers) &&
      t.modifiers.some((m: string) => {
        const lower = typeof m === 'string' ? m.toLowerCase() : '';
        return lower === 'kl' || lower === 'kl1';
      })
  );
}
