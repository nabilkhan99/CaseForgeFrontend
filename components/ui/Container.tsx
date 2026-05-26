import { ReactNode } from 'react';

interface ContainerProps {
  children: ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const paddingMap = {
  none: '',
  sm: 'p-4',
  md: 'p-5 sm:p-6',
  lg: 'p-6 sm:p-8',
};

export default function Container({ children, className = '', padding = 'md' }: ContainerProps) {
  return (
    <div
      className={`rounded-[20px] bg-surface-raised border border-black/[0.06] ${paddingMap[padding]} ${className}`}
      style={{
        boxShadow: '0 24px 64px rgba(180,83,9,0.06), 0 2px 4px rgba(0,0,0,0.04)',
      }}
    >
      {children}
    </div>
  );
}
