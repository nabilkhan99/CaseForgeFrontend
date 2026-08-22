'use client';

import { useState, type ReactNode } from 'react';

/**
 * Opens the Stripe Customer Portal.
 *
 * Kept a POST + redirect rather than a link: the portal session is short-lived
 * and has to be minted per visit. `flow="subscription_update"` lands the
 * customer straight on the plan switcher, which is how Self-Study -> Complete
 * is sold now that every plan is a subscription — Stripe prices the difference
 * by proration, so the button deliberately quotes no headline figure.
 *
 * One component for both jobs (manage billing / upgrade) so the error handling,
 * the busy state and the endpoint contract cannot drift between the three
 * places they appear.
 */

export interface ManageBillingButtonProps {
  /** Button label at rest. */
  children: ReactNode;
  /** Label while the portal session is being minted. */
  busyLabel?: string;
  /** Which Stripe Portal flow to open on. Omit for the landing page. */
  flow?: 'subscription_update';
  className?: string;
  /** Rendered under the button when the portal could not be opened. */
  errorClassName?: string;
  onStart?: () => void;
}

export default function ManageBillingButton({
  children,
  busyLabel = 'Opening billing…',
  flow,
  className = '',
  errorClassName = 'mt-2 text-[12px] text-danger',
  onStart,
}: ManageBillingButtonProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function open() {
    if (busy) return;
    setBusy(true);
    setError(null);
    onStart?.();
    try {
      const res = await fetch('/api/billing/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(flow ? { flow } : {}),
      });
      const data = (await res.json()) as { url?: string; message?: string; error?: string };
      if (!res.ok || !data.url) {
        setError(data.message ?? data.error ?? 'Could not open billing — please try again.');
        setBusy(false);
        return;
      }
      window.location.assign(data.url);
    } catch {
      setError('Could not open billing — please try again.');
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" onClick={open} disabled={busy} className={className}>
        {busy ? busyLabel : children}
      </button>
      {error && (
        <p role="alert" className={errorClassName}>
          {error}
        </p>
      )}
    </>
  );
}
