"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface AnimatedGradientTextProps {
    children: ReactNode;
    className?: string;
}

export function AnimatedGradientText({
    children,
    className,
}: AnimatedGradientTextProps) {
    return (
        <div
            className={cn(
                "group relative mx-auto flex max-w-fit flex-row items-center justify-center rounded-2xl bg-white/5 px-4 py-1.5 text-sm font-medium backdrop-blur-sm transition-shadow duration-500 ease-out [--bg-size:300%] hover:shadow-[inset_0_-5px_10px_#ffffff1a]",
                "bg-gradient-to-r from-[#22c55e33] via-[#3b82f633] to-[#22c55e33] bg-[length:var(--bg-size)_100%] animate-gradient-bg",
                className,
            )}
        >
            <div
                className={cn(
                    "inline animate-gradient-text bg-gradient-to-r from-[#22c55e] via-[#60a5fa] to-[#22c55e] bg-[length:var(--bg-size)_100%] bg-clip-text text-transparent",
                )}
            >
                {children}
            </div>
        </div>
    );
}
