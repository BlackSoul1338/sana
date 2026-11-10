import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { Evidence, sprint } from '@sana/contracts';
import { createRouter, errorResponses, IdParam, jsonBody, jsonRes, secured } from '../../platform/http.js';
import * as svc from './service.js';

const tags = ['Startup Sprint'];
export const sprintRoutes = createRouter();

sprintRoutes.openapi(
  createRoute({ method: 'get', path: '/sprint/templates', tags, security: secured, summary: '25 типовых задач по этапам', responses: { 200: jsonRes(z.array(sprint.TaskTemplate)), ...errorResponses } }),
  async (c) => c.json(await svc.listTemplates(c.get('ctx')), 200),
);

sprintRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/sprint/projects',
    tags,
    security: secured,
    summary: 'Проекты: свои (студент), все (куратор), по задачам организации (бизнес)',
    request: { query: z.object({ teamId: z.uuid().optional() }) },
    responses: { 200: jsonRes(z.array(sprint.ProjectSummary)), ...errorResponses },
  }),
  async (c) => c.json(await svc.listProjects(c.get('ctx'), c.req.valid('query')), 200),
);

sprintRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/sprint/projects',
    tags,
    security: secured,
    summary: 'Создать проект команды: пять этапов с плановыми сроками',
    request: { body: jsonBody(sprint.CreateProjectInput) },
    responses: { 201: jsonRes(sprint.Project), ...errorResponses },
  }),
  async (c) => c.json(await svc.createProject(c.get('ctx'), c.req.valid('json')), 201),
);

sprintRoutes.openapi(
  createRoute({ method: 'get', path: '/sprint/projects/{id}', tags, security: secured, summary: 'Карта этапов, задачи, подтверждения и баллы проекта', request: { params: IdParam }, responses: { 200: jsonRes(sprint.Project), ...errorResponses } }),
  async (c) => c.json(await svc.getProject(c.get('ctx'), c.req.valid('param').id), 200),
);

sprintRoutes.openapi(
  createRoute({
    method: 'patch',
    path: '/sprint/projects/{id}/stages/{stageKey}',
    tags,
    security: secured,
    summary: 'Изменить плановую дату этапа (куратор)',
    request: { params: z.object({ id: z.uuid(), stageKey: sprint.StageKey }), body: jsonBody(sprint.UpdateStagePlanInput) },
    responses: { 200: jsonRes(sprint.Project), ...errorResponses },
  }),
  async (c) => {
    const { id, stageKey } = c.req.valid('param');
    return c.json(await svc.updateStagePlan(c.get('ctx'), id, stageKey, c.req.valid('json').plannedAt), 200);
  },
);

sprintRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/sprint/projects/{id}/tasks',
    tags,
    security: secured,
    summary: 'Добавить задачу (из шаблона или свою) с технологией и исполнителем',
    request: { params: IdParam, body: jsonBody(sprint.CreateSprintTaskInput) },
    responses: { 201: jsonRes(sprint.SprintTask), ...errorResponses },
  }),
  async (c) => c.json(await svc.createTask(c.get('ctx'), c.req.valid('param').id, c.req.valid('json')), 201),
);

sprintRoutes.openapi(
  createRoute({
    method: 'patch',
    path: '/sprint/tasks/{id}',
    tags,
    security: secured,
    summary: 'Изменить задачу: исполнитель, технология, статус',
    request: { params: IdParam, body: jsonBody(sprint.UpdateSprintTaskInput) },
    responses: { 200: jsonRes(sprint.SprintTask), ...errorResponses },
  }),
  async (c) => c.json(await svc.updateTask(c.get('ctx'), c.req.valid('param').id, c.req.valid('json')), 200),
);

sprintRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/sprint/projects/{id}/evidence',
    tags,
    security: secured,
    summary: 'Отправить подтверждение этапа, задачи или интервью на проверку куратору',
    request: { params: IdParam, body: jsonBody(sprint.SubmitSprintEvidenceInput) },
    responses: { 201: jsonRes(Evidence), ...errorResponses },
  }),
  async (c) => c.json(await svc.submitEvidence(c.get('ctx'), c.req.valid('param').id, c.req.valid('json')), 201),
);

sprintRoutes.openapi(
  createRoute({ method: 'get', path: '/sprint/projects/{id}/feed', tags, security: secured, summary: 'Лента начислений и достижений с объяснениями', request: { params: IdParam }, responses: { 200: jsonRes(sprint.Feed), ...errorResponses } }),
  async (c) => c.json(await svc.getFeed(c.get('ctx'), c.req.valid('param').id), 200),
);

sprintRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/sprint/projects/{id}/next-step',
    tags,
    security: secured,
    summary: 'Следующее полезное действие: выбирает код, формулирует модель (или шаблон)',
    request: { params: IdParam },
    responses: { 200: jsonRes(sprint.NextStep.nullable()), ...errorResponses },
  }),
  async (c) => c.json(await svc.getNextStep(c.get('ctx'), c.req.valid('param').id), 200),
);
