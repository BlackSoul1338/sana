import type { Role } from '@sana/contracts';
import type { Db, DbLike } from './db/client.js';
import type { AiModels } from './ai/index.js';
import type { EventBus } from './events.js';
import type { StoragePort } from './storage.js';
import { forbidden, unauthorized } from './errors.js';

export type ActorProfile = { id: string; role: Role; orgId: string | null; displayName: string };
export type Actor = { userId: string; email: string | null; profile: ActorProfile | null };

/** Контекст use case: всё, что нужно сервису, передаётся явно — так его одинаково вызывают HTTP, скрипты и тесты. */
export type Ctx = {
  db: DbLike;
  actor: Actor;
  now: Date;
  ai: AiModels | null;
  bus: EventBus;
  storage: StoragePort;
  inTx?: boolean;
};

/** Транзакционный участок. Вложенные вызовы переиспользуют уже открытую транзакцию. */
export async function inTx<T>(ctx: Ctx, fn: (tctx: Ctx) => Promise<T>): Promise<T> {
  if (ctx.inTx) return fn(ctx);
  return (ctx.db as Db).transaction((tx) => fn({ ...ctx, db: tx, inTx: true }));
}

export function requireProfile(ctx: Ctx): ActorProfile {
  if (!ctx.actor.profile) throw unauthorized('Сначала создайте профиль: POST /me/profile');
  return ctx.actor.profile;
}

export function requireRole(ctx: Ctx, ...roles: Role[]): ActorProfile {
  const p = requireProfile(ctx);
  if (!roles.includes(p.role)) throw forbidden(`Действие доступно ролям: ${roles.join(', ')}`);
  return p;
}

/** Системный актор для seed и скриптов. */
export const systemActor = (profile: ActorProfile): Actor => ({ userId: profile.id, email: null, profile });
