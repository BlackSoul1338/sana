import { check, index, integer, pgEnum, pgTable, primaryKey, smallint, text, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { authUsers } from '../../platform/db/auth-users.js';
import { createdAt, id, ts } from '../../platform/db/columns.js';

export const roleEnum = pgEnum('role', ['student', 'mentor', 'business']);
export const orgKindEnum = pgEnum('org_kind', ['company', 'group']);

export const orgs = pgTable('orgs', {
  id: id(),
  name: text('name').notNull(),
  kind: orgKindEnum('kind').notNull(),
  createdAt: createdAt(),
}).enableRLS();

export const profiles = pgTable(
  'profiles',
  {
    id: uuid('id')
      .primaryKey()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    displayName: text('display_name').notNull(),
    role: roleEnum('role').notNull(),
    orgId: uuid('org_id').references(() => orgs.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [index('profiles_org_idx').on(t.orgId)],
).enableRLS();

/** Общий справочник навыков и технологий: им пользуются Sprint (сложность технологии) и Match (подбор). */
export const refSkills = pgTable(
  'ref_skills',
  {
    slug: text('slug').primaryKey(),
    title: text('title').notNull(),
    category: text('category').notNull(),
    difficulty: smallint('difficulty').notNull(),
  },
  (t) => [check('ref_skills_difficulty_chk', sql`${t.difficulty} between 1 and 3`)],
).enableRLS();

/** Роли участников в команде (капитан, разработчик, исследователь...). */
export const refRoles = pgTable('ref_roles', {
  slug: text('slug').primaryKey(),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
}).enableRLS();

export const teams = pgTable('teams', {
  id: id(),
  name: text('name').notNull(),
  orgId: uuid('org_id').references(() => orgs.id, { onDelete: 'set null' }),
  weeklyHours: integer('weekly_hours').notNull().default(10),
  interests: text('interests').array().notNull().default(sql`'{}'::text[]`),
  createdBy: uuid('created_by').references(() => profiles.id, { onDelete: 'set null' }),
  createdAt: createdAt(),
}).enableRLS();

export const teamMembers = pgTable(
  'team_members',
  {
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    profileId: uuid('profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    roleSlug: text('role_slug').references(() => refRoles.slug),
    joinedAt: ts('joined_at').notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.teamId, t.profileId] }), index('team_members_profile_idx').on(t.profileId)],
).enableRLS();

export const teamSkills = pgTable(
  'team_skills',
  {
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    skillSlug: text('skill_slug')
      .notNull()
      .references(() => refSkills.slug),
    level: smallint('level').notNull(),
  },
  (t) => [primaryKey({ columns: [t.teamId, t.skillSlug] }), check('team_skills_level_chk', sql`${t.level} between 1 and 3`)],
).enableRLS();
