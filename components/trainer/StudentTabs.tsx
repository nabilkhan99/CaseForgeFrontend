'use client';

interface StudentTab {
  /** null is the "All students" tab. */
  userId: string | null;
  label: string;
  colour: string | null;
}

interface StudentTabsProps {
  tabs: StudentTab[];
  selected: string | null;
  onSelect: (userId: string | null) => void;
}

/**
 * Who the page is about. Drives the chart, the stat band AND the list — one
 * control, three consequences, which is why it sits above all three rather
 * than over any one of them.
 *
 * Modelled on the library's StatusChips: a `radiogroup`, not a row of buttons.
 * The tabs are one exclusive choice, so a screen reader should announce it as
 * one — a row of five buttons announces five unrelated controls and never says
 * which is in force.
 */
export default function StudentTabs({ tabs, selected, onSelect }: StudentTabsProps) {
  return (
    <div role="radiogroup" aria-label="Filter by student" className="mb-5 flex flex-wrap gap-1.5">
      {tabs.map((tab) => {
        const active = tab.userId === selected;
        return (
          <button
            key={tab.userId ?? 'all'}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onSelect(tab.userId)}
            className={`flex min-h-[44px] items-center gap-2 rounded-full border px-3.5 text-[13px] font-medium transition-colors sm:min-h-[34px] focus-visible-ring ${
              active
                ? 'border-defined bg-black/[0.04] text-heading'
                : 'border-hairline text-muted hover:bg-black/[0.02] hover:text-heading'
            }`}
          >
            {tab.colour && (
              // The chart's colour for this student, so picking a tab and
              // reading a line are visibly the same act. Decorative — the
              // label beside it is already the name.
              <span
                aria-hidden="true"
                className="h-[7px] w-[7px] flex-shrink-0 rounded-full"
                style={{ background: tab.colour }}
              />
            )}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
