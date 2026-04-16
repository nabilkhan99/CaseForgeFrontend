'use client';

import { motion } from 'framer-motion';
import { ReactNode } from 'react';

interface PrimaryButtonProps {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  fullWidth?: boolean;
  size?: 'sm' | 'md' | 'lg';
  type?: 'button' | 'submit';
  className?: string;
}

const sizeMap = {
  sm: 'px-5 py-2 text-[13px] min-h-[40px]',
  md: 'px-6 py-3 text-[14px] min-h-[44px]',
  lg: 'px-8 py-4 text-[15px] min-h-[52px]',
};

export default function PrimaryButton({
  children,
  onClick,
  disabled = false,
  fullWidth = false,
  size = 'md',
  type = 'button',
  className = '',
}: PrimaryButtonProps) {
  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`
        inline-flex items-center justify-center gap-2 font-semibold text-white rounded-xl cursor-pointer
        transition-opacity
        ${sizeMap[size]}
        ${fullWidth ? 'w-full' : ''}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        ${className}
      `}
      style={{
        background: disabled ? '#A8A29E' : 'linear-gradient(135deg, #B45309, #D97706)',
        boxShadow: disabled ? 'none' : '0 4px 12px rgba(180,83,9,0.2)',
      }}
      whileHover={disabled ? {} : { y: -2, boxShadow: '0 6px 20px rgba(180,83,9,0.3)' }}
      whileTap={disabled ? {} : { scale: 0.98 }}
    >
      {children}
    </motion.button>
  );
}
