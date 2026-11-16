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

const tags = ['Profile and teams'];
export const identityRoutes = createRouter();

identityRoutes.openapi(
  createRoute({ method: 'get', path: '/me', tags, security: secured, summary: 'The current user, their profile and teams', responses: { 200: jsonRes(Me), ...errorResponses } }),
  async (c) => c.json(await svc.getMe(c.get('ctx')), 200),
);

identityRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/me/profile',
    tags,
    security: secured,
    summary: 'Create a profile after Supabase Auth sign-up (student or business)',
    request: { body: jsonBody(CreateProfileInput) },
    responses: { 201: jsonRes(Profile, 'The profile was created'), ...errorResponses },
  }),
  async (c) => c.json(await svc.createProfile(c.get('ctx'), c.req.valid('json')), 201),
);

identityRoutes.openapi(
  createRoute({ method: 'get', path: '/skills', tags: ['Reference'], security: secured, summary: 'The skills and technologies directory', responses: { 200: jsonRes(z.array(Skill)), ...errorResponses } }),
  async (c) => c.json(await svc.listSkills(c.get('ctx')), 200),
);

identityRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/students',
    tags,
    security: secured,
    summary: 'Find students by name (to invite them into a team)',
    request: { query: StudentSearchQuery },
    responses: { 200: jsonRes(z.array(StudentSearchItem)), ...errorResponses },
  }),
  async (c) => c.json(await svc.searchStudents(c.get('ctx'), c.req.valid('query').q), 200),
);

identityRoutes.openapi(
  createRoute({ method: 'get', path: '/roles', tags: ['Reference'], security: secured, summary: 'The teams role directory', responses: { 200: jsonRes(z.array(TeamRole)), ...errorResponses } }),
  async (c) => c.json(await svc.listRoles(c.get('ctx')), 200),
);

identityRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/teams',
    tags,
    security: secured,
    summary: 'List teams (mine=true — only mine)',
    request: { query: z.object({ mine: z.enum(['true', 'false']).optional() }) },
    responses: { 200: jsonRes(z.array(Team)), ...errorResponses },
  }),
  async (c) => c.json(await svc.listTeams(c.get('ctx'), { mine: c.req.valid('query').mine === 'true' }), 200),
);

identityRoutes.openapi(
  createRoute({ method: 'post', path: '/teams', tags, security: secured, summary: 'Create a team', request: { body: jsonBody(CreateTeamInput) }, responses: { 201: jsonRes(Team), ...errorResponses } }),
  async (c) => c.json(await svc.createTeam(c.get('ctx'), c.req.valid('json')), 201),
);

identityRoutes.openapi(
  createRoute({ method: 'get', path: '/teams/{id}', tags, security: secured, summary: 'A team: members, roles, skills', request: { params: IdParam }, responses: { 200: jsonRes(Team), ...errorResponses } }),
  async (c) => c.json(await svc.getTeam(c.get('ctx'), c.req.valid('param').id), 200),
);

identityRoutes.openapi(
  createRoute({ method: 'patch', path: '/teams/{id}', tags, security: secured, summary: 'Update a team (weekly hours, interests)', request: { params: IdParam, body: jsonBody(UpdateTeamInput) }, responses: { 200: jsonRes(Team), ...errorResponses } }),
  async (c) => c.json(await svc.updateTeam(c.get('ctx'), c.req.valid('param').id, c.req.valid('json')), 200),
);

identityRoutes.openapi(
  createRoute({ method: 'post', path: '/teams/{id}/members', tags, security: secured, summary: 'Add a member', request: { params: IdParam, body: jsonBody(AddMemberInput) }, responses: { 200: jsonRes(Team), ...errorResponses } }),
  async (c) => c.json(await svc.addMember(c.get('ctx'), c.req.valid('param').id, c.req.valid('json')), 200),
);

identityRoutes.openapi(
  createRoute({
    method: 'patch',
    path: '/teams/{id}/members/{profileId}',
    tags,
    security: secured,
    summary: 'Assign a role to a member',
    request: { params: z.object({ id: z.uuid(), profileId: z.uuid() }), body: jsonBody(AssignRoleInput) },
    responses: { 200: jsonRes(Team), ...errorResponses },
  }),
  async (c) => {
    const { id, profileId } = c.req.valid('param');
    return c.json(await svc.assignRole(c.get('ctx'), id, profileId, c.req.valid('json').roleSlug), 200);
  },
);

identityRoutes.openapi(
  createRoute({ method: 'put', path: '/teams/{id}/skills', tags, security: secured, summary: 'Set a team skills (level 1–3)', request: { params: IdParam, body: jsonBody(SetTeamSkillsInput) }, responses: { 200: jsonRes(Team), ...errorResponses } }),
  async (c) => c.json(await svc.setTeamSkills(c.get('ctx'), c.req.valid('param').id, c.req.valid('json').skills), 200),
);
