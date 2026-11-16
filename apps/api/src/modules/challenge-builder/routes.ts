import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { bcb } from '@sana/contracts';
import { aiErrorResponses, createRouter, errorResponses, IdParam, jsonBody, jsonRes, secured } from '../../platform/http.js';
import * as svc from './service.js';

const tags = ['Business Challenge Builder'];
export const challengeBuilderRoutes = createRouter();

challengeBuilderRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/bcb/drafts',
    tags,
    security: secured,
    summary: 'Start: free-text problem description → completeness check and follow-up questions (at least three)',
    request: { body: jsonBody(bcb.CreateDraftInput) },
    responses: { 201: jsonRes(bcb.TurnResult), ...aiErrorResponses },
  }),
  async (c) => c.json(await svc.createDraft(c.get('ctx'), c.req.valid('json')), 201),
);

challengeBuilderRoutes.openapi(
  createRoute({ method: 'get', path: '/bcb/drafts', tags, security: secured, summary: 'Your organisation drafts', responses: { 200: jsonRes(z.array(bcb.DraftSummary)), ...errorResponses } }),
  async (c) => c.json(await svc.listDrafts(c.get('ctx')), 200),
);

challengeBuilderRoutes.openapi(
  createRoute({ method: 'get', path: '/bcb/drafts/{id}', tags, security: secured, summary: 'A draft: the dialog, the fields, the readiness, the card', request: { params: IdParam }, responses: { 200: jsonRes(bcb.Draft), ...errorResponses } }),
  async (c) => c.json(await svc.getDraft(c.get('ctx'), c.req.valid('param').id), 200),
);

challengeBuilderRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/bcb/drafts/{id}/turns',
    tags,
    security: secured,
    summary: 'The business answer → a new analysis, readiness and follow-up questions',
    request: { params: IdParam, body: jsonBody(bcb.TurnInput) },
    responses: { 200: jsonRes(bcb.TurnResult), ...aiErrorResponses },
  }),
  async (c) => c.json(await svc.addTurn(c.get('ctx'), c.req.valid('param').id, c.req.valid('json')), 200),
);

challengeBuilderRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/bcb/drafts/{id}/compose',
    tags,
    security: secured,
    summary: 'Compose the card and propose the team requirements (personal-data scan before calling the model)',
    request: { params: IdParam },
    responses: { 200: jsonRes(bcb.ComposeResult), ...aiErrorResponses },
  }),
  async (c) => c.json(await svc.compose(c.get('ctx'), c.req.valid('param').id), 200),
);

challengeBuilderRoutes.openapi(
  createRoute({
    method: 'patch',
    path: '/bcb/drafts/{id}/card',
    tags,
    security: secured,
    summary: 'Card and requirements edits in the preview',
    request: { params: IdParam, body: jsonBody(bcb.UpdateCardInput) },
    responses: { 200: jsonRes(bcb.Draft), ...errorResponses },
  }),
  async (c) => c.json(await svc.updateCard(c.get('ctx'), c.req.valid('param').id, c.req.valid('json')), 200),
);

challengeBuilderRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/bcb/drafts/{id}/publish',
    tags,
    security: secured,
    summary: 'Manual confirmation and publishing into the catalog; readiness points go to the organisation',
    request: { params: IdParam, body: jsonBody(bcb.PublishInput) },
    responses: { 201: jsonRes(bcb.PublishResult), ...errorResponses },
  }),
  async (c) => c.json(await svc.publish(c.get('ctx'), c.req.valid('param').id), 201),
);

challengeBuilderRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/bcb/drafts/{id}/diff',
    tags,
    security: secured,
    summary: 'Compare before and after the dialog: which answer raised which field',
    request: { params: IdParam },
    responses: { 200: jsonRes(bcb.DraftDiff), ...errorResponses },
  }),
  async (c) => c.json(await svc.getDiff(c.get('ctx'), c.req.valid('param').id), 200),
);
