import { DIFFICULTY } from '@/shared/config';

export function TaskMeta({ topic, difficulty, estHours, orgName }: { topic: string; difficulty: number; estHours: number; orgName?: string }) {
  return (
    <p className="text-muted-foreground text-sm">
      {[orgName, topic, DIFFICULTY[difficulty as 1 | 2 | 3]?.toLowerCase(), `~${estHours} ч`].filter(Boolean).join(' · ')}
    </p>
  );
}
