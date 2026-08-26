"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { useInView, useMotionValue, useSpring } from "motion/react";
import { cn } from "@/lib/utils";

/**
 * The ticker writes its text through `ref.current.textContent`, so the span it
 * renders is empty until the spring first fires. That is invisible in a
 * client-side demo and wrong everywhere else: server-rendered HTML, a crawler,
 * or a browser that never runs the effect all show a blank where a number
 * should be. We therefore render the final value as real children (the correct
 * static answer) and reset it to the start value in a layout effect, before
 * paint, so the animation still runs from zero when JS is alive.
 *
 * `useLayoutEffect` warns if it runs during SSR, and this reset only ever has
 * to happen in the browser.
 */
const useIsomorphicLayoutEffect =
    typeof window !== "undefined" ? useLayoutEffect : useEffect;

export function NumberTicker({
    value,
    direction = "up",
    delay = 0,
    className,
    decimalPlaces = 0,
    suffix = "",
}: {
    value: number;
    direction?: "up" | "down";
    className?: string;
    delay?: number;
    decimalPlaces?: number;
    suffix?: string;
}) {
    const ref = useRef<HTMLSpanElement>(null);
    const motionValue = useMotionValue(direction === "down" ? value : 0);
    const springValue = useSpring(motionValue, {
        damping: 60,
        stiffness: 100,
    });
    const isInView = useInView(ref, { once: true, margin: "0px" });

    const format = (n: number) =>
        Intl.NumberFormat("en-US", {
            minimumFractionDigits: decimalPlaces,
            maximumFractionDigits: decimalPlaces,
        }).format(Number(n.toFixed(decimalPlaces))) + suffix;

    const startValue = direction === "down" ? value : 0;

    useIsomorphicLayoutEffect(() => {
        if (ref.current) {
            ref.current.textContent = format(startValue);
        }
        // Only on mount: after that the spring owns the text.
    }, []);

    useEffect(() => {
        if (isInView) {
            setTimeout(() => {
                motionValue.set(direction === "down" ? 0 : value);
            }, delay * 1000);
        }
    }, [motionValue, isInView, delay, value, direction]);

    useEffect(
        () =>
            springValue.on("change", (latest) => {
                if (ref.current) {
                    ref.current.textContent =
                        Intl.NumberFormat("en-US", {
                            minimumFractionDigits: decimalPlaces,
                            maximumFractionDigits: decimalPlaces,
                        }).format(Number(latest.toFixed(decimalPlaces))) + suffix;
                }
            }),
        [springValue, decimalPlaces, suffix],
    );

    return (
        <span
            className={cn(
                "inline-block tabular-nums tracking-wider text-black dark:text-white",
                className,
            )}
            ref={ref}
        >
            {format(value)}
        </span>
    );
}
