/**
 * Slim reassurance strip under the pricing table: secure-checkout copy plus
 * muted monochrome payment-method marks. Deliberately quiet — small type, one
 * tone — so it never competes with the plan CTAs above it. Desktop shows one
 * centred row; mobile stacks the copy above the marks, which wrap onto at
 * most two centred rows (constrained width forces the break).
 */

interface PaymentMark {
  label: string;
  node: React.ReactNode;
}

function MastercardMark() {
  return (
    <svg viewBox="0 0 36 22" className="h-[15px] w-auto" role="img" aria-label="Mastercard">
      <title>Mastercard</title>
      <circle cx="13.5" cy="11" r="9" fill="currentColor" opacity="0.6" />
      <circle cx="22.5" cy="11" r="9" fill="currentColor" opacity="0.35" />
    </svg>
  );
}

const PAYMENT_MARKS: PaymentMark[] = [
  {
    label: 'Visa',
    node: <span className="text-[13px] font-extrabold italic tracking-tight">VISA</span>,
  },
  { label: 'Mastercard', node: <MastercardMark /> },
  {
    label: 'American Express',
    node: (
      <span className="rounded-[3px] border border-current px-1 py-[1px] text-[8px] font-bold tracking-[0.08em]">
        AMEX
      </span>
    ),
  },
  {
    label: 'Apple Pay',
    node: <span className="text-xs font-semibold tracking-tight">Apple&nbsp;Pay</span>,
  },
  {
    label: 'Google Pay',
    node: <span className="text-xs font-semibold tracking-tight">G&nbsp;Pay</span>,
  },
  {
    label: 'Klarna',
    node: <span className="text-xs font-semibold tracking-tight">Klarna.</span>,
  },
];

export default function PaymentMethodsRow() {
  return (
    <div className="mt-6 flex flex-col items-center gap-2.5 px-4 sm:flex-row sm:justify-center sm:gap-5">
      <p className="flex items-center gap-1.5 text-[11px] text-muted sm:text-xs">
        <svg
          viewBox="0 0 16 16"
          className="h-3 w-3 shrink-0"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden="true"
        >
          <rect x="3" y="7" width="10" height="7" rx="1.5" />
          <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
        </svg>
        Secure checkout powered by Stripe
      </p>
      <span className="hidden h-3.5 w-px bg-heading/15 sm:block" aria-hidden="true" />
      <ul className="flex max-w-[300px] flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-stone-400 sm:max-w-none">
        {PAYMENT_MARKS.map((mark) => (
          <li key={mark.label} aria-label={mark.label} title={mark.label} className="flex items-center">
            <span aria-hidden="true" className="flex items-center">
              {mark.node}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
