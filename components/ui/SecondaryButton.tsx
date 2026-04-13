'use client';

import { motion } from 'framer-motion';
import { ReactNode } from 'react';

interface SecondaryButtonProps {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  fullWidth?: boolean;
  size?: 'sm' | 'md' | 'lg';
  type?: 'button' | 'submit';
  className?: string;
  variant?: 'outline' | 'ghost' | 'danger';
}

const sizeMap = {
  sm: 'px-4 py-2 text-[13px]',
  md: 'px-5 py-2.5 text-[14px]',
  lg: 'px-6 py-3 text-[15px]',
};

const variantMap = {
  outline: 'border border-black/[0.08] text-body hover:border-black/[0.15] hover:bg-black/[0.02]',
  ghost: 'text-body hover:bg-black/[0.03]',
  danger: 'border border-red-200 text-danger bg-red-50 hover:bg-red-100',
};

export default function SecondaryButton({
  children,
  onClick,
  disabled = false,
  fullWidth = false,
  size = 'md',
  type = 'button',
  variant = 'outline',
  className = '',
}: SecondaryButtonProps) {
  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`
        inline-flex items-center justify-center gap-2 font-medium rounded-xl cursor-pointer
        transition-all duration-150
        ${sizeMap[size]}
        ${variantMap[variant]}
        ${fullWidth ? 'w-full' : ''}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        ${className}
      `}
      whileTap={disabled ? {} : { scale: 0.98 }}
    >
      {children}
    </motion.button>
  );
}
