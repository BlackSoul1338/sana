import { and, asc, eq, ilike, inArray } from 'drizzle-orm';
import type { z } from 'zod';
import type { AddMemberInput, CreateProfileInput, CreateTeamInput, Me, Profile, Skill, Team, UpdateTeamInput } from '@sana/contracts';
import { inTx, requireProfile, requireRole, type ActorProfile, type Ctx } from '../../platform/context.js';
import type { DbLike } from '../../platform/db/client.js';
import { iso } from '../../platform/db/columns.js';
import { authUsers } from '../../platform/db/auth-users.js';
import { conflict, forbidden, invalid, notFound, unauthorized } from '../../platform/errors.js';
import { orgs, profiles, refRoles, refSkills, teamMembers, teams, teamSkills } from './schema.js';

type ProfileRow = typeof profiles.$inferSelect;

const toProfile = (r: ProfileRow): Profile => ({
  id: r.id,
  displayName: r.displayName,
  role: r.role,
  orgId: r.orgId,
  createdAt: iso(r.createdAt),
});

export async function loadActorProfile(db: DbLike, userId: string): Promise<ActorProfile | null> {
  const [row] = await db.select().from(profiles).where(eq(profiles.id, userId)).limit(1);
  return row ? { id: row.id, role: row.role, orgId: row.orgId, displayName: row.displayName } : null;
}

/** A token stays valid after its account is deleted (e.g. a database reseed); such a session must sign in again. */
async function requireAccount(db: DbLike, userId: string) {
  const [user] = await db.select({ id: authUsers.id }).from(authUsers).where(eq(authUsers.id, userId)).limit(1);
  if (!user) throw unauthorized('Аккаунт не найден — войдите или зарегистрируйтесь снова');
}

export async function getMe(ctx: Ctx): Promise<z.infer<typeof Me>> {
  const [row] = await ctx.db.select().from(profiles).where(eq(profiles.id, ctx.actor.userId)).limit(1);
  if (!row) await requireAccount(ctx.db, ctx.actor.userId);
  const myTeams = row
    ? await ctx.db
        .select({ id: teams.id, name: teams.name, roleSlug: teamMembers.roleSlug })
        .from(teamMembers)
        .innerJoin(teams, eq(teams.id, teamMembers.teamId))
        .where(eq(teamMembers.profileId, row.id))
        .orderBy(asc(teams.name))
    : [];
  return { userId: ctx.actor.userId, email: ctx.actor.email, profile: row ? toProfile(row) : null, teams: myTeams };
}

export async function createProfile(ctx: Ctx, input: z.infer<typeof CreateProfileInput>): Promise<Profile> {
  if (ctx.actor.profile) throw conflict('Профиль уже создан');
  await requireAccount(ctx.db, ctx.actor.userId);
  return inTx(ctx, async (t) => {
    let orgId: string | null = null;
    if (input.role === 'business' && input.orgName) {
      const [org] = await t.db.insert(orgs).values({ name: input.orgName, kind: 'company' }).returning();
      orgId = org!.id;
    }
    const [row] = await t.db
      .insert(profiles)
      .values({ id: ctx.actor.userId, displayName: input.displayName, role: input.role, orgId })
      .returning();
    return toProfile(row!);
  });
}

export async function listSkills(ctx: Ctx): Promise<Skill[]> {
  const rows = await ctx.db.select().from(refSkills).orderBy(asc(refSkills.category), asc(refSkills.title));
  return rows.map((r) => ({ slug: r.slug, title: r.title, category: r.category, difficulty: r.difficulty }));
}

/** Students to invite into a team: name search only, minimal fields. */
export async function searchStudents(ctx: Ctx, q: string): Promise<{ id: string; displayName: string }[]> {
  requireRole(ctx, 'student', 'mentor');
  const pattern = `%${q.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
  return ctx.db
    .select({ id: profiles.id, displayName: profiles.displayName })
    .from(profiles)
    .where(and(eq(profiles.role, 'student'), q ? ilike(profiles.displayName, pattern) : undefined))
    .orderBy(asc(profiles.displayName))
    .limit(20);
}

export async function listRoles(ctx: Ctx) {
  return ctx.db.select().from(refRoles).orderBy(asc(refRoles.title));
}

export async function skillMap(db: DbLike): Promise<Map<string, { title: string; difficulty: number; category: string }>> {
  const rows = await db.select().from(refSkills);
  return new Map(rows.map((r) => [r.slug, { title: r.title, difficulty: r.difficulty, category: r.category }]));
}

async function isMember(db: DbLike, teamId: string, profileId: string) {
  const [m] = await db
    .select({ p: teamMembers.profileId })
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.profileId, profileId)))
    .limit(1);
  return !!m;
}

/**
 * Доступ к изменению команды: участник команды или куратор.
 * Возвращает строку команды; бросает 404/403.
 */
export async function requireTeamAccess(ctx: Ctx, teamId: string) {
  const p = requireProfile(ctx);
  const [team] = await ctx.db.select().from(teams).where(eq(teams.id, teamId)).limit(1);
  if (!team) throw notFound('Команда');
  if (p.role === 'mentor') return team;
  if (p.role === 'student' && (await isMember(ctx.db, teamId, p.id))) return team;
  throw forbidden('Действие доступно участникам команды и куратору');
}

export async function teamIdsOf(db: DbLike, profileId: string): Promise<string[]> {
  const rows = await db.select({ id: teamMembers.teamId }).from(teamMembers).where(eq(teamMembers.profileId, profileId));
  return rows.map((r) => r.id);
}

/**
 * Teams with members and skills in three queries, whatever the number of teams.
 * `ids` undefined means all teams; the result keeps the order of the teams query (by name).
 */
async function loadTeams(db: DbLike, ids?: string[]): Promise<Team[]> {
  if (ids && ids.length === 0) return [];
  const rows = await db
    .select()
    .from(teams)
    .where(ids ? inArray(teams.id, ids) : undefined)
    .orderBy(asc(teams.name));
  if (rows.length === 0) return [];
  const teamIds = rows.map((t) => t.id);
  const [members, skills] = await Promise.all([
    db
      .select({
        teamId: teamMembers.teamId,
        profileId: teamMembers.profileId,
        displayName: profiles.displayName,
        roleSlug: teamMembers.roleSlug,
        joinedAt: teamMembers.joinedAt,
      })
      .from(teamMembers)
      .innerJoin(profiles, eq(profiles.id, teamMembers.profileId))
      .where(inArray(teamMembers.teamId, teamIds))
      .orderBy(asc(teamMembers.joinedAt)),
    db.select().from(teamSkills).where(inArray(teamSkills.teamId, teamIds)).orderBy(asc(teamSkills.skillSlug)),
  ]);
  return rows.map((team) => ({
    id: team.id,
    name: team.name,
    weeklyHours: team.weeklyHours,
    interests: team.interests,
    members: members
      .filter((m) => m.teamId === team.id)
      .map(({ teamId: _teamId, ...m }) => ({ ...m, joinedAt: iso(m.joinedAt) })),
    skills: skills.filter((s) => s.teamId === team.id).map((s) => ({ slug: s.skillSlug, level: s.level })),
    createdAt: iso(team.createdAt),
  }));
}

export async function getTeam(ctx: Ctx, teamId: string): Promise<Team> {
  requireProfile(ctx);
  const [team] = await loadTeams(ctx.db, [teamId]);
  if (!team) throw notFound('Команда');
  return team;
}

export async function listTeams(ctx: Ctx, opts: { mine: boolean }): Promise<Team[]> {
  const p = requireProfile(ctx);
  return loadTeams(ctx.db, opts.mine ? await teamIdsOf(ctx.db, p.id) : undefined);
}

export async function createTeam(ctx: Ctx, input: z.infer<typeof CreateTeamInput>): Promise<Team> {
  const p = requireRole(ctx, 'student', 'mentor');
  const teamId = await inTx(ctx, async (t) => {
    const [team] = await t.db
      .insert(teams)
      .values({ name: input.name, weeklyHours: input.weeklyHours, interests: normalizeInterests(input.interests), createdBy: p.id })
      .returning();
    if (p.role === 'student') await t.db.insert(teamMembers).values({ teamId: team!.id, profileId: p.id });
    return team!.id;
  });
  return getTeam(ctx, teamId);
}

export async function updateTeam(ctx: Ctx, teamId: string, input: z.infer<typeof UpdateTeamInput>): Promise<Team> {
  await requireTeamAccess(ctx, teamId);
  const patch: Partial<typeof teams.$inferInsert> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.weeklyHours !== undefined) patch.weeklyHours = input.weeklyHours;
  if (input.interests !== undefined) patch.interests = normalizeInterests(input.interests);
  if (Object.keys(patch).length) await ctx.db.update(teams).set(patch).where(eq(teams.id, teamId));
  return getTeam(ctx, teamId);
}

async function assertRole(db: DbLike, roleSlug: string | null) {
  if (!roleSlug) return;
  const [r] = await db.select().from(refRoles).where(eq(refRoles.slug, roleSlug)).limit(1);
  if (!r) throw invalid(`Роль «${roleSlug}» отсутствует в справочнике`, [{ path: 'roleSlug', message: 'Неизвестная роль' }]);
}

export async function addMember(ctx: Ctx, teamId: string, input: z.infer<typeof AddMemberInput>): Promise<Team> {
  await requireTeamAccess(ctx, teamId);
  const [target] = await ctx.db.select().from(profiles).where(eq(profiles.id, input.profileId)).limit(1);
  if (!target) throw notFound('Профиль');
  if (target.role !== 'student') throw invalid('В команду добавляются только студенты');
  await assertRole(ctx.db, input.roleSlug);
  if (await isMember(ctx.db, teamId, input.profileId)) throw conflict('Участник уже в команде');
  await ctx.db.insert(teamMembers).values({ teamId, profileId: input.profileId, roleSlug: input.roleSlug });
  return getTeam(ctx, teamId);
}

export async function assignRole(ctx: Ctx, teamId: string, profileId: string, roleSlug: string | null): Promise<Team> {
  await requireTeamAccess(ctx, teamId);
  await assertRole(ctx.db, roleSlug);
  const updated = await ctx.db
    .update(teamMembers)
    .set({ roleSlug })
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.profileId, profileId)))
    .returning();
  if (!updated.length) throw notFound('Участник команды');
  return getTeam(ctx, teamId);
}

export async function setTeamSkills(ctx: Ctx, teamId: string, skills: { slug: string; level: number }[]): Promise<Team> {
  await requireTeamAccess(ctx, teamId);
  const known = await skillMap(ctx.db);
  const unknown = skills.filter((s) => !known.has(s.slug));
  if (unknown.length) {
    throw invalid('Неизвестные навыки', unknown.map((s) => ({ path: `skills.${s.slug}`, message: 'Нет в справочнике' })));
  }
  const unique = new Map(skills.map((s) => [s.slug, s.level]));
  await inTx(ctx, async (t) => {
    await t.db.delete(teamSkills).where(eq(teamSkills.teamId, teamId));
    if (unique.size) {
      await t.db.insert(teamSkills).values([...unique].map(([skillSlug, level]) => ({ teamId, skillSlug, level })));
    }
  });
  return getTeam(ctx, teamId);
}

/**
 * Профиль команды для подбора задач. Только навыки, время и интересы —
 * чувствительные признаки участников сюда физически не попадают.
 */
export type TeamMatchProfile = {
  teamId: string;
  skills: { slug: string; level: number }[];
  weeklyHours: number;
  interests: string[];
};

export async function getTeamMatchProfile(db: DbLike, teamId: string): Promise<TeamMatchProfile> {
  const [team] = await db
    .select({ id: teams.id, weeklyHours: teams.weeklyHours, interests: teams.interests })
    .from(teams)
    .where(eq(teams.id, teamId))
    .limit(1);
  if (!team) throw notFound('Команда');
  const skills = await db.select({ slug: teamSkills.skillSlug, level: teamSkills.level }).from(teamSkills).where(eq(teamSkills.teamId, teamId));
  return { teamId: team.id, skills, weeklyHours: team.weeklyHours, interests: team.interests };
}

export async function teamNames(db: DbLike, ids: string[]): Promise<Map<string, string>> {
  if (!ids.length) return new Map();
  const rows = await db.select({ id: teams.id, name: teams.name }).from(teams).where(inArray(teams.id, ids));
  return new Map(rows.map((r) => [r.id, r.name]));
}

export async function teamMemberIds(db: DbLike, teamId: string): Promise<string[]> {
  const rows = await db.select({ id: teamMembers.profileId }).from(teamMembers).where(eq(teamMembers.teamId, teamId));
  return rows.map((r) => r.id);
}

export async function isTeamMember(db: DbLike, teamId: string, profileId: string) {
  return isMember(db, teamId, profileId);
}

const normalizeInterests = (list: string[]) => [...new Set(list.map((s) => s.trim().toLowerCase()).filter(Boolean))];
