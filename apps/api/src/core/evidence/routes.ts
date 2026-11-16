import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { EvidenceDetail, EvidenceQueueItem, EvidenceQueueQuery, ReviewInput, ReviewResult, UploadUrl, UploadUrlInput } from '@sana/contracts';
import { createRouter, errorResponses, IdParam, jsonBody, jsonRes, secured } from '../../platform/http.js';
import * as svc from './service.js';

const tags = ['Evidence'];
export const evidenceRoutes = createRouter();

evidenceRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/evidence/upload-url',
    tags,
    security: secured,
    summary: 'A signed URL for uploading a screenshot or report to Storage',
    request: { body: jsonBody(UploadUrlInput) },
    responses: { 200: jsonRes(UploadUrl), ...errorResponses },
  }),
  async (c) => c.json(await svc.requestUploadUrl(c.get('ctx'), c.req.valid('json')), 200),
);

evidenceRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/evidence',
    tags,
    security: secured,
    summary: 'The review queue (mentor or teacher, by reviewer role) or your teams confirmations (student)',
    request: { query: EvidenceQueueQuery },
    responses: { 200: jsonRes(z.array(EvidenceQueueItem)), ...errorResponses },
  }),
  async (c) => c.json(await svc.listEvidence(c.get('ctx'), c.req.valid('query')), 200),
);

evidenceRoutes.openapi(
  createRoute({ method: 'get', path: '/evidence/{id}', tags, security: secured, summary: 'Evidence with a link to its file', request: { params: IdParam }, responses: { 200: jsonRes(EvidenceDetail), ...errorResponses } }),
  async (c) => c.json(await svc.getEvidence(c.get('ctx'), c.req.valid('param').id), 200),
);

evidenceRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/evidence/{id}/review',
    tags,
    security: secured,
    summary: 'The decision: confirm, reject or adjust the points, with a comment',
    request: { params: IdParam, body: jsonBody(ReviewInput) },
    responses: { 200: jsonRes(ReviewResult), ...errorResponses },
  }),
  async (c) => c.json(await svc.reviewEvidence(c.get('ctx'), c.req.valid('param').id, c.req.valid('json')), 200),
);
