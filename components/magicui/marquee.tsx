"use client";

import { cn } from "@/lib/utils";
import { Children, type ReactNode } from "react";

interface MarqueeProps {
    className?: string;
    reverse?: boolean;
    pauseOnHover?: boolean;
    children?: ReactNode;
    vertical?: boolean;
    repeat?: number;
    duration?: string;
    gap?: string;
}

export function Marquee({
    className,
    reverse = false,
    pauseOnHover = false,
    children,
    vertical = false,
    repeat = 4,
    duration = "40s",
    gap = "1rem",
}: MarqueeProps) {
    return (
        <div
            className={cn(
                "group flex overflow-hidden p-2",
                {
                    "flex-row": !vertical,
                    "flex-col": vertical,
                },
                className,
            )}
            style={
                {
                    "--gap": gap,
                    "--duration": duration,
                    gap,
                } as React.CSSProperties
            }
        >
            {Array(repeat)
                .fill(0)
                .map((_, i) => (
                    <div
                        key={i}
                        className={cn(
                            "flex shrink-0 justify-around",
                            vertical ? "animate-marquee-vertical flex-col" : "animate-marquee flex-row",
                            {
                                "[animation-direction:reverse]": reverse,
                                "group-hover:[animation-play-state:paused]": pauseOnHover,
                            },
                        )}
                        style={{ gap }}
                    >
                        {Children.map(children, (child) => child)}
                    </div>
                ))}
        </div>
    );
}
