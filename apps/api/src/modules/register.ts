import type { OpenAPIHono } from '@hono/zod-openapi';
import type { EventBus } from '../platform/events.js';
import type { AppEnv } from '../platform/http.js';
import { registerSprintHandlers } from './sprint/handlers.js';
import { sprintRoutes } from './sprint/routes.js';
import { challengeBuilderRoutes } from './challenge-builder/routes.js';
import { matchRoutes } from './match/routes.js';
import { registerPracticeHandlers } from './practice/handlers.js';
import { practiceRoutes } from './practice/routes.js';

type ModuleRoutes = { routes: OpenAPIHono<AppEnv>[] };

/** Подключение модулей: каждый регистрирует обработчики доменных событий и отдаёт свои маршруты. */
export function registerModules(bus: EventBus): ModuleRoutes {
  registerSprintHandlers(bus);
  registerPracticeHandlers(bus);
  return { routes: [sprintRoutes, challengeBuilderRoutes, matchRoutes, practiceRoutes] };
}
