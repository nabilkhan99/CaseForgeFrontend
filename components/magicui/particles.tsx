"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface Particle {
    x: number;
    y: number;
    size: number;
    speedX: number;
    speedY: number;
    opacity: number;
}

interface ParticlesProps {
    className?: string;
    quantity?: number;
    staticity?: number;
    ease?: number;
    size?: number;
    refresh?: boolean;
    color?: string;
    vx?: number;
    vy?: number;
}

export function Particles({
    className,
    quantity = 50,
    size = 0.4,
    color = "#ffffff",
    vx = 0,
    vy = 0,
}: ParticlesProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const canvasContainerRef = useRef<HTMLDivElement>(null);
    const context = useRef<CanvasRenderingContext2D | null>(null);
    const particles = useRef<Particle[]>([]);
    const canvasSize = useRef<{ w: number; h: number }>({ w: 0, h: 0 });
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio : 1;

    useEffect(() => {
        if (canvasRef.current) {
            context.current = canvasRef.current.getContext("2d");
        }
        initCanvas();
        animate();
        window.addEventListener("resize", initCanvas);
        return () => {
            window.removeEventListener("resize", initCanvas);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [color]);

    const initCanvas = () => {
        resizeCanvas();
        drawParticles();
    };

    const resizeCanvas = () => {
        if (canvasContainerRef.current && canvasRef.current && context.current) {
            canvasSize.current.w = canvasContainerRef.current.offsetWidth;
            canvasSize.current.h = canvasContainerRef.current.offsetHeight;
            canvasRef.current.width = canvasSize.current.w * dpr;
            canvasRef.current.height = canvasSize.current.h * dpr;
            canvasRef.current.style.width = `${canvasSize.current.w}px`;
            canvasRef.current.style.height = `${canvasSize.current.h}px`;
            context.current.scale(dpr, dpr);
        }
    };

    const hexToRgb = (hex: string): number[] => {
        hex = hex.replace("#", "");
        if (hex.length === 3) {
            hex = hex.split("").map((char) => char + char).join("");
        }
        const hexInt = parseInt(hex, 16);
        const red = (hexInt >> 16) & 255;
        const green = (hexInt >> 8) & 255;
        const blue = hexInt & 255;
        return [red, green, blue];
    };

    const drawParticles = () => {
        particles.current = [];
        for (let i = 0; i < quantity; i++) {
            const p: Particle = {
                x: Math.random() * canvasSize.current.w,
                y: Math.random() * canvasSize.current.h,
                size: Math.random() * 2 + size,
                speedX: (Math.random() - 0.5) * 0.2 + vx,
                speedY: (Math.random() - 0.5) * 0.2 + vy,
                opacity: Math.random() * 0.5 + 0.1,
            };
            particles.current.push(p);
        }
    };

    const clearContext = () => {
        if (context.current) {
            context.current.clearRect(
                0,
                0,
                canvasSize.current.w,
                canvasSize.current.h,
            );
        }
    };

    const drawCircle = (particle: Particle) => {
        if (context.current) {
            const { x, y, size: pSize, opacity } = particle;
            const [r, g, b] = hexToRgb(color);
            context.current.beginPath();
            context.current.arc(x, y, pSize, 0, 2 * Math.PI);
            context.current.fillStyle = `rgba(${r}, ${g}, ${b}, ${opacity})`;
            context.current.fill();
        }
    };

    const animate = () => {
        clearContext();
        particles.current.forEach((particle) => {
            particle.x += particle.speedX;
            particle.y += particle.speedY;

            if (particle.x > canvasSize.current.w) particle.x = 0;
            if (particle.x < 0) particle.x = canvasSize.current.w;
            if (particle.y > canvasSize.current.h) particle.y = 0;
            if (particle.y < 0) particle.y = canvasSize.current.h;

            drawCircle(particle);
        });
        requestAnimationFrame(animate);
    };

    return (
        <div
            className={cn("absolute inset-0 overflow-hidden", className)}
            ref={canvasContainerRef}
            aria-hidden="true"
        >
            <canvas ref={canvasRef} className="absolute inset-0" />
        </div>
    );
}
