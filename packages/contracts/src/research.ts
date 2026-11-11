import { z } from 'zod';
import { Id, Page, Timestamp } from './common.js';

export const RUBRIC_KEYS = ['argumentation', 'completeness', 'understanding', 'originality'] as const;
export const RubricKey = z.enum(RUBRIC_KEYS).meta({ id: 'ResearchRubricKey' });
export const Level = z.enum(['strong', 'adequate', 'weak']);
export const ResearchRole = z.enum(['coordinator', 'researcher', 'critic', 'editor']);
export const ItemKind = z.enum(['argument', 'source', 'question']).meta({ id: 'ResearchItemKind' });
export const Stance = z.enum(['for', 'against']);
export const WorkspaceStatus = z.enum(['active', 'submitted', 'approved']).meta({ id: 'ResearchWorkspaceStatus' });

export const RubricItem = z
  .object({ key: RubricKey, title: z.string(), description: z.string(), maxPoints: z.number().int().min(1).max(50) })
  .meta({ id: 'ResearchRubricItem' });
export type RubricItem = z.infer<typeof RubricItem>;

export const Task = z
  .object({ id: Id, title: z.string(), question: z.string(), context: z.string(), rubric: z.array(RubricItem), createdAt: Timestamp })
  .meta({ id: 'ResearchTask' });

export const NewTask = z
  .object({
    title: z.string().trim().min(3).max(160),
    question: z.string().trim().min(10).max(600),
    context: z.string().trim().max(4000).default(''),
    rubric: z
      .array(RubricItem.pick({ key: true, maxPoints: true }).extend({ description: z.string().trim().max(400).default('') }))
      .length(4)
      .refine((r) => new Set(r.map((x) => x.key)).size === 4, 'Каждый критерий рубрики — один раз'),
  })
  .meta({ id: 'ResearchNewTask' });

export const StartInput = z
  .object({ teamId: Id, initialPosition: z.string().trim().min(10).max(2000) })
  .meta({ id: 'ResearchStartInput' });

export const WorkspacesQuery = z.object({ taskId: Id.optional(), teamId: Id.optional() });

export const WorkspaceSummary = z
  .object({
    id: Id,
    taskId: Id,
    taskTitle: z.string(),
    teamId: Id,
    teamName: z.string(),
    status: WorkspaceStatus,
    items: z.number().int(),
    points: z.number().int(),
    createdAt: Timestamp,
  })
  .meta({ id: 'ResearchWorkspaceSummary' });

export const Thread = z.object({ id: Id, title: z.string(), createdBy: Id, createdAt: Timestamp }).meta({ id: 'ResearchThread' });

export const Item = z
  .object({
    id: Id,
    kind: ItemKind,
    text: z.string(),
    url: z.string().nullable(),
    threadId: Id.nullable(),
    stance: Stance.nullable(),
    linkIds: z.array(Id),
    createdBy: Id,
    createdAt: Timestamp,
  })
  .meta({ id: 'ResearchItem' });
export type Item = z.infer<typeof Item>;

export const NewItem = z
  .object({
    kind: ItemKind,
    text: z.string().trim().min(3).max(1000),
    url: z.url().optional(),
    threadId: Id.optional(),
    stance: Stance.optional(),
    linkIds: z.array(Id).max(10).default([]),
  })
  .refine((v) => v.kind !== 'source' || !!v.url, { path: ['url'], message: 'У источника нужна ссылка' })
  .meta({ id: 'ResearchNewItem' });

export const Message = z
  .object({ id: Id, threadId: Id, authorId: Id, text: z.string(), createdAt: Timestamp })
  .meta({ id: 'ResearchMessage' });
export const MessagePage = Page(Message).meta({ id: 'ResearchMessagePage' });
export const MessagesQuery = z.object({ cursor: z.string().optional() });
export const NewMessage = z.object({ text: z.string().trim().min(1).max(2000) }).meta({ id: 'ResearchNewMessage' });
export const NewThread = z.object({ title: z.string().trim().min(3).max(200) }).meta({ id: 'ResearchNewThread' });

export const RolesInput = z
  .object({ roles: z.array(z.object({ profileId: Id, role: ResearchRole })).max(10) })
  .meta({ id: 'ResearchRolesInput' });

/** Built by code from threads and items; the model only adds text. */
export const ArgumentMap = z
  .object({
    threads: z.array(
      z.object({
        threadId: Id,
        for: z.array(Id),
        against: z.array(Id),
        unsupported: z.array(Id).meta({ description: 'Аргументы без связанного источника' }),
      }),
    ),
    noCounterArguments: z.array(Id).meta({ description: 'Ветки без аргументов «против»' }),
  })
  .meta({ id: 'ResearchArgumentMap' });
export type ArgumentMap = z.infer<typeof ArgumentMap>;

export const Summary = z
  .object({
    text: z.string(),
    threads: z.array(z.object({ threadId: Id, summary: z.string(), keyItemIds: z.array(Id), missingArguments: z.array(z.string()) })),
    missingQuestions: z.array(z.string()),
    createdAt: Timestamp,
  })
  .meta({ id: 'ResearchSummary' });
export type Summary = z.infer<typeof Summary>;

export const Statement = z.object({ text: z.string().trim().min(5).max(1000), itemIds: z.array(Id).max(10) }).meta({ id: 'ResearchStatement' });

export const ConclusionInput = z
  .object({ finalPosition: z.string().trim().min(10).max(2000), statements: z.array(Statement).min(1).max(12) })
  .meta({ id: 'ResearchConclusionInput' });

export const Assessment = z
  .object({
    rubric: z.array(z.object({ key: RubricKey, level: Level.nullable(), explanation: z.string(), itemIds: z.array(Id) })),
    growth: z.object({ initialQuote: z.string(), finalQuote: z.string(), explanation: z.string() }).nullable(),
    recommendations: z.array(z.string()),
  })
  .meta({ id: 'ResearchAssessment' });
export type Assessment = z.infer<typeof Assessment>;

export const Growth = z
  .object({ citedSources: z.number().int(), citedArguments: z.number().int(), counterArgumentsAddressed: z.number().int(), statements: z.number().int() })
  .meta({ id: 'ResearchGrowth' });

export const Conclusion = z
  .object({
    id: Id,
    version: z.number().int(),
    finalPosition: z.string(),
    statements: z.array(Statement),
    assessment: Assessment.nullable(),
    growth: Growth,
    evidenceId: Id.nullable(),
    createdAt: Timestamp,
  })
  .meta({ id: 'ResearchConclusion' });
export type Conclusion = z.infer<typeof Conclusion>;

export const Contribution = z
  .object({
    profileId: Id,
    name: z.string(),
    role: ResearchRole.nullable(),
    sourcesAdded: z.number().int(),
    argumentsAdded: z.number().int(),
    questionsAdded: z.number().int(),
    citedInConclusion: z.number().int(),
  })
  .meta({ id: 'ResearchContribution' });
export type Contribution = z.infer<typeof Contribution>;

export const Workspace = z
  .object({
    id: Id,
    task: Task,
    teamId: Id,
    teamName: z.string(),
    status: WorkspaceStatus,
    initialPosition: z.string(),
    threads: z.array(Thread),
    items: z.array(Item),
    summary: Summary.nullable(),
    argumentMap: ArgumentMap,
    contribution: z.array(Contribution).meta({ description: 'Вклад по действиям; сообщения не учитываются' }),
    conclusion: Conclusion.nullable(),
    points: z.number().int(),
    createdAt: Timestamp,
  })
  .meta({ id: 'ResearchWorkspace' });
