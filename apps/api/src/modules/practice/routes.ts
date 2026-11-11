import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { practice } from '@sana/contracts';
import { createRouter, errorResponses, IdParam, jsonBody, jsonRes, secured } from '../../platform/http.js';
import * as svc from './service.js';

const tags = ['Practice Lab'];
export const practiceRoutes = createRouter();

practiceRoutes.openapi(
  createRoute({ method: 'get', path: '/practice/modules', tags, security: secured, summary: 'Учебные модули; для студента — результат теста', responses: { 200: jsonRes(z.array(practice.Module)), ...errorResponses } }),
  async (c) => c.json(await svc.listModules(c.get('ctx')), 200),
);

practiceRoutes.openapi(
  createRoute({ method: 'get', path: '/practice/modules/{id}/quiz', tags, security: secured, summary: 'Вопросы теста без ключа; последний результат студента', request: { params: IdParam }, responses: { 200: jsonRes(practice.Quiz), ...errorResponses } }),
  async (c) => c.json(await svc.getQuiz(c.get('ctx'), c.req.valid('param').id), 200),
);

practiceRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/practice/modules/{id}/quiz',
    tags,
    security: secured,
    summary: 'Сдать тест: разбор по вопросам; баллы только за первую попытку',
    request: { params: IdParam, body: jsonBody(practice.QuizInput) },
    responses: { 200: jsonRes(practice.QuizResult), ...errorResponses },
  }),
  async (c) => c.json(await svc.submitQuiz(c.get('ctx'), c.req.valid('param').id, c.req.valid('json')), 200),
);

practiceRoutes.openapi(
  createRoute({ method: 'get', path: '/practice/assignments', tags, security: secured, summary: 'Практические задания модуля', request: { query: practice.AssignmentsQuery }, responses: { 200: jsonRes(z.array(practice.Assignment)), ...errorResponses } }),
  async (c) => c.json(await svc.listAssignments(c.get('ctx'), c.req.valid('query')), 200),
);

practiceRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/practice/assignments',
    tags,
    security: secured,
    summary: 'Новое задание с критериями (преподаватель)',
    request: { body: jsonBody(practice.NewAssignment) },
    responses: { 201: jsonRes(practice.Assignment), ...errorResponses },
  }),
  async (c) => c.json(await svc.createAssignment(c.get('ctx'), c.req.valid('json')), 201),
);

practiceRoutes.openapi(
  createRoute({ method: 'get', path: '/practice/assignments/{id}/attempts', tags, security: secured, summary: 'Мои попытки по заданию', request: { params: IdParam }, responses: { 200: jsonRes(z.array(practice.Attempt)), ...errorResponses } }),
  async (c) => c.json(await svc.listAttempts(c.get('ctx'), c.req.valid('param').id), 200),
);

practiceRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/practice/assignments/{id}/attempts',
    tags,
    security: secured,
    summary: 'Новая попытка: проверка моделью по критериям задания (без оценки)',
    request: { params: IdParam, body: jsonBody(practice.AttemptInput) },
    responses: { 201: jsonRes(practice.Attempt), ...errorResponses },
  }),
  async (c) => c.json(await svc.createAttempt(c.get('ctx'), c.req.valid('param').id, c.req.valid('json')), 201),
);

practiceRoutes.openapi(
  createRoute({ method: 'post', path: '/practice/attempts/{id}/send', tags, security: secured, summary: 'Отправить последнюю попытку преподавателю', request: { params: IdParam }, responses: { 200: jsonRes(practice.Attempt), ...errorResponses } }),
  async (c) => c.json(await svc.sendAttempt(c.get('ctx'), c.req.valid('param').id), 200),
);

practiceRoutes.openapi(
  createRoute({ method: 'get', path: '/practice/attempts/{id}', tags, security: secured, summary: 'Попытка с заданием и проверкой (владелец или преподаватель)', request: { params: IdParam }, responses: { 200: jsonRes(practice.AttemptDetail), ...errorResponses } }),
  async (c) => c.json(await svc.getAttempt(c.get('ctx'), c.req.valid('param').id), 200),
);

practiceRoutes.openapi(
  createRoute({ method: 'get', path: '/practice/dashboard', tags, security: secured, summary: 'Панель преподавателя: студенты × задания, проблемные темы', request: { query: practice.DashboardQuery }, responses: { 200: jsonRes(practice.Dashboard), ...errorResponses } }),
  async (c) => c.json(await svc.dashboard(c.get('ctx'), c.req.valid('query').moduleId), 200),
);

practiceRoutes.openapi(
  createRoute({ method: 'get', path: '/practice/recommendation', tags, security: secured, summary: 'Следующее задание по найденным пробелам', responses: { 200: jsonRes(practice.Recommendation), ...errorResponses } }),
  async (c) => c.json(await svc.recommendation(c.get('ctx')), 200),
);
