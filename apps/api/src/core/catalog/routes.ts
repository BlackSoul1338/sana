import { createRoute } from '@hono/zod-openapi';
import { Page, Task, TaskListQuery } from '@sana/contracts';
import { createRouter, errorResponses, IdParam, jsonRes, secured } from '../../platform/http.js';
import * as svc from './service.js';

const tags = ['Task catalog'];
export const catalogRoutes = createRouter();

catalogRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/tasks',
    tags,
    security: secured,
    summary: 'The catalog of published tasks, with topic and difficulty filters',
    request: { query: TaskListQuery },
    responses: { 200: jsonRes(Page(Task)), ...errorResponses },
  }),
  async (c) => c.json(await svc.listTasks(c.get('ctx'), c.req.valid('query')), 200),
);

catalogRoutes.openapi(
  createRoute({ method: 'get', path: '/tasks/{id}', tags, security: secured, summary: 'A task card', request: { params: IdParam }, responses: { 200: jsonRes(Task), ...errorResponses } }),
  async (c) => c.json(await svc.getTask(c.get('ctx'), c.req.valid('param').id), 200),
);
