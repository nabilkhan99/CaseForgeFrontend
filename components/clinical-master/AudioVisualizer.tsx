'use client';

import { motion } from 'framer-motion';

interface AudioVisualizerProps {
  active: boolean;
  barCount?: number;
}

export default function AudioVisualizer({ active, barCount = 48 }: AudioVisualizerProps) {
  return (
    <div className="flex items-center justify-center gap-[3px] h-20 w-full max-w-[400px] mx-auto">
      {Array.from({ length: barCount }).map((_, i) => {
        const center = barCount / 2;
        const dist = Math.abs(i - center) / center;
        const maxH = active ? 100 - dist * 55 : 15;
        return (
          <motion.div
            key={i}
            className="rounded-full"
            style={{
              width: '3px',
              background: active
                ? `linear-gradient(180deg, rgba(180,83,9,${0.8 - dist * 0.4}) 0%, rgba(245,158,11,${0.2 + (1 - dist) * 0.3}) 100%)`
                : 'rgba(0,0,0,0.08)',
            }}
            animate={{
              height: active
                ? [
                    `${10 + Math.sin(i * 0.5) * 6}%`,
                    `${maxH * (0.3 + Math.sin(i * 0.35 + 1) * 0.7)}%`,
                    `${10 + Math.sin(i * 0.5 + 2) * 6}%`,
                  ]
                : ['15%'],
            }}
            transition={
              active
                ? { duration: 0.8 + (i % 6) * 0.1, repeat: Infinity, delay: (i % 8) * 0.05, ease: 'easeInOut' }
                : { duration: 0.3 }
            }
          />
        );
      })}
    </div>
  );
}
