/**
 * Cross-case trend report types (FF SCA Build Package Section 13.5).
 */

export interface TrendEvidence {
  case_id: string;
  completed_at?: string | null;
  quote: string;
  timestamp_ms?: number | null;
}

export interface TrendTheme {
  priority: number;
  theme_label: string;
  mapped_statement?: string | null;
  domain?: string | null;
  capability_area?: string | null;
  frequency: number;
  max_consequence_tier: number;
  trajectory?: 'improving' | 'static' | 'declining' | null;
  context_pattern?: string | null;
  evidence: TrendEvidence[];
  development_suggestion?: { narrative: string; source: string } | null;
}

export interface TrendStrength {
  theme_label: string;
  domain?: string | null;
  evidence_count: number;
}

export interface TrendReport {
  candidate_id: string;
  window?: { from?: string | null; to?: string | null; cases_included: number } | null;
  confidence: 'low' | 'medium' | 'high';
  overall_trajectory: 'improving' | 'static' | 'declining';
  overall_narrative: string;
  recurring_themes: TrendTheme[];
  style_patterns: TrendTheme[];
  consistent_strengths: TrendStrength[];
  next_steps: string[];
  caution: string;
}
