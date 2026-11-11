export function NavCount({ value }: { value: number }) {
  if (value === 0) return null;
  return (
    <span className="bg-muted text-foreground ml-1.5 rounded-full px-1.5 text-xs font-medium tabular-nums" aria-label={`ждут: ${value}`}>
      {value}
    </span>
  );
}
