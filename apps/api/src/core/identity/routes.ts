import { createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import {
  AddMemberInput,
  AssignRoleInput,
  CreateProfileInput,
  CreateTeamInput,
  Me,
  Profile,
  SetTeamSkillsInput,
  Skill,
  StudentSearchItem,
  StudentSearchQuery,
  Team,
  TeamRole,
  UpdateTeamInput,
} from '@sana/contracts';
import { createRouter, errorResponses, IdParam, jsonBody, jsonRes, secured } from '../../platform/http.js';
import * as svc from './service.js';

const tags = ['Профиль и команды'];
export const identityRoutes = createRouter();

identityRoutes.openapi(
  createRoute({ method: 'get', path: '/me', tags, security: secured, summary: 'Текущий пользователь, профиль и команды', responses: { 200: jsonRes(Me), ...errorResponses } }),
  async (c) => c.json(await svc.getMe(c.get('ctx')), 200),
);

identityRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/me/profile',
    tags,
    security: secured,
    summary: 'Создать профиль после регистрации в Supabase Auth (студент или бизнес)',
    request: { body: jsonBody(CreateProfileInput) },
    responses: { 201: jsonRes(Profile, 'Профиль создан'), ...errorResponses },
  }),
  async (c) => c.json(await svc.createProfile(c.get('ctx'), c.req.valid('json')), 201),
);

identityRoutes.openapi(
  createRoute({ method: 'get', path: '/skills', tags: ['Справочники'], security: secured, summary: 'Справочник навыков и технологий', responses: { 200: jsonRes(z.array(Skill)), ...errorResponses } }),
  async (c) => c.json(await svc.listSkills(c.get('ctx')), 200),
);

identityRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/students',
    tags,
    security: secured,
    summary: 'Поиск студентов по имени (для приглашения в команду)',
    request: { query: StudentSearchQuery },
    responses: { 200: jsonRes(z.array(StudentSearchItem)), ...errorResponses },
  }),
  async (c) => c.json(await svc.searchStudents(c.get('ctx'), c.req.valid('query').q), 200),
);

identityRoutes.openapi(
  createRoute({ method: 'get', path: '/roles', tags: ['Справочники'], security: secured, summary: 'Справочник ролей в команде', responses: { 200: jsonRes(z.array(TeamRole)), ...errorResponses } }),
  async (c) => c.json(await svc.listRoles(c.get('ctx')), 200),
);

identityRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/teams',
    tags,
    security: secured,
    summary: 'Список команд (mine=true — только мои)',
    request: { query: z.object({ mine: z.enum(['true', 'false']).optional() }) },
    responses: { 200: jsonRes(z.array(Team)), ...errorResponses },
  }),
  async (c) => c.json(await svc.listTeams(c.get('ctx'), { mine: c.req.valid('query').mine === 'true' }), 200),
);

identityRoutes.openapi(
  createRoute({ method: 'post', path: '/teams', tags, security: secured, summary: 'Создать команду', request: { body: jsonBody(CreateTeamInput) }, responses: { 201: jsonRes(Team), ...errorResponses } }),
  async (c) => c.json(await svc.createTeam(c.get('ctx'), c.req.valid('json')), 201),
);

identityRoutes.openapi(
  createRoute({ method: 'get', path: '/teams/{id}', tags, security: secured, summary: 'Команда: участники, роли, навыки', request: { params: IdParam }, responses: { 200: jsonRes(Team), ...errorResponses } }),
  async (c) => c.json(await svc.getTeam(c.get('ctx'), c.req.valid('param').id), 200),
);

identityRoutes.openapi(
  createRoute({ method: 'patch', path: '/teams/{id}', tags, security: secured, summary: 'Изменить команду (часы в неделю, интересы)', request: { params: IdParam, body: jsonBody(UpdateTeamInput) }, responses: { 200: jsonRes(Team), ...errorResponses } }),
  async (c) => c.json(await svc.updateTeam(c.get('ctx'), c.req.valid('param').id, c.req.valid('json')), 200),
);

identityRoutes.openapi(
  createRoute({ method: 'post', path: '/teams/{id}/members', tags, security: secured, summary: 'Добавить участника', request: { params: IdParam, body: jsonBody(AddMemberInput) }, responses: { 200: jsonRes(Team), ...errorResponses } }),
  async (c) => c.json(await svc.addMember(c.get('ctx'), c.req.valid('param').id, c.req.valid('json')), 200),
);

identityRoutes.openapi(
  createRoute({
    method: 'patch',
    path: '/teams/{id}/members/{profileId}',
    tags,
    security: secured,
    summary: 'Назначить роль участнику',
    request: { params: z.object({ id: z.uuid(), profileId: z.uuid() }), body: jsonBody(AssignRoleInput) },
    responses: { 200: jsonRes(Team), ...errorResponses },
  }),
  async (c) => {
    const { id, profileId } = c.req.valid('param');
    return c.json(await svc.assignRole(c.get('ctx'), id, profileId, c.req.valid('json').roleSlug), 200);
  },
);

identityRoutes.openapi(
  createRoute({ method: 'put', path: '/teams/{id}/skills', tags, security: secured, summary: 'Задать навыки команды (уровень 1–3)', request: { params: IdParam, body: jsonBody(SetTeamSkillsInput) }, responses: { 200: jsonRes(Team), ...errorResponses } }),
  async (c) => c.json(await svc.setTeamSkills(c.get('ctx'), c.req.valid('param').id, c.req.valid('json').skills), 200),
);
