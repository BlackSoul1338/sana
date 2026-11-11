import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { practiceKeys } from '@/entities/practice';
import { api, problemMessage, unwrap, type Schemas } from '@/shared/api';
import { Button } from '@/shared/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/shared/ui/dialog';
import { Field, FormError } from '@/shared/ui/field';
import { Input } from '@/shared/ui/input';
import { Segmented } from '@/shared/ui/segmented';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { Textarea } from '@/shared/ui/textarea';

type Criterion = { title: string; description: string; topic: string; maxPoints: number };

export function NewAssignmentDialog({ module, children }: { module: Schemas['PracticeModule']; children: ReactNode }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [condition, setCondition] = useState('');
  const [materials, setMaterials] = useState('');
  const [difficulty, setDifficulty] = useState<'1' | '2' | '3'>('1');
  const blank = (): Criterion => ({ title: '', description: '', topic: module.topics[0] ?? '', maxPoints: 10 });
  const [criteria, setCriteria] = useState<Criterion[]>([blank()]);
  const patch = (i: number, v: Partial<Criterion>) => setCriteria((cs) => cs.map((c, k) => (k === i ? { ...c, ...v } : c)));

  const create = useMutation({
    mutationFn: async () =>
      unwrap(await api.POST('/api/practice/assignments', { body: { moduleId: module.id, title, condition, materials, difficulty: Number(difficulty), criteria } })),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: practiceKeys.all });
      setOpen(false);
      setTitle('');
      setCondition('');
      setMaterials('');
      setCriteria([blank()]);
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Новое задание</DialogTitle>
          <DialogDescription>Модель проверяет работу только по этим критериям. Темы критериев берутся из модуля «{module.title}».</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Field label="Название" htmlFor="a-title">
            <Input id="a-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="Условие" htmlFor="a-cond" hint="Что студент должен сделать и в каком виде сдать">
            <Textarea id="a-cond" rows={4} value={condition} onChange={(e) => setCondition(e.target.value)} />
          </Field>
          <Field label="Материалы" htmlFor="a-mat" hint="Необязательно">
            <Textarea id="a-mat" rows={2} value={materials} onChange={(e) => setMaterials(e.target.value)} />
          </Field>
          <div className="grid gap-1.5">
            <span className="text-sm font-medium">Уровень</span>
            <Segmented label="Уровень" value={difficulty} onChange={setDifficulty} options={[{ value: '1', label: 'Базовый' }, { value: '2', label: 'Средний' }, { value: '3', label: 'Сложный' }]} />
          </div>
          <fieldset className="grid gap-3">
            <legend className="mb-1 text-sm font-medium">Критерии</legend>
            {criteria.map((c, i) => (
              <div key={i} className="grid gap-2 rounded-lg border p-3">
                <div className="flex gap-2">
                  <Input aria-label="Критерий" placeholder="Например, обработаны пропуски" value={c.title} onChange={(e) => patch(i, { title: e.target.value })} />
                  {criteria.length > 1 && (
                    <Button variant="ghost" size="icon" aria-label="Убрать критерий" onClick={() => setCriteria((cs) => cs.filter((_, k) => k !== i))}>
                      <X />
                    </Button>
                  )}
                </div>
                <Textarea aria-label="Что значит «выполнено»" placeholder="Что значит «выполнено»" rows={2} value={c.description} onChange={(e) => patch(i, { description: e.target.value })} />
                <div className="flex flex-wrap gap-2">
                  <Select value={c.topic} onValueChange={(v) => patch(i, { topic: v })}>
                    <SelectTrigger className="w-full sm:w-56" aria-label="Тема">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {module.topics.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input aria-label="Баллы" type="number" min={1} max={50} className="w-24" value={c.maxPoints} onChange={(e) => patch(i, { maxPoints: Number(e.target.value) })} />
                </div>
              </div>
            ))}
            {criteria.length < 8 && (
              <Button variant="ghost" size="sm" className="w-fit" onClick={() => setCriteria((cs) => [...cs, blank()])}>
                <Plus />
                Критерий
              </Button>
            )}
          </fieldset>
          <FormError message={create.isError ? problemMessage(create.error) : undefined} />
        </div>
        <DialogFooter>
          <Button disabled={create.isPending} onClick={() => create.mutate()}>
            {create.isPending ? 'Создаём…' : 'Создать задание'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
