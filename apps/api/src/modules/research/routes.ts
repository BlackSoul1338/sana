import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { research } from '@sana/contracts';
import { aiErrorResponses, createRouter, errorResponses, IdParam, jsonBody, jsonRes, secured } from '../../platform/http.js';
import * as svc from './service.js';

const tags = ['Team Research Arena'];
export const researchRoutes = createRouter();

researchRoutes.openapi(
  createRoute({ method: 'get', path: '/research/tasks', tags, security: secured, summary: 'Исследовательские задачи', responses: { 200: jsonRes(z.array(research.Task)), ...errorResponses } }),
  async (c) => c.json(await svc.listTasks(c.get('ctx')), 200),
);

researchRoutes.openapi(
  createRoute({ method: 'post', path: '/research/tasks', tags, security: secured, summary: 'Новая задача с рубрикой (преподаватель)', request: { body: jsonBody(research.NewTask) }, responses: { 201: jsonRes(research.Task), ...errorResponses } }),
  async (c) => c.json(await svc.createTask(c.get('ctx'), c.req.valid('json')), 201),
);

researchRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/research/tasks/{id}/workspaces',
    tags,
    security: secured,
    summary: 'Команда берёт задачу и фиксирует начальную позицию',
    request: { params: IdParam, body: jsonBody(research.StartInput) },
    responses: { 201: jsonRes(research.Workspace), ...errorResponses },
  }),
  async (c) => c.json(await svc.startWorkspace(c.get('ctx'), c.req.valid('param').id, c.req.valid('json')), 201),
);

researchRoutes.openapi(
  createRoute({ method: 'get', path: '/research/workspaces', tags, security: secured, summary: 'Исследования команд (студент — свои, преподаватель — все)', request: { query: research.WorkspacesQuery }, responses: { 200: jsonRes(z.array(research.WorkspaceSummary)), ...errorResponses } }),
  async (c) => c.json(await svc.listWorkspaces(c.get('ctx'), c.req.valid('query')), 200),
);

researchRoutes.openapi(
  createRoute({ method: 'get', path: '/research/workspaces/{id}', tags, security: secured, summary: 'Рабочее пространство: ветки, доска, карта аргументов, вклад, вывод', request: { params: IdParam }, responses: { 200: jsonRes(research.Workspace), ...errorResponses } }),
  async (c) => c.json(await svc.getWorkspace(c.get('ctx'), c.req.valid('param').id), 200),
);

researchRoutes.openapi(
  createRoute({ method: 'get', path: '/research/evidence/{id}/workspace', tags, security: secured, summary: 'Исследование по подтверждению вывода (для проверки)', request: { params: IdParam }, responses: { 200: jsonRes(research.Workspace), ...errorResponses } }),
  async (c) => c.json(await svc.workspaceByEvidence(c.get('ctx'), c.req.valid('param').id), 200),
);

researchRoutes.openapi(
  createRoute({ method: 'put', path: '/research/workspaces/{id}/roles', tags, security: secured, summary: 'Роли участников в исследовании', request: { params: IdParam, body: jsonBody(research.RolesInput) }, responses: { 200: jsonRes(research.Workspace), ...errorResponses } }),
  async (c) => c.json(await svc.setRoles(c.get('ctx'), c.req.valid('param').id, c.req.valid('json')), 200),
);

researchRoutes.openapi(
  createRoute({ method: 'post', path: '/research/workspaces/{id}/threads', tags, security: secured, summary: 'Новая ветка обсуждения (гипотеза)', request: { params: IdParam, body: jsonBody(research.NewThread) }, responses: { 201: jsonRes(research.Thread), ...errorResponses } }),
  async (c) => c.json(await svc.createThread(c.get('ctx'), c.req.valid('param').id, c.req.valid('json')), 201),
);

researchRoutes.openapi(
  createRoute({ method: 'post', path: '/research/threads/{id}/messages', tags, security: secured, summary: 'Сообщение в ветке (баллов не даёт)', request: { params: IdParam, body: jsonBody(research.NewMessage) }, responses: { 201: jsonRes(research.Message), ...errorResponses } }),
  async (c) => c.json(await svc.postMessage(c.get('ctx'), c.req.valid('param').id, c.req.valid('json')), 201),
);

researchRoutes.openapi(
  createRoute({ method: 'get', path: '/research/workspaces/{id}/messages', tags, security: secured, summary: 'Сообщения после курсора (для опроса)', request: { params: IdParam, query: research.MessagesQuery }, responses: { 200: jsonRes(research.MessagePage), ...errorResponses } }),
  async (c) => c.json(await svc.listMessages(c.get('ctx'), c.req.valid('param').id, c.req.valid('query').cursor), 200),
);

researchRoutes.openapi(
  createRoute({ method: 'post', path: '/research/workspaces/{id}/items', tags, security: secured, summary: 'Аргумент, источник или вопрос на доску', request: { params: IdParam, body: jsonBody(research.NewItem) }, responses: { 201: jsonRes(research.Item), ...errorResponses } }),
  async (c) => c.json(await svc.addItem(c.get('ctx'), c.req.valid('param').id, c.req.valid('json')), 201),
);

researchRoutes.openapi(
  createRoute({ method: 'post', path: '/research/workspaces/{id}/summary', tags, security: secured, summary: 'Сводка обсуждения моделью: недостающие аргументы и вопросы', request: { params: IdParam }, responses: { 200: jsonRes(research.Workspace), ...aiErrorResponses } }),
  async (c) => c.json(await svc.refreshSummary(c.get('ctx'), c.req.valid('param').id), 200),
);

researchRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/research/workspaces/{id}/conclusion',
    tags,
    security: secured,
    summary: 'Отправить вывод преподавателю: каждое утверждение со ссылками на доску',
    request: { params: IdParam, body: jsonBody(research.ConclusionInput) },
    responses: { 200: jsonRes(research.Workspace), ...errorResponses },
  }),
  async (c) => c.json(await svc.submitConclusion(c.get('ctx'), c.req.valid('param').id, c.req.valid('json')), 200),
);
