/**
 * Shared domain metadata — icons (as SVG path descriptions) and colors.
 * Used by the library pages and dashboard components.
 */

export const DOMAIN_COLORS = [
  'rgba(180,83,9,0.08)',
  'rgba(34,197,94,0.08)',
  'rgba(59,130,246,0.08)',
  'rgba(168,85,247,0.08)',
  'rgba(236,72,153,0.08)',
  'rgba(245,158,11,0.08)',
  'rgba(20,184,166,0.08)',
  'rgba(99,102,241,0.08)',
  'rgba(239,68,68,0.08)',
  'rgba(16,185,129,0.08)',
  'rgba(251,146,60,0.08)',
  'rgba(139,92,246,0.08)',
];

export const DOMAIN_TEXT_COLORS = [
  '#92400E',
  '#166534',
  '#1E40AF',
  '#6B21A8',
  '#9D174D',
  '#92400E',
  '#115E59',
  '#3730A3',
  '#991B1B',
  '#065F46',
  '#9A3412',
  '#5B21B6',
];

export function getDomainColor(domainName: string, index: number) {
  return {
    bg: DOMAIN_COLORS[index % DOMAIN_COLORS.length],
    text: DOMAIN_TEXT_COLORS[index % DOMAIN_TEXT_COLORS.length],
  };
}
