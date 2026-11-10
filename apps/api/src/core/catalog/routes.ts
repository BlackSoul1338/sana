import { createRoute } from '@hono/zod-openapi';
import { Page, Task, TaskListQuery } from '@sana/contracts';
import { createRouter, errorResponses, IdParam, jsonRes, secured } from '../../platform/http.js';
import * as svc from './service.js';

const tags = ['Каталог задач'];
export const catalogRoutes = createRouter();

catalogRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/tasks',
    tags,
    security: secured,
    summary: 'Каталог опубликованных задач с фильтрами по теме и сложности',
    request: { query: TaskListQuery },
    responses: { 200: jsonRes(Page(Task)), ...errorResponses },
  }),
  async (c) => c.json(await svc.listTasks(c.get('ctx'), c.req.valid('query')), 200),
);

catalogRoutes.openapi(
  createRoute({ method: 'get', path: '/tasks/{id}', tags, security: secured, summary: 'Карточка задачи', request: { params: IdParam }, responses: { 200: jsonRes(Task), ...errorResponses } }),
  async (c) => c.json(await svc.getTask(c.get('ctx'), c.req.valid('param').id), 200),
);
