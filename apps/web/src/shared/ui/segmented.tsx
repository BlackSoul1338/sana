import { cn } from '@/shared/lib/utils';

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: readonly { value: T; label: string; disabled?: boolean }[];
  label: string;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn('bg-muted inline-flex rounded-md p-0.5', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          disabled={o.disabled}
          onClick={() => onChange(o.value)}
          className={cn(
            'rounded-[calc(var(--radius)-6px)] px-3 py-1.5 text-sm transition-colors disabled:opacity-40',
            value === o.value ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
