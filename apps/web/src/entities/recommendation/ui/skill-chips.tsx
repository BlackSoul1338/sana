import { Check } from 'lucide-react';

type S = { slug: string; title: string; required: boolean };

export function SkillChips({ matched, gaps, max = 6 }: { matched: S[]; gaps: S[]; max?: number }) {
  const items = [...matched.map((s) => ({ ...s, ok: true })), ...gaps.map((s) => ({ ...s, ok: false }))].slice(0, max);
  return (
    <ul className="flex flex-wrap gap-1.5">
      {items.map((s) =>
        s.ok ? (
          <li key={s.slug} className="bg-success-soft text-success inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs">
            <Check className="size-3" />
            {s.title}
          </li>
        ) : (
          <li key={s.slug} className="text-muted-foreground rounded-full border border-dashed px-2 py-0.5 text-xs" title={s.required ? 'Обязательный навык' : 'Желательный навык'}>
            {s.title}
            {s.required && ' *'}
          </li>
        ),
      )}
    </ul>
  );
}
