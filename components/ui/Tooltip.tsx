'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
    cloneElement,
    isValidElement,
    useEffect,
    useId,
    useRef,
    useState,
    type ReactElement,
    type ReactNode,
} from 'react';

interface TooltipProps {
    /** What the tip says. Plain text — this is a label, not a popover. */
    content: ReactNode;
    /**
     * The trigger. A single element gets `aria-describedby` wired to the tip;
     * anything else is wrapped and the description lands on the wrapper.
     */
    children: ReactNode;
    /** Extra classes for the wrapper, e.g. to control how it sits in a flex row. */
    className?: string;
}

/**
 * A label that appears over its trigger on hover or focus.
 *
 * Built rather than borrowed because the station board draws two hundred
 * fourteen-pixel squares and the only thing that tells you which case a square
 * is, is this. The native `title` attribute already does that job — badly:
 * roughly a second of delay before it appears, no keyboard equivalent at all,
 * and OS chrome that ignores the type scale. On a grid where you sweep the
 * pointer across a row reading titles, a one-second delay per square makes the
 * board useless.
 *
 * Focus opens it as well as hover, so someone arrowing through the board hears
 * and sees the same thing a mouse user does. The tip carries `role="tooltip"`
 * and is pointed at by the trigger's `aria-describedby` only while it is open —
 * a description referencing a node that isn't there is worse than none.
 *
 * Mounted only while open: an always-present tip per trigger would be two
 * hundred extra nodes on the library page for one of them to ever be read.
 *
 * Known limit: on touch, a tap fires mouseenter and the tip stays until you tap
 * elsewhere. Callers that matter on phones should not depend on it — the board
 * hides itself below `sm` for exactly this reason.
 */
export default function Tooltip({ content, children, className }: TooltipProps) {
    const [open, setOpen] = useState(false);
    // Horizontal nudge that keeps the tip inside the viewport. The board's
    // right-hand column ends flush with the 900px measure, so a centred tip on
    // its last square would otherwise hang off the page and add a scrollbar.
    const [offset, setOffset] = useState(0);
    const wrapperRef = useRef<HTMLSpanElement>(null);
    const tipRef = useRef<HTMLSpanElement>(null);
    const tipId = useId();
    const shouldReduceMotion = useReducedMotion();

    useEffect(() => {
        if (!open) return;
        const wrapper = wrapperRef.current;
        const tip = tipRef.current;
        if (!wrapper || !tip) return;

        // Measured off offsetWidth, not the rendered box, so the result does
        // not depend on the offset already applied — recomputing is idempotent.
        const anchor = wrapper.getBoundingClientRect();
        const centre = anchor.left + anchor.width / 2;
        const half = tip.offsetWidth / 2;
        const margin = 8;
        const viewport = document.documentElement.clientWidth;

        const overshootLeft = margin - (centre - half);
        const overshootRight = centre + half - (viewport - margin);
        setOffset(overshootLeft > 0 ? overshootLeft : overshootRight > 0 ? -overshootRight : 0);
    }, [open]);

    const describedBy = open ? tipId : undefined;
    const trigger = isValidElement(children)
        ? cloneElement(children as ReactElement<{ 'aria-describedby'?: string }>, {
              'aria-describedby': describedBy,
          })
        : children;

    return (
        <span
            ref={wrapperRef}
            className={`relative inline-flex${className ? ` ${className}` : ''}`}
            onMouseEnter={() => setOpen(true)}
            onMouseLeave={() => setOpen(false)}
            // React's onFocus/onBlur are focusin/focusout, so these catch the
            // real focusable element inside without needing a ref to it.
            onFocus={() => setOpen(true)}
            onBlur={() => setOpen(false)}
            aria-describedby={isValidElement(children) ? undefined : describedBy}
        >
            {trigger}

            <AnimatePresence>
                {open && (
                    <motion.span
                        ref={tipRef}
                        id={tipId}
                        role="tooltip"
                        // x lives in the motion values rather than a
                        // `-translate-x-1/2` class: framer writes `transform`
                        // inline, which would drop the class outright.
                        initial={shouldReduceMotion ? false : { opacity: 0, x: '-50%', y: 2 }}
                        animate={{ opacity: 1, x: '-50%', y: 0 }}
                        exit={{ opacity: 0, x: '-50%' }}
                        transition={{ duration: shouldReduceMotion ? 0 : 0.12, ease: 'easeOut' }}
                        style={{ marginLeft: offset }}
                        className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-1.5 w-max max-w-[220px] rounded-[6px] bg-heading px-2 py-1 text-center text-[11px] font-medium leading-snug text-surface shadow-elevation-4"
                    >
                        {content}
                    </motion.span>
                )}
            </AnimatePresence>
        </span>
    );
}
