export interface RollEvaluationContext {
  actor?: any;
  token?: any;
  isPlayer: boolean;
  isSecret: boolean;
  title?: string;
  rollMode?: string;
  sourceSystem?: string;
  isFortune?: boolean;
  isMisfortune?: boolean;
}

export interface RollContextProvider {
  name: string;
  supports(): boolean;
  resolveContext(roll: any, options?: Record<string, any>): RollEvaluationContext | null;
}
