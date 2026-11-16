import { z } from 'zod';
import { Id, Timestamp, looseEnum } from './common.js';
import { CardFieldKey, TaskCard, TaskRequirements } from './catalog.js';

export const FIELD_KEYS = CardFieldKey.options;
export const FieldStatus = z.enum(['ok', 'weak', 'missing']);
export type FieldStatus = z.infer<typeof FieldStatus>;

// ---------- model answer schemas: every field required, no union and no optional ----------

const AiFieldAssessment = z.object({
  status: looseEnum(['ok', 'weak', 'missing'], "ok — concrete and complete; weak — present but without specifics; missing — not in the business's messages"),
  value: z.string().describe("A short phrasing of the field in the business's words, or 'not specified'"),
  quote: z.string().describe("The verbatim quote from the business's messages the assessment is based on, or an empty string"),
});

export const AiAnalysis = z.object({
  title: AiFieldAssessment,
  context: AiFieldAssessment,
  goal: AiFieldAssessment,
  users: AiFieldAssessment,
  data: AiFieldAssessment,
  constraints: AiFieldAssessment,
  criteria: AiFieldAssessment,
  questions: z
    .array(
      z.object({
        field: looseEnum(['title', 'context', 'goal', 'users', 'data', 'constraints', 'criteria']),
        text: z.string().describe('One specific follow-up question for the business'),
      }),
    )
    .describe('One question per field with status weak or missing'),
});
export type AiAnalysis = z.infer<typeof AiAnalysis>;

const AiCardField = z.object({
  text: z.string().describe('The card field text, only from the business\'s facts; when they are missing — "not specified"'),
  source: looseEnum(['dialog', 'not_specified']),
});

export const AiCard = z.object({
  title: AiCardField,
  context: AiCardField,
  goal: AiCardField,
  users: AiCardField,
  data: AiCardField,
  constraints: AiCardField,
  criteria: AiCardField,
  summary: z.string().describe('One or two sentences for the catalog'),
  commercialSecretWarnings: z
    .array(z.string())
    .describe('Fragments resembling a trade secret or closed data; an empty list when there are none'),
});
export type AiCard = z.infer<typeof AiCard>;

// ---------- API ----------

export const FieldState = z
  .object({
    key: CardFieldKey,
    status: FieldStatus,
    value: z.string(),
    quote: z.string(),
    weight: z.number().int(),
    earned: z.number(),
    quoteVerified: z.boolean().meta({ description: 'The quote was found in the business\'s messages' }),
  })
  .meta({ id: 'FieldState' });
export type FieldState = z.infer<typeof FieldState>;

export const Question = z.object({ field: CardFieldKey, text: z.string() }).meta({ id: 'BcbQuestion' });
export type Question = z.infer<typeof Question>;

export const FieldChange = z
  .object({ field: CardFieldKey, from: FieldStatus, to: FieldStatus, delta: z.number() })
  .meta({ id: 'FieldChange' });

export const TurnResult = z
  .object({
    draftId: Id,
    turn: z.number().int(),
    readiness: z.number().int().min(0).max(100),
    readyToCompose: z.boolean(),
    fields: z.array(FieldState),
    questions: z.array(Question),
    changes: z.array(FieldChange).meta({ description: 'What changed relative to the previous turn' }),
    turnsLeft: z.number().int(),
  })
  .meta({ id: 'TurnResult' });
export type TurnResult = z.infer<typeof TurnResult>;

export const DraftStatus = z.enum(['collecting', 'composed', 'published']);

export const DraftMessage = z
  .object({ role: z.enum(['user', 'assistant']), text: z.string(), at: Timestamp })
  .meta({ id: 'DraftMessage' });

export const Draft = z
  .object({
    id: Id,
    orgId: Id,
    status: DraftStatus,
    turnCount: z.number().int(),
    readiness: z.number().int(),
    messages: z.array(DraftMessage),
    latest: TurnResult.nullable(),
    card: TaskCard.nullable(),
    summary: z.string().nullable(),
    requirements: TaskRequirements.nullable(),
    taskId: Id.nullable(),
    createdAt: Timestamp,
  })
  .meta({ id: 'Draft' });

export const DraftSummary = z
  .object({ id: Id, status: DraftStatus, readiness: z.number().int(), preview: z.string(), createdAt: Timestamp })
  .meta({ id: 'DraftSummary' });

export const CreateDraftInput = z.object({ text: z.string().trim().min(10).max(6000) }).meta({ id: 'CreateDraftInput' });
export const TurnInput = z.object({ text: z.string().trim().min(1).max(4000) }).meta({ id: 'TurnInput' });

export const SensitiveFinding = z
  .object({
    kind: z.enum(['email', 'phone', 'iin', 'card']),
    excerpt: z.string().meta({ description: 'The masked fragment' }),
    where: z.string().meta({ description: 'A message or a card field' }),
  })
  .meta({ id: 'SensitiveFinding' });
export type SensitiveFinding = z.infer<typeof SensitiveFinding>;

export const ComposeResult = z
  .object({
    card: TaskCard,
    summary: z.string(),
    requirementsSuggestion: TaskRequirements,
    warnings: z.array(z.string()),
  })
  .meta({ id: 'ComposeResult' });

export const UpdateCardInput = z
  .object({
    card: TaskCard.optional(),
    summary: z.string().trim().min(5).max(600).optional(),
    requirements: TaskRequirements.optional(),
  })
  .meta({ id: 'UpdateCardInput' });

export const PublishInput = z
  .object({
    confirm: z.literal(true).meta({ description: 'The business representative\'s explicit confirmation' }),
    requirementsConfirmed: z.literal(true).meta({ description: 'The business representative saw and confirmed the team requirements' }),
  })
  .meta({ id: 'PublishInput' });

export const PublishResult = z
  .object({ taskId: Id, readiness: z.number().int(), points: z.number().int() })
  .meta({ id: 'PublishResult' });

export const DraftDiff = z
  .object({
    before: z.object({ readiness: z.number().int(), fields: z.array(FieldState) }),
    after: z.object({ readiness: z.number().int(), fields: z.array(FieldState) }),
    steps: z.array(
      z.object({
        turn: z.number().int(),
        answer: z.string(),
        readinessDelta: z.number().int(),
        changes: z.array(FieldChange),
      }),
    ),
  })
  .meta({ id: 'DraftDiff' });

export type Draft = z.infer<typeof Draft>;
export type DraftSummary = z.infer<typeof DraftSummary>;
export type ComposeResult = z.infer<typeof ComposeResult>;
export type DraftDiff = z.infer<typeof DraftDiff>;
export type FieldChange = z.infer<typeof FieldChange>;
