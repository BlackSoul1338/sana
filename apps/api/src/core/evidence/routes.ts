import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { Evidence, EvidenceDetail, EvidenceQueueQuery, ReviewInput, ReviewResult, UploadUrl, UploadUrlInput } from '@sana/contracts';
import { createRouter, errorResponses, IdParam, jsonBody, jsonRes, secured } from '../../platform/http.js';
import * as svc from './service.js';

const tags = ['Подтверждения'];
export const evidenceRoutes = createRouter();

evidenceRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/evidence/upload-url',
    tags,
    security: secured,
    summary: 'Подписанная ссылка для загрузки скриншота или отчёта в Storage',
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
    summary: 'Очередь проверки (куратор) или подтверждения своих команд (студент)',
    request: { query: EvidenceQueueQuery },
    responses: { 200: jsonRes(z.array(Evidence)), ...errorResponses },
  }),
  async (c) => c.json(await svc.listEvidence(c.get('ctx'), c.req.valid('query')), 200),
);

evidenceRoutes.openapi(
  createRoute({ method: 'get', path: '/evidence/{id}', tags, security: secured, summary: 'Подтверждение со ссылкой на файл', request: { params: IdParam }, responses: { 200: jsonRes(EvidenceDetail), ...errorResponses } }),
  async (c) => c.json(await svc.getEvidence(c.get('ctx'), c.req.valid('param').id), 200),
);

evidenceRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/evidence/{id}/review',
    tags,
    security: secured,
    summary: 'Решение куратора: подтвердить, отклонить или скорректировать баллы с пояснением',
    request: { params: IdParam, body: jsonBody(ReviewInput) },
    responses: { 200: jsonRes(ReviewResult), ...errorResponses },
  }),
  async (c) => c.json(await svc.reviewEvidence(c.get('ctx'), c.req.valid('param').id, c.req.valid('json')), 200),
);
