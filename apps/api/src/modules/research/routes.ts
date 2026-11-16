import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { research } from '@sana/contracts';
import { aiErrorResponses, createRouter, errorResponses, IdParam, jsonBody, jsonRes, secured } from '../../platform/http.js';
import * as svc from './service.js';

const tags = ['Team Research Arena'];
export const researchRoutes = createRouter();

researchRoutes.openapi(
  createRoute({ method: 'get', path: '/research/tasks', tags, security: secured, summary: 'The research tasks', responses: { 200: jsonRes(z.array(research.Task)), ...errorResponses } }),
  async (c) => c.json(await svc.listTasks(c.get('ctx')), 200),
);

researchRoutes.openapi(
  createRoute({ method: 'post', path: '/research/tasks', tags, security: secured, summary: 'A new task with a rubric (teacher)', request: { body: jsonBody(research.NewTask) }, responses: { 201: jsonRes(research.Task), ...errorResponses } }),
  async (c) => c.json(await svc.createTask(c.get('ctx'), c.req.valid('json')), 201),
);

researchRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/research/tasks/{id}/workspaces',
    tags,
    security: secured,
    summary: 'A team takes the task and records its initial position',
    request: { params: IdParam, body: jsonBody(research.StartInput) },
    responses: { 201: jsonRes(research.Workspace), ...errorResponses },
  }),
  async (c) => c.json(await svc.startWorkspace(c.get('ctx'), c.req.valid('param').id, c.req.valid('json')), 201),
);

researchRoutes.openapi(
  createRoute({ method: 'get', path: '/research/workspaces', tags, security: secured, summary: 'The teams research workspaces (student — their own, teacher — all)', request: { query: research.WorkspacesQuery }, responses: { 200: jsonRes(z.array(research.WorkspaceSummary)), ...errorResponses } }),
  async (c) => c.json(await svc.listWorkspaces(c.get('ctx'), c.req.valid('query')), 200),
);

researchRoutes.openapi(
  createRoute({ method: 'get', path: '/research/workspaces/{id}', tags, security: secured, summary: 'The workspace: threads, the board, the argument map, contribution, the conclusion', request: { params: IdParam }, responses: { 200: jsonRes(research.Workspace), ...errorResponses } }),
  async (c) => c.json(await svc.getWorkspace(c.get('ctx'), c.req.valid('param').id), 200),
);

researchRoutes.openapi(
  createRoute({ method: 'get', path: '/research/evidence/{id}/workspace', tags, security: secured, summary: 'The research behind a conclusion evidence (for review)', request: { params: IdParam }, responses: { 200: jsonRes(research.Workspace), ...errorResponses } }),
  async (c) => c.json(await svc.workspaceByEvidence(c.get('ctx'), c.req.valid('param').id), 200),
);

researchRoutes.openapi(
  createRoute({ method: 'put', path: '/research/workspaces/{id}/roles', tags, security: secured, summary: 'The roles of the participants in the research', request: { params: IdParam, body: jsonBody(research.RolesInput) }, responses: { 200: jsonRes(research.Workspace), ...errorResponses } }),
  async (c) => c.json(await svc.setRoles(c.get('ctx'), c.req.valid('param').id, c.req.valid('json')), 200),
);

researchRoutes.openapi(
  createRoute({ method: 'post', path: '/research/workspaces/{id}/threads', tags, security: secured, summary: 'A new discussion thread (hypothesis)', request: { params: IdParam, body: jsonBody(research.NewThread) }, responses: { 201: jsonRes(research.Thread), ...errorResponses } }),
  async (c) => c.json(await svc.createThread(c.get('ctx'), c.req.valid('param').id, c.req.valid('json')), 201),
);

researchRoutes.openapi(
  createRoute({ method: 'post', path: '/research/threads/{id}/messages', tags, security: secured, summary: 'A message in a thread (no points)', request: { params: IdParam, body: jsonBody(research.NewMessage) }, responses: { 201: jsonRes(research.Message), ...errorResponses } }),
  async (c) => c.json(await svc.postMessage(c.get('ctx'), c.req.valid('param').id, c.req.valid('json')), 201),
);

researchRoutes.openapi(
  createRoute({ method: 'get', path: '/research/workspaces/{id}/messages', tags, security: secured, summary: 'Messages after a cursor (for polling)', request: { params: IdParam, query: research.MessagesQuery }, responses: { 200: jsonRes(research.MessagePage), ...errorResponses } }),
  async (c) => c.json(await svc.listMessages(c.get('ctx'), c.req.valid('param').id, c.req.valid('query').cursor), 200),
);

researchRoutes.openapi(
  createRoute({ method: 'post', path: '/research/workspaces/{id}/items', tags, security: secured, summary: 'An argument, a source or a question for the board', request: { params: IdParam, body: jsonBody(research.NewItem) }, responses: { 201: jsonRes(research.Item), ...errorResponses } }),
  async (c) => c.json(await svc.addItem(c.get('ctx'), c.req.valid('param').id, c.req.valid('json')), 201),
);

researchRoutes.openapi(
  createRoute({ method: 'post', path: '/research/workspaces/{id}/summary', tags, security: secured, summary: 'A model summary of the discussion: the missing arguments and questions (team members)', request: { params: IdParam }, responses: { 200: jsonRes(research.Workspace), ...aiErrorResponses } }),
  async (c) => c.json(await svc.refreshSummary(c.get('ctx'), c.req.valid('param').id), 200),
);

researchRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/research/workspaces/{id}/conclusion',
    tags,
    security: secured,
    summary: 'Send the conclusion to the teacher: every claim links to the board',
    request: { params: IdParam, body: jsonBody(research.ConclusionInput) },
    responses: { 200: jsonRes(research.Workspace), ...errorResponses },
  }),
  async (c) => c.json(await svc.submitConclusion(c.get('ctx'), c.req.valid('param').id, c.req.valid('json')), 200),
);
