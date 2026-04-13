interface DomainTagProps {
  name: string;
  size?: 'sm' | 'md';
}

export default function DomainTag({ name, size = 'md' }: DomainTagProps) {
  const sizeClass = size === 'sm' ? 'px-2 py-1 text-[10px]' : 'px-3 py-1.5 text-[11px]';

  return (
    <span
      className={`inline-flex items-center font-semibold rounded-lg ${sizeClass}`}
      style={{ background: 'rgba(180,83,9,0.06)', color: '#92400E' }}
    >
      {name}
    </span>
  );
}
