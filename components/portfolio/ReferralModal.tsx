'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { trackEvent } from '@/lib/analytics';
import {
    DISCLOSURE,
    HOW_IT_WORKS,
    LINKS_CLOSE_LABEL,
    MARKETING_NOTICE,
    REWARD_TABLE,
    SPLIT_POT,
} from './referralCopy';

interface ReferralModalProps {
    isOpen: boolean;
    onClose: () => void;
}

interface IssuedLink {
    referralUrl: string;
    shareUrl: string;
    existing: boolean;
    emailSent: boolean;
}

/**
 * The refer-a-friend modal behind both instances of the referral strip.
 *
 * Accessibility note: this is the first modal in the repo to declare
 * `role="dialog"` / `aria-modal="true"` and to move focus on open and restore it
 * on close. The existing modals (FeedbackModal, ConfirmModal) do none of that,
 * so this is written as the pattern to copy rather than a copy of the pattern.
 *
 * Compliance notes, both load-bearing and both deliberately NOT tidied away:
 *  - The DMCCA 2024 disclosure sits as visible body text in the modal. It must
 *    not be moved behind the terms link, because the point of it is that the
 *    commercial nature of the recommendation is apparent before someone shares.
 *  - The marketing line is a NOTICE, not a consent checkbox, and the emails it
 *    describes carry an unsubscribe (PECR).
 */
export default function ReferralModal({ isOpen, onClose }: ReferralModalProps) {
    const [email, setEmail] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [issued, setIssued] = useState<IssuedLink | null>(null);
    const [copied, setCopied] = useState(false);

    const titleId = useId();
    const emailId = useId();
    const dialogRef = useRef<HTMLDivElement>(null);
    const restoreFocusTo = useRef<HTMLElement | null>(null);

    // Escape closes, focus moves in on open and back to the trigger on close.
    //
    // Focus lands on the DIALOG, not on the email input. This modal is taller
    // than a laptop viewport and the input sits at the bottom of it, so focusing
    // the input scrolls the container straight past the title, the reward table
    // and the disclosure — including the DMCCA line, which is required to be
    // seen. `preventScroll` keeps the view where it belongs, and the dialog
    // being focusable (tabIndex -1) is what lets a screen reader announce the
    // title it is labelled by.
    useEffect(() => {
        if (!isOpen) return;
        restoreFocusTo.current = document.activeElement as HTMLElement | null;
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleKey);
        const focusTimer = window.setTimeout(
            () => dialogRef.current?.focus({ preventScroll: true }),
            60,
        );
        return () => {
            document.removeEventListener('keydown', handleKey);
            window.clearTimeout(focusTimer);
            restoreFocusTo.current?.focus?.();
        };
    }, [isOpen, onClose]);

    const handleSubmit = useCallback(
        async (e: React.FormEvent) => {
            e.preventDefault();
            const trimmed = email.trim();
            if (!trimmed || isSubmitting) return;

            setIsSubmitting(true);
            setError(null);
            try {
                const res = await fetch('/api/referral/link', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: trimmed }),
                });
                const data = await res.json().catch(() => null);
                if (!res.ok || !data?.referralUrl) {
                    setError(data?.error ?? 'Something went wrong. Please try again.');
                    trackEvent('referral_link_failed', {
                        reason: data?.error ?? `http_${res.status}`,
                    });
                } else {
                    setIssued(data as IssuedLink);
                    // The email is the point: it identifies the sharer, so a
                    // click on their code can be traced back to a person.
                    trackEvent('referral_link_requested', {
                        email: trimmed.toLowerCase(),
                        existing: Boolean(data.existing),
                        email_sent: Boolean(data.emailSent),
                    });
                }
            } catch {
                setError('Could not reach us just then. Please try again.');
            }
            setIsSubmitting(false);
        },
        [email, isSubmitting],
    );

    const handleCopy = useCallback(async () => {
        if (!issued) return;
        try {
            await navigator.clipboard.writeText(issued.referralUrl);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2000);
            // The closest signal to an actual share — they have the link in
            // hand and are on their way to paste it somewhere.
            trackEvent('referral_link_copied', {});
        } catch {
            // Clipboard blocked (insecure context, permissions): the link is on
            // screen and selectable, so there is nothing to recover from.
        }
    }, [issued]);

    return (
        <AnimatePresence>
            {isOpen && (
                /* ONE keyed motion child, not a fragment wrapping two. A
                   fragment is a single unkeyed child as far as AnimatePresence
                   is concerned, which is the shape its docs warn against: it
                   cannot reliably track the exit of what sits inside one.

                   The container is a scrolling BLOCK, not a centred flex box.
                   This modal is taller than a laptop viewport, and flex centring
                   pushes the top of an over-tall child out of the scroll range
                   entirely, making the title unreachable. Normal flow inside
                   `overflow-y-auto` always starts at the top. */
                <motion.div
                    key="referral-modal"
                    className="fixed inset-0 z-[60] overflow-y-auto p-4 sm:p-6"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    onClick={onClose}
                >
                    {/* Backdrop. `fixed` rather than `absolute` so it stays put
                        when the container scrolls. */}
                    <div className="fixed inset-0 bg-heading/40" aria-hidden="true" />

                    <motion.div
                        ref={dialogRef}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby={titleId}
                        tabIndex={-1}
                        className="relative mx-auto w-full max-w-lg rounded-3xl border border-hairline bg-surface-raised p-6 shadow-elevation-4 focus:outline-none sm:p-8"
                        initial={{ scale: 0.97, y: 12 }}
                        animate={{ scale: 1, y: 0 }}
                        exit={{ scale: 0.97, y: 12 }}
                        transition={{ duration: 0.18 }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-start justify-between gap-4">
                            <h2
                                id={titleId}
                                className="text-[22px] font-semibold leading-tight tracking-tight text-heading sm:text-2xl"
                            >
                                Split {SPLIT_POT} with your mates
                            </h2>
                            <button
                                type="button"
                                onClick={onClose}
                                aria-label="Close"
                                className="-mr-1 -mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-heading/[0.04] hover:text-heading"
                            >
                                <svg
                                    width="16"
                                    height="16"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    aria-hidden="true"
                                >
                                    <path d="M18 6L6 18M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <p className="mt-3 text-[15px] leading-relaxed text-body">
                            Send your personal link to another GP trainee preparing for the SCA and
                            you both get paid.
                        </p>

                        <h3 className="mt-7 font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
                            What you both get
                        </h3>
                        <table className="mt-3 w-full border-collapse text-[14px]">
                            <thead>
                                <tr className="border-b border-hairline text-left text-[13px] text-muted">
                                    <th className="py-2 pr-3 font-normal">They join</th>
                                    <th className="py-2 pr-3 font-normal">You get</th>
                                    <th className="py-2 font-normal">They get</th>
                                </tr>
                            </thead>
                            <tbody>
                                {REWARD_TABLE.map(row => (
                                    <tr key={row.plan} className="border-b border-hairline">
                                        <td className="py-2.5 pr-3 text-body">{row.plan}</td>
                                        <td className="py-2.5 pr-3 font-semibold text-heading">
                                            {row.sharer}
                                        </td>
                                        <td className="py-2.5 font-semibold text-heading">
                                            {row.friend}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <p className="mt-3 text-[13px] leading-relaxed text-muted">
                            Paid by bank transfer once their order is confirmed. Their course stays
                            full price on a full-price receipt.
                        </p>

                        <h3 className="mt-7 font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
                            How it works
                        </h3>
                        <ol className="mt-3 space-y-2.5">
                            {HOW_IT_WORKS.map((step, i) => (
                                <li
                                    key={step}
                                    className="flex gap-3 text-[14px] leading-relaxed text-body"
                                >
                                    <span
                                        aria-hidden="true"
                                        className="w-4 flex-shrink-0 font-mono text-[12px] text-muted"
                                    >
                                        {i + 1}
                                    </span>
                                    {step}
                                </li>
                            ))}
                        </ol>
                        <p className="mt-4 text-[14px] leading-relaxed text-body">
                            {
                                "There's no cap. Every friend who joins through your link pays out again."
                            }
                        </p>
                        <p className="mt-2 text-[14px] leading-relaxed text-body">
                            Your link comes with its own page, so you can see clicks, sign-ups and
                            payments as they come in.
                        </p>
                        <p className="mt-2 text-[14px] leading-relaxed text-body">
                            Links are live until {LINKS_CLOSE_LABEL}.
                        </p>

                        <div className="mt-7 border-t border-hairline pt-6">
                            {issued ? (
                                <div>
                                    <h3 className="text-[15px] font-semibold text-heading">
                                        {issued.existing
                                            ? 'You already have a link'
                                            : 'Your link is ready'}
                                    </h3>
                                    <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
                                        {issued.emailSent
                                            ? "We've emailed it to you as well."
                                            : 'Copy it now and keep it somewhere safe.'}
                                    </p>
                                    <div className="mt-3 flex flex-wrap items-center gap-2">
                                        <code className="min-w-0 flex-1 truncate rounded-xl border border-hairline bg-surface px-3 py-2.5 font-mono text-[13px] text-heading">
                                            {issued.referralUrl}
                                        </code>
                                        <button
                                            type="button"
                                            onClick={handleCopy}
                                            className="flex-shrink-0 rounded-xl bg-primary px-4 py-2.5 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
                                        >
                                            {copied ? 'Copied' : 'Copy link'}
                                        </button>
                                    </div>
                                    <Link
                                        href={issued.shareUrl}
                                        className="mt-3 inline-block text-[13px] font-medium text-body underline decoration-heading/30 underline-offset-4 transition hover:text-heading"
                                    >
                                        Open your tracker page
                                    </Link>
                                </div>
                            ) : (
                                <form onSubmit={handleSubmit} noValidate>
                                    <h3 className="text-[15px] font-semibold text-heading">
                                        Get your link
                                    </h3>
                                    <label htmlFor={emailId} className="sr-only">
                                        Email address
                                    </label>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        <input
                                            id={emailId}
                                            type="email"
                                            required
                                            autoComplete="email"
                                            inputMode="email"
                                            placeholder="Email address"
                                            value={email}
                                            onChange={e => setEmail(e.target.value)}
                                            aria-invalid={error ? true : undefined}
                                            className="min-w-0 flex-1 rounded-xl border border-defined bg-surface px-3.5 py-2.5 text-[14px] text-heading transition-all placeholder:text-muted focus:border-primary/30 focus:outline-none focus:ring-2 focus:ring-primary/20"
                                        />
                                        <button
                                            type="submit"
                                            disabled={isSubmitting || !email.trim()}
                                            className="flex-shrink-0 rounded-xl bg-primary px-5 py-2.5 text-[14px] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            {isSubmitting ? 'Sending' : 'Send me my link'}
                                        </button>
                                    </div>
                                    {error && (
                                        <p role="alert" className="mt-2 text-[13px] text-danger">
                                            {error}
                                        </p>
                                    )}
                                    <p className="mt-3 text-[12px] leading-relaxed text-muted">
                                        {MARKETING_NOTICE}
                                    </p>
                                </form>
                            )}
                        </div>

                        {/* DMCCA 2024: stays visible, never behind the terms link. */}
                        <p className="mt-5 text-[12px] leading-relaxed text-muted">
                            {DISCLOSURE}{' '}
                            <Link
                                href="/terms"
                                className="underline decoration-heading/30 underline-offset-4 transition hover:text-heading"
                            >
                                Read the full terms.
                            </Link>
                        </p>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
