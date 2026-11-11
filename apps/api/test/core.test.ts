import { beforeEach, describe, expect, it } from 'vitest';
import { createUser, http, makeApp, resetDb } from './helpers/env.js';

describe('ядро: профиль, команды, права', () => {
  beforeEach(resetDb);
  const app = makeApp();
  const api = http(app);

  it('без токена — 401 в формате problem+json', async () => {
    const res = await api.get('/api/me');
    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ code: 'unauthorized', status: 401 });
  });

  it('health и OpenAPI доступны без токена', async () => {
    expect((await api.get('/health')).status).toBe(200);
    const doc = await api.get('/openapi.json');
    expect(doc.status).toBe(200);
    expect(doc.body.openapi).toBe('3.1.0');
    expect(Object.keys(doc.body.paths)).toContain('/api/teams');
  });

  it('создание профиля: ментора самостоятельно не создать, бизнесу нужна компания', async () => {
    const user = { id: '11111111-1111-4111-8111-111111111111', token: 'test:11111111-1111-4111-8111-111111111111', role: 'student' as const, orgId: null, name: 'x' };
    const { testDb } = await import('./helpers/env.js');
    const { sql } = await import('drizzle-orm');
    await testDb().execute(sql`insert into auth.users (id, email) values (${user.id}, 'x@test.local')`);

    const asMentor = await api.post('/api/me/profile', user, { displayName: 'Хитрый', role: 'mentor' });
    expect(asMentor.status).toBe(422);
    const noOrg = await api.post('/api/me/profile', user, { displayName: 'Бизнес', role: 'business' });
    expect(noOrg.status).toBe(422);
    expect(noOrg.body.errors[0].path).toBe('orgName');
    const ok = await api.post('/api/me/profile', user, { displayName: 'Бизнес', role: 'business', orgName: 'ТОО Ромашка' });
    expect(ok.status).toBe(201);
    expect(ok.body.orgId).toBeTruthy();
    expect((await api.post('/api/me/profile', user, { displayName: 'Ещё', role: 'student' })).status).toBe(409);
  });

  it('команда: создатель — участник, чужой студент не может менять, куратор может', async () => {
    const alice = await createUser('student', 'Алиса');
    const bob = await createUser('student', 'Боб');
    const mentor = await createUser('mentor', 'Куратор');
    const team = await api.post('/api/teams', alice, { name: 'Альфа', weeklyHours: 12, interests: ['EdTech', ' edtech '] });
    expect(team.status).toBe(201);
    expect(team.body.members).toHaveLength(1);
    expect(team.body.interests).toEqual(['edtech']);

    expect((await api.post(`/api/teams/${team.body.id}/members`, bob, { profileId: bob.id })).status).toBe(403);
    const added = await api.post(`/api/teams/${team.body.id}/members`, alice, { profileId: bob.id, roleSlug: 'developer' });
    expect(added.status).toBe(200);
    expect(added.body.members.map((m: any) => m.roleSlug)).toContain('developer');

    const role = await api.patch(`/api/teams/${team.body.id}/members/${bob.id}`, mentor, { roleSlug: 'designer' });
    expect(role.status).toBe(200);
    const badRole = await api.patch(`/api/teams/${team.body.id}/members/${bob.id}`, alice, { roleSlug: 'wizard' });
    expect(badRole.status).toBe(422);

    const skills = await api.put(`/api/teams/${team.body.id}/skills`, bob, { skills: [{ slug: 'react', level: 2 }, { slug: 'python', level: 3 }] });
    expect(skills.status).toBe(200);
    expect(skills.body.skills).toHaveLength(2);
    expect((await api.put(`/api/teams/${team.body.id}/skills`, bob, { skills: [{ slug: 'cobol', level: 2 }] })).status).toBe(422);
  });

  it('куратор корректирует баллы новым событием; студенту нельзя', async () => {
    const alice = await createUser('student');
    const mentor = await createUser('mentor');
    const team = (await api.post('/api/teams', alice, { name: 'Бета' })).body;
    const body = { subjectType: 'team', subjectId: team.id, module: 'sprint', points: 15, comment: 'Бонус за помощь другим командам' };
    expect((await api.post('/api/points/adjustments', alice, body)).status).toBe(403);
    expect((await api.post('/api/points/adjustments', mentor, body)).status).toBe(201);
    expect((await api.post('/api/points/adjustments', mentor, { ...body, points: -5, comment: 'Штраф за просрочку' })).status).toBe(201);
    const board = await api.get('/api/leaderboard?subjectType=team', alice);
    expect(board.body[0]).toMatchObject({ name: 'Бета', total: 10, rank: 1 });
    const events = await api.get(`/api/points?subjectType=team&subjectId=${team.id}`, alice);
    expect(events.body).toHaveLength(2);
    expect(events.body.every((e: any) => e.explanation.startsWith('Корректировка куратора'))).toBe(true);
  });

  it('поиск студентов по имени: только студенты, бизнесу недоступно', async () => {
    const alice = await createUser('student', 'Алиса Смирнова');
    await createUser('student', 'Борис');
    await createUser('mentor', 'Алина Куратор');
    const biz = await createUser('business', 'Компания');

    const found = await api.get(`/api/students?q=${encodeURIComponent('али')}`, alice);
    expect(found.status).toBe(200);
    expect(found.body).toEqual([{ id: alice.id, displayName: 'Алиса Смирнова' }]);
    expect((await api.get('/api/students?q=%25', alice)).body).toEqual([]);
    expect((await api.get('/api/students', biz)).status).toBe(403);
  });

  it('список команд: участники и навыки не смешиваются между командами', async () => {
    const alice = await createUser('student', 'Алиса');
    const bob = await createUser('student', 'Боб');
    const a = (await api.post('/api/teams', alice, { name: 'Альфа' })).body;
    const b = (await api.post('/api/teams', bob, { name: 'Бета' })).body;
    await api.put(`/api/teams/${a.id}/skills`, alice, { skills: [{ slug: 'python', level: 2 }] });
    await api.put(`/api/teams/${b.id}/skills`, bob, { skills: [{ slug: 'react', level: 1 }] });

    const all = await api.get('/api/teams', alice);
    expect(all.status).toBe(200);
    expect(all.body.map((t: any) => t.name)).toEqual(['Альфа', 'Бета']);
    expect(all.body[0]).toMatchObject({ members: [{ profileId: alice.id }], skills: [{ slug: 'python', level: 2 }] });
    expect(all.body[1]).toMatchObject({ members: [{ profileId: bob.id }], skills: [{ slug: 'react', level: 1 }] });
    expect(all.body[0].members).toHaveLength(1);

    const mine = await api.get('/api/teams?mine=true', bob);
    expect(mine.body.map((t: any) => t.id)).toEqual([b.id]);
    expect((await api.get('/api/teams/00000000-0000-4000-8000-000000000000', alice)).status).toBe(404);
  });
});
