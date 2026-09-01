'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import ReferralModal from './ReferralModal';

/**
 * One modal, many triggers.
 *
 * The referral strip appears twice on the portfolio tool page (above the H1 and
 * again at the top of a generated review) and the spec requires both to open the
 * SAME modal. Giving each strip its own modal instance would put two copies of
 * the email input in the DOM, which duplicates the input id and gives the
 * browser two things to autofill. So the modal lives once, here, and the strips
 * are just buttons that call `open()`.
 *
 * Closing sets `isOpen` false without unmounting the provider, so reopening is
 * always available — the modal is never dismissed "for good".
 */

interface ReferralModalContextValue {
    open: () => void;
}

const ReferralModalContext = createContext<ReferralModalContextValue | null>(null);

/**
 * Trigger for the shared referral modal. Returns a no-op opener outside a
 * provider rather than throwing, so a strip rendered in isolation (a test, a
 * future page) degrades to inert text instead of crashing the page it sits on.
 */
export function useReferralModal(): ReferralModalContextValue {
    return useContext(ReferralModalContext) ?? { open: () => {} };
}

export default function ReferralModalProvider({ children }: { children: ReactNode }) {
    const [isOpen, setIsOpen] = useState(false);

    const open = useCallback(() => setIsOpen(true), []);
    const close = useCallback(() => setIsOpen(false), []);
    const value = useMemo(() => ({ open }), [open]);

    return (
        <ReferralModalContext.Provider value={value}>
            {children}
            <ReferralModal isOpen={isOpen} onClose={close} />
        </ReferralModalContext.Provider>
    );
}
