export interface FoundryActor {
  id: string;
  name: string;
  img?: string;
  type?: string;
  hasPlayerOwner?: boolean;
  parties?: Set<any>;
  system?: {
    details?: {
      alliance?: string;
      [key: string]: any;
    };
    [key: string]: any;
  };
  [key: string]: any;
}

export interface FoundryToken {
  id: string;
  name: string;
  actor?: FoundryActor | null;
  [key: string]: any;
}

export interface FoundryDiceTerm {
  faces: number;
  number?: number;
  denomination?: string;
  results?: Array<{ result: number; active: boolean; [key: string]: any }>;
  _evaluated?: boolean;
  dice?: FoundryDiceTerm[];
  terms?: any[];
  randomFace?: () => number;
  [key: string]: any;
}

export interface FoundryRoll {
  formula: string;
  terms: (FoundryDiceTerm | any)[];
  data?: {
    actor?: FoundryActor;
    token?: FoundryToken;
    [key: string]: any;
  };
  options?: {
    actor?: string | FoundryActor;
    action?: string;
    type?: string;
    identifier?: string;
    domains?: string[];
    traits?: string[];
    messageMode?: string;
    rollMode?: string;
    isPrivate?: boolean;
    origin?: {
      actor?: string;
      [key: string]: any;
    };
    [key: string]: any;
  };
  [key: string]: any;
}
