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
      className={`rounded-[16px] bg-surface-raised border border-hairline overflow-hidden shadow-elevation-2 ${paddingMap[padding]} ${className}`}
    >
      {children}
    </div>
  );
}
