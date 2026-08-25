import { ReactNode } from 'react';

interface SettingRowProps {
  /** Short left-hand label, e.g. "Plan". Rendered uppercase. */
  label: string;
  children: ReactNode;
  /** Danger rows (sign out, delete) tint the label rather than boxing the row. */
  tone?: 'default' | 'danger';
  className?: string;
}

/**
 * A labelled row separated by a hairline rule.
 *
 * Settings used to stack `Container` cards, which the design system explicitly
 * rules out ("typography-driven flowing layouts, NOT boxy card grids. Only box
 * things that earn a container."). None of Plan / Profile / Exam earn one, so
 * they became rows. `Container` is left alone — it is used across the app.
 */
export default function SettingRow({
  label,
  children,
  tone = 'default',
  className = '',
}: SettingRowProps) {
  return (
    <div
      className={`grid gap-2 border-t border-black/[0.07] py-6 sm:grid-cols-[132px_1fr] sm:gap-8 ${className}`}
    >
      <div
        className={`pt-0.5 text-[10px] font-semibold uppercase tracking-[0.13em] ${
          tone === 'danger' ? 'text-danger' : 'text-muted'
        }`}
      >
        {label}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
