import { createFileRoute } from '@tanstack/react-router';
import { useMe } from '@/entities/viewer';
import { PracticePage } from '@/pages/practice/home';
import { PracticeTeacherPage } from '@/pages/practice/teacher';

export const Route = createFileRoute('/_app/practice/')({
  component: function Page() {
    return useMe().profile!.role === 'teacher' ? <PracticeTeacherPage /> : <PracticePage />;
  },
});
