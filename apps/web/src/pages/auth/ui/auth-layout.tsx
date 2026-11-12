import type { ReactNode } from 'react';
import { Logo } from '@/shared/ui/logo';

const PITCH = [
  { title: 'Баллы только за подтверждённое', text: 'Куратор, преподаватель или компания принимают результат — и у каждого балла есть объяснение.' },
  { title: 'ИИ подсказывает, решает человек', text: 'Модель находит пробелы и проверяет по критериям, но оценку подтверждает проверяющий.' },
  { title: 'Два контура в одном профиле', text: 'Стартап по задаче бизнеса — и учебная практика: тесты, задания, командные исследования.' },
];

/** `pitch`: on wide screens, a short explanation of the platform next to the form (sign-in, sign-up). */
export function AuthLayout({ title, subtitle, children, footer, pitch = false }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode; pitch?: boolean }) {
  return (
    <main className="flex min-h-dvh flex-col px-4 py-8">
      <Logo />
      <div className="mx-auto flex w-full max-w-5xl flex-1 items-center justify-center gap-16 py-12">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-semibold sm:text-3xl">{title}</h1>
          {subtitle && <p className="text-muted-foreground mt-2">{subtitle}</p>}
          <div className="mt-8">{children}</div>
          {footer && <div className="text-muted-foreground mt-6 text-sm">{footer}</div>}
        </div>
        {pitch && (
          <aside className="bg-card hidden max-w-md flex-1 rounded-2xl border p-8 lg:block">
            <p className="text-primary text-sm font-medium">Платформа практических заданий AI Sana</p>
            <p className="mt-2 text-xl font-semibold">Практика, в которой видно, кто что сделал</p>
            <ul className="mt-6 grid gap-5">
              {PITCH.map((p) => (
                <li key={p.title} className="grid gap-1">
                  <span className="font-medium">{p.title}</span>
                  <span className="text-muted-foreground text-sm">{p.text}</span>
                </li>
              ))}
            </ul>
          </aside>
        )}
      </div>
    </main>
  );
}
