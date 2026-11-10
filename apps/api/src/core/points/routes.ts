import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { AdjustmentInput, LeaderboardEntry, LeaderboardQuery, PointEvent, PointsQuery } from '@sana/contracts';
import { createRouter, errorResponses, jsonBody, jsonRes, secured } from '../../platform/http.js';
import * as ledger from './ledger.js';

const tags = ['Баллы и рейтинг'];
export const pointsRoutes = createRouter();

pointsRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/leaderboard',
    tags,
    security: secured,
    summary: 'Рейтинг команд, участников или организаций (по всем модулям или одному)',
    request: { query: LeaderboardQuery },
    responses: { 200: jsonRes(z.array(LeaderboardEntry)), ...errorResponses },
  }),
  async (c) => c.json(await ledger.leaderboard(c.get('ctx'), c.req.valid('query')), 200),
);

pointsRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/points',
    tags,
    security: secured,
    summary: 'Журнал начислений субъекта с объяснениями',
    request: { query: PointsQuery },
    responses: { 200: jsonRes(z.array(PointEvent)), ...errorResponses },
  }),
  async (c) => c.json(await ledger.listEvents(c.get('ctx'), c.req.valid('query')), 200),
);

pointsRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/points/adjustments',
    tags,
    security: secured,
    summary: 'Корректировка баллов куратором (новое событие с комментарием)',
    request: { body: jsonBody(AdjustmentInput) },
    responses: { 201: jsonRes(PointEvent), ...errorResponses },
  }),
  async (c) => c.json(await ledger.adjust(c.get('ctx'), c.req.valid('json')), 201),
);
