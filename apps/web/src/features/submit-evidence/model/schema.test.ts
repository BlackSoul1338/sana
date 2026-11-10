import { describe, expect, it } from 'vitest';
import { EvidenceFormSchema } from './schema';

const issues = (v: unknown) => {
  const r = EvidenceFormSchema.safeParse(v);
  return r.success ? [] : r.error.issues.map((i) => i.path.join('.'));
};

describe('evidence form rules mirror the API', () => {
  it('needs something to check: link, file or a 20+ char note', () => {
    expect(issues({ target: 'interview', kind: 'interview', note: 'коротко' })).toEqual(['note']);
    expect(issues({ target: 'interview', kind: 'interview', note: 'Поговорили с бариста о часах пик' })).toEqual([]);
    expect(issues({ target: 'interview', kind: 'interview', url: 'https://docs.example.com/x' })).toEqual([]);
  });

  it('closing a stage needs the stage, closing a task needs the task', () => {
    expect(issues({ target: 'stage', kind: 'report', url: 'https://a.b' })).toContain('target');
    expect(issues({ target: 'task', kind: 'link', url: 'https://a.b' })).toContain('taskId');
    expect(issues({ target: 'stage', stageKey: 'idea', kind: 'report', url: 'https://a.b' })).toEqual([]);
  });

  it('rejects unsupported and oversized files', () => {
    const txt = new File(['x'], 'a.txt', { type: 'text/plain' });
    expect(issues({ target: 'interview', kind: 'interview', file: txt })).toContain('file');
    const big = new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'a.png', { type: 'image/png' });
    expect(issues({ target: 'interview', kind: 'interview', file: big })).toContain('file');
  });

  it('rejects a malformed link', () => {
    expect(issues({ target: 'interview', kind: 'interview', url: 'not a link' })).toContain('url');
  });
});
