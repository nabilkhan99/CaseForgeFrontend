import type { CSSProperties, ReactNode } from 'react';

/**
 * Shared editorial primitives for the landing reskin — warm wash, crosshatch
 * surface texture, pill kickers and serif accent words. Ported from the
 * feature/preorder-landing v6 exploration.
 */

/** Subtle crosshatch ("+") texture — Confetto-style surface detail. */
export const CROSSHATCH: CSSProperties = {
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='28'%3E%3Cpath d='M14 10v8M10 14h8' stroke='%231C1917' stroke-opacity='0.05' stroke-width='1'/%3E%3C/svg%3E\")",
};

export const CROSSHATCH_DARK: CSSProperties = {
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='28'%3E%3Cpath d='M14 10v8M10 14h8' stroke='%23FAFAF7' stroke-opacity='0.07' stroke-width='1'/%3E%3C/svg%3E\")",
};

/** The soft warm page wash behind everything. */
export const WASH: CSSProperties = {
  background:
    'radial-gradient(1100px 500px at 85% -5%, rgba(217,119,6,0.08) 0%, transparent 60%), radial-gradient(900px 480px at -10% 20%, rgba(180,83,9,0.05) 0%, transparent 55%), #FAF6EC',
};

/** Soft tile surface — the one card treatment sections share. */
export const TILE =
  'rounded-3xl border border-heading/[0.06] bg-white/80 shadow-elevation-2 backdrop-blur';

/** Pill badge used as the section kicker. */
export function Pill({
  children,
  dark = false,
  className = '',
}: {
  children: ReactNode;
  dark?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-[13px] font-medium ${
        dark
          ? 'border-white/15 bg-white/[0.06] text-[#FAC775]'
          : 'border-primary/20 bg-white/70 text-primary shadow-sm'
      } ${className}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${dark ? 'bg-[#FAC775]' : 'bg-primary'}`}
        aria-hidden="true"
      />
      {children}
    </span>
  );
}

/** DM Serif italic accent phrase inside a grotesque headline. */
export function Accent({
  children,
  dark = false,
  className = '',
}: {
  children: ReactNode;
  dark?: boolean;
  /** Overrides the accent colour — needed on surfaces the two defaults were
   *  not picked against, such as the amber guarantee card. */
  className?: string;
}) {
  return (
    <span
      className={`font-[family-name:var(--font-serif)] italic font-normal ${
        dark ? 'text-[#EF9F27]' : 'text-primary'
      } ${className}`}
    >
      {children}
    </span>
  );
}
