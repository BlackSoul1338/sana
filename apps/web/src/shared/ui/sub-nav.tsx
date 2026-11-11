import { Link } from '@tanstack/react-router';

/** Links between sibling pages of one section, styled like the segmented control. */
export function SubNav({ items, label }: { items: readonly { to: string; label: string }[]; label: string }) {
  return (
    <nav aria-label={label} className="bg-muted inline-flex w-fit rounded-md p-0.5">
      {items.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          className="text-muted-foreground hover:text-foreground rounded-[calc(var(--radius)-6px)] px-3 py-1.5 text-sm transition-colors"
          activeProps={{ className: '!bg-background !text-foreground shadow-xs' }}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
