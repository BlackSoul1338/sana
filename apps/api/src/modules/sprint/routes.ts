import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { Evidence, sprint } from '@sana/contracts';
import { createRouter, errorResponses, IdParam, jsonBody, jsonRes, secured } from '../../platform/http.js';
import * as svc from './service.js';

const tags = ['Startup Sprint'];
export const sprintRoutes = createRouter();

sprintRoutes.openapi(
  createRoute({ method: 'get', path: '/sprint/templates', tags, security: secured, summary: 'The 25 stage task templates', responses: { 200: jsonRes(z.array(sprint.TaskTemplate)), ...errorResponses } }),
  async (c) => c.json(await svc.listTemplates(c.get('ctx')), 200),
);

sprintRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/sprint/projects',
    tags,
    security: secured,
    summary: 'Projects: your own (student), all (mentor), your organisation tasks (business)',
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
    summary: 'Create a team project: the five stages with planned dates',
    request: { body: jsonBody(sprint.CreateProjectInput) },
    responses: { 201: jsonRes(sprint.Project), ...errorResponses },
  }),
  async (c) => c.json(await svc.createProject(c.get('ctx'), c.req.valid('json')), 201),
);

sprintRoutes.openapi(
  createRoute({ method: 'get', path: '/sprint/projects/{id}', tags, security: secured, summary: 'The stage map, tasks, evidence and points of a project', request: { params: IdParam }, responses: { 200: jsonRes(sprint.Project), ...errorResponses } }),
  async (c) => c.json(await svc.getProject(c.get('ctx'), c.req.valid('param').id), 200),
);

sprintRoutes.openapi(
  createRoute({
    method: 'patch',
    path: '/sprint/projects/{id}/stages/{stageKey}',
    tags,
    security: secured,
    summary: 'Change a planned stage date (mentor)',
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
    summary: 'Add a task (from a template or your own) with a technology and an assignee',
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
    summary: 'Update a task: assignee, technology, status',
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
    summary: 'Submit stage, task or interview evidence for the mentor to review',
    request: { params: IdParam, body: jsonBody(sprint.SubmitSprintEvidenceInput) },
    responses: { 201: jsonRes(Evidence), ...errorResponses },
  }),
  async (c) => c.json(await svc.submitEvidence(c.get('ctx'), c.req.valid('param').id, c.req.valid('json')), 201),
);

sprintRoutes.openapi(
  createRoute({ method: 'get', path: '/sprint/projects/{id}/feed', tags, security: secured, summary: 'The feed of awards and achievements with explanations', request: { params: IdParam }, responses: { 200: jsonRes(sprint.Feed), ...errorResponses } }),
  async (c) => c.json(await svc.getFeed(c.get('ctx'), c.req.valid('param').id), 200),
);

sprintRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/sprint/projects/{id}/next-step',
    tags,
    security: secured,
    summary: 'The next useful action: code picks it, the model (or a template) phrases it',
    request: { params: IdParam },
    responses: { 200: jsonRes(sprint.NextStep.nullable()), ...errorResponses },
  }),
  async (c) => c.json(await svc.getNextStep(c.get('ctx'), c.req.valid('param').id), 200),
);
