import { createFileRoute } from '@tanstack/react-router';
import { LeaderboardPage } from '@/pages/leaderboard';

export const Route = createFileRoute('/_app/leaderboard')({
  component: LeaderboardPage,
});
