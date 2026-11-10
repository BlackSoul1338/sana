import { cn } from '@/shared/lib/utils';

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-baseline text-xl font-semibold tracking-tight', className)}>
      sana
      <span aria-hidden className="bg-primary ml-0.5 inline-block size-2 rounded-full" />
    </span>
  );
}
