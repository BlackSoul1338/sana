import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { match } from '@sana/contracts';
import { createRouter, errorResponses, IdParam, jsonBody, jsonRes, secured } from '../../platform/http.js';
import * as svc from './service.js';

const tags = ['Challenge Match'];
export const matchRoutes = createRouter();

matchRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/match/recommendations',
    tags,
    security: secured,
    summary: 'Не меньше пяти задач для команды с процентом соответствия, совпадениями, пробелами и планом роста',
    request: { query: match.RecommendationsQuery },
    responses: { 200: jsonRes(match.RecommendationsResult), ...errorResponses },
  }),
  async (c) => c.json(await svc.recommend(c.get('ctx'), c.req.valid('query')), 200),
);

matchRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/match/tasks/{id}/fit',
    tags,
    security: secured,
    summary: 'Объяснение соответствия команды конкретной задаче',
    request: { params: IdParam, query: match.FitQuery },
    responses: { 200: jsonRes(match.Fit), ...errorResponses },
  }),
  async (c) => c.json(await svc.fitForTask(c.get('ctx'), c.req.valid('param').id, c.req.valid('query').teamId), 200),
);

matchRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/match/applications',
    tags,
    security: secured,
    summary: 'Отклик команды на задачу (баллы за выбор не начисляются)',
    request: { body: jsonBody(match.ApplyInput) },
    responses: { 201: jsonRes(match.Application), ...errorResponses },
  }),
  async (c) => c.json(await svc.apply(c.get('ctx'), c.req.valid('json')), 201),
);

matchRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/match/applications',
    tags,
    security: secured,
    summary: 'Заявки команды или заявки на задачу (для её владельца)',
    request: { query: z.object({ teamId: z.uuid().optional(), taskId: z.uuid().optional() }) },
    responses: { 200: jsonRes(z.array(match.Application)), ...errorResponses },
  }),
  async (c) => c.json(await svc.listApplications(c.get('ctx'), c.req.valid('query')), 200),
);

matchRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/match/applications/{id}/withdraw',
    tags,
    security: secured,
    summary: 'Отозвать заявку',
    request: { params: IdParam },
    responses: { 200: jsonRes(match.Application), ...errorResponses },
  }),
  async (c) => c.json(await svc.withdraw(c.get('ctx'), c.req.valid('param').id), 200),
);

matchRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/match/feedback',
    tags,
    security: secured,
    summary: 'Отзыв бизнеса на подтверждённый результат; положительный даёт коэффициент реальной задачи',
    request: { body: jsonBody(match.FeedbackInput) },
    responses: { 200: jsonRes(match.FeedbackResult), ...errorResponses },
  }),
  async (c) => c.json(await svc.feedback(c.get('ctx'), c.req.valid('json')), 200),
);
