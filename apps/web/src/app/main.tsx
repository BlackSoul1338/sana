import './styles/index.css';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { supabase } from '@/shared/api';
import { ThemeProvider } from '@/shared/lib/theme';
import { Toaster } from '@/shared/ui/sonner';
import { TooltipProvider } from '@/shared/ui/tooltip';
import { queryClient } from './query/query-client';
import { router } from './router';

// A different user (sign-in, sign-out, another tab) drops cached data and re-runs route guards.
let currentUserId: string | null | undefined;
supabase.auth.onAuthStateChange((_event, session) => {
  const userId = session?.user.id ?? null;
  if (currentUserId !== undefined && userId !== currentUserId) {
    queryClient.clear();
    void router.invalidate();
  }
  currentUserId = userId;
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider delayDuration={300}>
          <RouterProvider router={router} />
          <Toaster position="bottom-center" />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
);
