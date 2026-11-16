import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { AdjustmentInput, LeaderboardEntry, LeaderboardQuery, PointEvent, PointsQuery } from '@sana/contracts';
import { createRouter, errorResponses, jsonBody, jsonRes, secured } from '../../platform/http.js';
import * as ledger from './ledger.js';

const tags = ['Points and leaderboard'];
export const pointsRoutes = createRouter();

pointsRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/leaderboard',
    tags,
    security: secured,
    summary: 'Leaderboard of teams, members or organisations (all modules or one)',
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
    summary: 'The ledger with explanations: yours, your teams or your organisation; any for a reviewer',
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
    summary: 'A mentor point adjustment (a new event with the comment)',
    request: { body: jsonBody(AdjustmentInput) },
    responses: { 201: jsonRes(PointEvent), ...errorResponses },
  }),
  async (c) => c.json(await ledger.adjust(c.get('ctx'), c.req.valid('json')), 201),
);
