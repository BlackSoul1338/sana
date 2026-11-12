import { randomUUID } from 'node:crypto';
import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { Scalar } from '@scalar/hono-api-reference';
import { cors } from 'hono/cors';
import { z } from 'zod';
import type { Ctx } from './platform/context.js';
import type { Db } from './platform/db/client.js';
import type { AiModels } from './platform/ai/index.js';
import type { TokenVerifier } from './platform/auth.js';
import type { StoragePort } from './platform/storage.js';
import type { AccountsPort } from './platform/accounts.js';
import { EventBus } from './platform/events.js';
import { AppError, unauthorized } from './platform/errors.js';
import { errorResponses, jsonBody, jsonRes, sendProblem, zodIssuesToFieldErrors, type AppEnv } from './platform/http.js';
import { SignUpInput, SignUpResult } from '@sana/contracts';
import { loadActorProfile } from './core/identity/service.js';
import { identityRoutes } from './core/identity/routes.js';
import { catalogRoutes } from './core/catalog/routes.js';
import { evidenceRoutes } from './core/evidence/routes.js';
import { pointsRoutes } from './core/points/routes.js';
import { registerModules } from './modules/register.js';
import { flowRoutes } from './flows/routes.js';

export type AppDeps = {
  /** A function is resolved per request (Workers open a connection per request). */
  db: Db | (() => Db);
  verifier: TokenVerifier;
  ai: AiModels | null;
  storage: StoragePort;
  accounts: AccountsPort;
  clock?: () => Date;
  corsOrigins?: string[];
};

export const API_INFO = {
  openapi: '3.1.0',
  info: {
    title: 'AI Sana Platform API',
    version: '0.1.0',
    description:
      'Ядро платформы практических заданий (профили, команды, каталог, подтверждения, баллы) и модули: ' +
      'Startup Sprint (кейс 1), Business Challenge Builder (кейс 2), Challenge Match (кейс 3). ' +
      'Авторизация: access token Supabase Auth в заголовке Authorization: Bearer.',
  },
} as const;

/** Корень композиции: здесь собираются ядро, модули, их обработчики событий и сценарии. */
export function createApp(deps: AppDeps) {
  const bus = new EventBus();
  const modules = registerModules(bus);
  const clock = deps.clock ?? (() => new Date());

  const app = new OpenAPIHono<AppEnv>({
    defaultHook: (result, c) => {
      if (!result.success) {
        return sendProblem(c, new AppError('validation_failed', 422, 'Запрос не прошёл проверку', zodIssuesToFieldErrors(result.error)));
      }
    },
  });

  app.openAPIRegistry.registerComponent('securitySchemes', 'bearerAuth', {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
    description: 'Access token Supabase Auth',
  });

  app.use('*', async (c, next) => {
    c.set('requestId', c.req.header('x-request-id') ?? randomUUID());
    await next();
    c.header('x-request-id', c.get('requestId'));
  });

  app.use('*', cors({ origin: deps.corsOrigins ?? ['http://localhost:5173', 'http://localhost:3000'], allowHeaders: ['Authorization', 'Content-Type'], exposeHeaders: ['x-request-id'] }));

  app.onError((err, c) => {
    if (err instanceof AppError) return sendProblem(c, err);
    if (err instanceof z.ZodError) return sendProblem(c, new AppError('validation_failed', 422, 'Данные не прошли проверку', zodIssuesToFieldErrors(err)));
    console.error(`[${c.get('requestId')}]`, err);
    return sendProblem(c, new AppError('internal', 500, 'Внутренняя ошибка сервера'));
  });

  app.notFound((c) => sendProblem(c, new AppError('not_found', 404, `Маршрут ${c.req.method} ${c.req.path} не найден`)));

  app.get('/health', (c) => c.json({ ok: true, ai: deps.ai?.provider ?? 'disabled' }));
  app.doc31('/openapi.json', API_INFO);
  app.get('/docs', Scalar({ url: '/openapi.json', pageTitle: 'AI Sana API' }));

  app.openapi(
    createRoute({
      method: 'post',
      path: '/auth/sign-up',
      tags: ['Профиль'],
      summary: 'Регистрация по почте и паролю без письма подтверждения; дальше клиент входит паролем',
      request: { body: jsonBody(SignUpInput) },
      responses: { 201: jsonRes(SignUpResult), ...errorResponses },
    }),
    async (c) => {
      const { email, password } = c.req.valid('json');
      return c.json(await deps.accounts.create(email, password), 201);
    },
  );

  // Всё под /api требует токен. Профиль подгружается один раз и кладётся в контекст use case.
  app.use('/api/*', async (c, next) => {
    const header = c.req.header('authorization') ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (!token) throw unauthorized();
    const verified = await deps.verifier(token);
    if (!verified) throw unauthorized('Токен недействителен или истёк');
    const db = typeof deps.db === 'function' ? deps.db() : deps.db;
    const profile = await loadActorProfile(db, verified.userId);
    const actor = { userId: verified.userId, email: verified.email, profile };
    const ctx: Ctx = { db, actor, now: clock(), ai: deps.ai, bus, storage: deps.storage };
    c.set('actor', actor);
    c.set('ctx', ctx);
    await next();
  });

  app.route('/api', identityRoutes);
  app.route('/api', catalogRoutes);
  app.route('/api', evidenceRoutes);
  app.route('/api', pointsRoutes);
  for (const r of modules.routes) app.route('/api', r);
  app.route('/api', flowRoutes);

  return app;
}

export type App = ReturnType<typeof createApp>;
