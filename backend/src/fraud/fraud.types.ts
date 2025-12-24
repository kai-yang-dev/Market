export type FraudConfidence = 'low' | 'medium' | 'high';

export interface FraudDecision {
  fraud: boolean;
  category?: string | null;
  reason?: string | null;
  confidence?: FraudConfidence;
  signals?: string[];
}


