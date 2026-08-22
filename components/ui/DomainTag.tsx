import { getDomainColor } from '@/lib/constants/domains';

interface DomainTagProps {
  name: string;
  size?: 'sm' | 'md';
}

export default function DomainTag({ name, size = 'md' }: DomainTagProps) {
  const sizeClass = size === 'sm' ? 'px-2 py-1 text-[10px]' : 'px-3 py-1.5 text-[11px]';
  // Tint is a stable hash of the domain name (see lib/constants/domains.ts), so
  // the same domain reads the same in the library, on the dashboard and in
  // history — and every tint stays inside the amber/stone system.
  const { bg, text } = getDomainColor(name);

  return (
    <span
      className={`inline-flex items-center font-semibold rounded-lg ${sizeClass}`}
      style={{ background: bg, color: text }}
    >
      {name}
    </span>
  );
}
