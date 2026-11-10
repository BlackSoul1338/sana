import { api, EVIDENCE_BUCKET, supabase, unwrap } from '@/shared/api';
import type { EvidenceFormValues } from '../model/schema';

async function uploadFile(file: File): Promise<string> {
  const target = unwrap(
    await api.POST('/api/evidence/upload-url', {
      body: { fileName: file.name, contentType: file.type as 'image/png' },
    }),
  );
  const { error } = await supabase.storage.from(EVIDENCE_BUCKET).uploadToSignedUrl(target.storagePath, target.token, file, {
    contentType: file.type,
  });
  if (error) throw new Error(`Не удалось загрузить файл: ${error.message}`);
  return target.storagePath;
}

export async function submitEvidence(projectId: string, v: EvidenceFormValues) {
  const storagePath = v.file ? await uploadFile(v.file) : undefined;
  return unwrap(
    await api.POST('/api/sprint/projects/{id}/evidence', {
      params: { path: { id: projectId } },
      body: {
        target: v.target,
        stageKey: v.target === 'stage' ? (v.stageKey as 'idea') : undefined,
        taskId: v.target === 'task' ? v.taskId : undefined,
        kind: v.target === 'interview' ? 'interview' : v.kind,
        url: v.url || undefined,
        storagePath,
        note: v.note,
      },
    }),
  );
}
