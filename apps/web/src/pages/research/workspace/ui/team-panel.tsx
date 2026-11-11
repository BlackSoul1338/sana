import { useMutation, useQueryClient } from '@tanstack/react-query';
import { researchKeys, type ResearchWorkspace } from '@/entities/research';
import { api, problemMessage, unwrap, type Schemas } from '@/shared/api';
import { RESEARCH_ROLE } from '@/shared/config';
import { FormError } from '@/shared/ui/field';

type Role = keyof typeof RESEARCH_ROLE;

/** Roles and contribution by actions on the board; messages are deliberately not counted. */
export function TeamPanel({ ws, editable }: { ws: ResearchWorkspace; editable: boolean }) {
  const queryClient = useQueryClient();
  const save = useMutation({
    mutationFn: async (roles: Schemas['ResearchRolesInput']['roles']) => unwrap(await api.PUT('/api/research/workspaces/{id}/roles', { params: { path: { id: ws.id } }, body: { roles } })),
    onSuccess: (data) => queryClient.setQueryData(['research', 'workspace', ws.id], data),
    onSettled: () => queryClient.invalidateQueries({ queryKey: researchKeys.all }),
  });
  const change = (profileId: string, role: Role | '') =>
    save.mutate(
      ws.contribution
        .map((c) => ({ profileId: c.profileId, role: c.profileId === profileId ? role : (c.role ?? '') }))
        .filter((r): r is { profileId: string; role: Role } => r.role !== ''),
    );

  return (
    <div className="grid gap-2">
      <table className="w-full text-sm">
        <thead className="text-muted-foreground text-left text-xs">
          <tr>
            <th className="py-1 font-normal">Участник</th>
            <th className="py-1 font-normal">Роль</th>
            <th className="py-1 text-right font-normal" title="Источники, аргументы, вопросы">Добавил</th>
            <th className="py-1 text-right font-normal">В выводе</th>
          </tr>
        </thead>
        <tbody className="divide-y tabular-nums">
          {ws.contribution.map((c) => (
            <tr key={c.profileId}>
              <td className="py-2">{c.name}</td>
              <td className="py-2">
                {editable ? (
                  <select className="bg-background rounded-md border px-1.5 py-1" value={c.role ?? ''} onChange={(e) => change(c.profileId, e.target.value as Role | '')} aria-label={`Роль: ${c.name}`}>
                    <option value="">без роли</option>
                    {(Object.keys(RESEARCH_ROLE) as Role[]).map((r) => (
                      <option key={r} value={r}>
                        {RESEARCH_ROLE[r]}
                      </option>
                    ))}
                  </select>
                ) : c.role ? (
                  RESEARCH_ROLE[c.role]
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </td>
              <td className="py-2 text-right">{c.sourcesAdded + c.argumentsAdded + c.questionsAdded}</td>
              <td className="py-2 text-right">{c.citedInConclusion}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-muted-foreground text-xs">Вклад считается по доске: источники, аргументы, вопросы и то, что вошло в вывод. Сообщения в обсуждении не считаются.</p>
      <FormError message={save.isError ? problemMessage(save.error) : undefined} />
    </div>
  );
}
