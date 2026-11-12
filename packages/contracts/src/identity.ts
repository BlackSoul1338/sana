import { z } from 'zod';
import { Difficulty, Id, Role, Timestamp } from './common.js';

export const OrgKind = z.enum(['company', 'group']);

export const Org = z.object({ id: Id, name: z.string(), kind: OrgKind }).meta({ id: 'Org' });
export type Org = z.infer<typeof Org>;

export const Profile = z
  .object({
    id: Id,
    displayName: z.string(),
    role: Role,
    orgId: Id.nullable(),
    createdAt: Timestamp,
  })
  .meta({ id: 'Profile' });
export type Profile = z.infer<typeof Profile>;

/** Самостоятельная регистрация: куратор (mentor) назначается только администратором/seed. */
export const SignUpInput = z
  .object({
    email: z.string().trim().toLowerCase().pipe(z.email('Похоже, в адресе опечатка')),
    password: z.string().min(8, 'Минимум 8 символов').max(72),
  })
  .meta({ id: 'SignUpInput' });
export const SignUpResult = z.object({ userId: Id }).meta({ id: 'SignUpResult' });

export const CreateProfileInput = z
  .object({
    displayName: z.string().trim().min(2).max(80),
    role: z.enum(['student', 'business']),
    orgName: z.string().trim().min(2).max(120).optional().meta({ description: 'Для роли business: название компании' }),
  })
  .refine((v) => v.role !== 'business' || !!v.orgName, { path: ['orgName'], message: 'Для бизнеса укажите компанию' })
  .meta({ id: 'CreateProfileInput' });

export const Skill = z
  .object({ slug: z.string(), title: z.string(), category: z.string(), difficulty: Difficulty })
  .meta({ id: 'Skill' });
export type Skill = z.infer<typeof Skill>;

export const TeamRole = z.object({ slug: z.string(), title: z.string(), description: z.string() }).meta({ id: 'TeamRole' });

export const TeamMember = z
  .object({ profileId: Id, displayName: z.string(), roleSlug: z.string().nullable(), joinedAt: Timestamp })
  .meta({ id: 'TeamMember' });

export const TeamSkill = z.object({ slug: z.string(), level: Difficulty }).meta({ id: 'TeamSkill' });

export const Team = z
  .object({
    id: Id,
    name: z.string(),
    weeklyHours: z.number().int(),
    interests: z.array(z.string()),
    members: z.array(TeamMember),
    skills: z.array(TeamSkill),
    createdAt: Timestamp,
  })
  .meta({ id: 'Team' });
export type Team = z.infer<typeof Team>;

export const CreateTeamInput = z
  .object({
    name: z.string().trim().min(2).max(80),
    weeklyHours: z.number().int().min(1).max(80).default(10),
    interests: z.array(z.string().trim().min(1)).max(10).default([]),
  })
  .meta({ id: 'CreateTeamInput' });

export const UpdateTeamInput = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    weeklyHours: z.number().int().min(1).max(80).optional(),
    interests: z.array(z.string().trim().min(1)).max(10).optional(),
  })
  .meta({ id: 'UpdateTeamInput' });

export const AddMemberInput = z.object({ profileId: Id, roleSlug: z.string().nullable().default(null) }).meta({ id: 'AddMemberInput' });
export const AssignRoleInput = z.object({ roleSlug: z.string().nullable() }).meta({ id: 'AssignRoleInput' });
export const SetTeamSkillsInput = z.object({ skills: z.array(TeamSkill).max(25) }).meta({ id: 'SetTeamSkillsInput' });

export const StudentSearchQuery = z.object({ q: z.string().trim().max(80).default('') });
export const StudentSearchItem = z.object({ id: Id, displayName: z.string() }).meta({ id: 'StudentSearchItem' });

export const Me = z
  .object({
    userId: Id,
    email: z.string().nullable(),
    profile: Profile.nullable(),
    teams: z.array(z.object({ id: Id, name: z.string(), roleSlug: z.string().nullable() })),
  })
  .meta({ id: 'Me' });
