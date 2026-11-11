import type { ReactNode } from 'react';
import { Logo } from '@/shared/ui/logo';

export function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col px-4 py-8">
      <Logo />
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">
        <h1 className="text-2xl font-semibold sm:text-3xl">{title}</h1>
        {subtitle && <p className="text-muted-foreground mt-2">{subtitle}</p>}
        <div className="mt-8">{children}</div>
        {footer && <div className="text-muted-foreground mt-6 text-sm">{footer}</div>}
      </div>
    </main>
  );
}
