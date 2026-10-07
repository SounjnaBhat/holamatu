export type Lang = 'kn' | 'en';
export type Script = 'KANNADA_SCRIPT' | 'ENGLISH' | 'ROMANIZED_KANNADA' | 'CODE_MIXED';
export type Intent = string | 'explain_why' | 'challenge' | 'consequence' | 'alternative' | 'repeat_simpler' | 'greeting_smalltalk';

export interface SlotValue {
  value: string | number | boolean;
  unit?: string;
  normalized?: string;
}

export interface IntentFrame {
  raw: string;
  normalized: string;
  lang: Lang;
  script: Script;
  intent: Intent;
  intentConfidence: number;
  slots: Record<string, SlotValue>;
  needsClarification: string[];
  profileDefaultsUsed: string[];
}

export type AdviceAction = 'IRRIGATE' | 'WAIT' | 'SCOUT' | 'APPLY' | 'SOW' | 'HARVEST' | 'INFORM';
export type Confidence = 'HIGH' | 'MEDIUM' | 'LOW' | 'DATA_INSUFFICIENT';

export interface Fact {
  label: string;
  value: string | number;
  unit?: string;
  source: string;
}

export interface Evidence {
  ruleIds?: string[];
  modelIds?: string[];
  featureSnapshot?: Record<string, unknown>;
  cardIds?: string[];
}

export interface Advisory {
  intent: Intent;
  headline: AdviceAction;
  facts: Fact[];
  confidence: Confidence;
  evidence: Evidence;
  cautions: string[];
  nextCheck: string | null; // ISO 8601 date string
  templateId: string;
  suggestedFollowUps?: string[];
  traceability?: {
    rule_id?: string;
    rule_version?: string;
    source?: string;
  };
}
