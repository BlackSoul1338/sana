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
    summary: 'Начать: свободное описание проблемы → проверка полноты и уточняющие вопросы (не меньше трёх)',
    request: { body: jsonBody(bcb.CreateDraftInput) },
    responses: { 201: jsonRes(bcb.TurnResult), ...aiErrorResponses },
  }),
  async (c) => c.json(await svc.createDraft(c.get('ctx'), c.req.valid('json')), 201),
);

challengeBuilderRoutes.openapi(
  createRoute({ method: 'get', path: '/bcb/drafts', tags, security: secured, summary: 'Черновики своей организации', responses: { 200: jsonRes(z.array(bcb.DraftSummary)), ...errorResponses } }),
  async (c) => c.json(await svc.listDrafts(c.get('ctx')), 200),
);

challengeBuilderRoutes.openapi(
  createRoute({ method: 'get', path: '/bcb/drafts/{id}', tags, security: secured, summary: 'Черновик: диалог, поля, готовность, карточка', request: { params: IdParam }, responses: { 200: jsonRes(bcb.Draft), ...errorResponses } }),
  async (c) => c.json(await svc.getDraft(c.get('ctx'), c.req.valid('param').id), 200),
);

challengeBuilderRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/bcb/drafts/{id}/turns',
    tags,
    security: secured,
    summary: 'Ответ бизнеса на вопросы → новый анализ, готовность и следующие вопросы',
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
    summary: 'Собрать карточку и предложить требования к команде (проверка на персональные данные до вызова модели)',
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
    summary: 'Правки карточки и требований в предпросмотре',
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
    summary: 'Ручное подтверждение и публикация в каталог; баллы готовности — организации',
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
    summary: 'Сравнение до и после диалога: какой ответ поднял какое поле',
    request: { params: IdParam },
    responses: { 200: jsonRes(bcb.DraftDiff), ...errorResponses },
  }),
  async (c) => c.json(await svc.getDiff(c.get('ctx'), c.req.valid('param').id), 200),
);
