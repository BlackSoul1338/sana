import { randomUUID } from 'node:crypto';
import { sql as dsql } from 'drizzle-orm';
import { MockLanguageModelV4 } from 'ai/test';
import { createApp, type App } from '../../src/app.js';
import { createDb, type Db } from '../../src/platform/db/client.js';
import { testVerifier } from '../../src/platform/auth.js';
import { fakeStorage } from '../../src/platform/storage.js';
import type { AiModels, ModelTier } from '../../src/platform/ai/index.js';
import { orgs, profiles } from '../../src/core/identity/schema.js';
import { seedReferenceData } from '../../src/seed/refs.js';

export type Clock = { now: Date };

export function testDb(): Db {
  return createDb(process.env.TEST_DATABASE_URL!).db;
}

export function makeApp(opts: { ai?: AiModels | null; clock?: Clock } = {}): App {
  const clock = opts.clock;
  return createApp({
    db: testDb(),
    verifier: testVerifier(),
    ai: opts.ai ?? null,
    storage: fakeStorage(),
    ...(clock ? { clock: () => new Date(clock.now) } : {}),
  });
}

/** Чистая база с заполненными справочниками перед каждым тестом. */
export async function resetDb() {
  const db = testDb();
  const rows = await db.execute<{ tablename: string }>(dsql`select tablename from pg_tables where schemaname = 'public'`);
  const names = [...rows].map((r) => `"public"."${r.tablename}"`);
  await db.execute(dsql.raw(`truncate ${[...names, 'auth.users'].join(', ')} restart identity cascade`));
  await seedReferenceData(db);
}

export type TestUser = { id: string; token: string; role: 'student' | 'mentor' | 'business'; orgId: string | null; name: string };

export async function createUser(role: TestUser['role'], name = `${role}-${randomUUID().slice(0, 4)}`, orgId?: string): Promise<TestUser> {
  const db = testDb();
  const id = randomUUID();
  await db.execute(dsql`insert into auth.users (id, email) values (${id}, ${`${id}@test.local`})`);
  let org = orgId ?? null;
  if (role === 'business' && !org) {
    const [o] = await db.insert(orgs).values({ name: `ООО ${name}`, kind: 'company' }).returning();
    org = o!.id;
  }
  await db.insert(profiles).values({ id, displayName: name, role, orgId: org });
  return { id, token: `test:${id}`, role, orgId: org, name };
}

export type Res<T = any> = { status: number; body: T };

/** Тонкий HTTP-клиент поверх app.request — без сети и без запуска сервера. */
export function http(app: App) {
  const call = async <T = any>(method: string, path: string, user?: TestUser | null, body?: unknown): Promise<Res<T>> => {
    const headers: Record<string, string> = {};
    if (user) headers.authorization = `Bearer ${user.token}`;
    if (body !== undefined) headers['content-type'] = 'application/json';
    const res = await app.request(path, { method, headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
  };
  return {
    get: <T = any>(path: string, user?: TestUser | null) => call<T>('GET', path, user),
    post: <T = any>(path: string, user: TestUser | null, body?: unknown) => call<T>('POST', path, user, body ?? {}),
    patch: <T = any>(path: string, user: TestUser | null, body: unknown) => call<T>('PATCH', path, user, body),
    put: <T = any>(path: string, user: TestUser | null, body: unknown) => call<T>('PUT', path, user, body),
  };
}

/**
 * Mock-модель: responder получает system и текст промпта и возвращает объект, который «модель» выдаст как JSON.
 */
export function mockAi(responder: (input: { tier: ModelTier; system: string; prompt: string }) => unknown): AiModels & { calls: { tier: ModelTier; system: string; prompt: string }[] } {
  const calls: { tier: ModelTier; system: string; prompt: string }[] = [];
  const make = (tier: ModelTier) =>
    new MockLanguageModelV4({
      modelId: `mock-${tier}`,
      doGenerate: async (options) => {
        let system = '';
        let prompt = '';
        for (const m of options.prompt) {
          if (m.role === 'system') system += m.content;
          else if (Array.isArray(m.content)) for (const p of m.content) if (p.type === 'text') prompt += p.text;
        }
        calls.push({ tier, system, prompt });
        const out = responder({ tier, system, prompt });
        return {
          content: [{ type: 'text', text: typeof out === 'string' ? out : JSON.stringify(out) }],
          finishReason: { unified: 'stop', raw: 'stop' },
          usage: {
            inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
            outputTokens: { total: 10, text: 10, reasoning: 0 },
          },
          warnings: [],
        };
      },
    });
  return { provider: 'mock', model: make, calls };
}
