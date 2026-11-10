import { createRoute } from '@hono/zod-openapi';
import { match } from '@sana/contracts';
import { createRouter, errorResponses, IdParam, jsonBody, jsonRes, secured } from '../platform/http.js';
import { decideApplication } from './accept-application.js';

/** Маршруты межмодульных сценариев. */
export const flowRoutes = createRouter();

flowRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/match/applications/{id}/decision',
    tags: ['Challenge Match'],
    security: secured,
    summary: 'Решение бизнеса по заявке; при принятии задача закрепляется и попадает в трекер Startup Sprint',
    request: { params: IdParam, body: jsonBody(match.DecisionInput) },
    responses: { 200: jsonRes(match.DecisionResult), ...errorResponses },
  }),
  async (c) => c.json(await decideApplication(c.get('ctx'), c.req.valid('param').id, c.req.valid('json')), 200),
);
