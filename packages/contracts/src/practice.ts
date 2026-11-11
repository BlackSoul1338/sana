import { z } from 'zod';
import { Difficulty, Id, Timestamp } from './common.js';

// Enums used with .nullable() stay inline: a component id would make the shared component itself nullable in OpenAPI.
export const Verdict = z.enum(['met', 'partial', 'missed']);
export type Verdict = z.infer<typeof Verdict>;

export const AttemptStatus = z.enum(['checked', 'sent', 'approved', 'rejected']);

/** Model checks per assignment; a teacher's return always leaves one more attempt. */
export const MAX_ATTEMPTS = 5;

export const Module = z
  .object({
    id: Id,
    slug: z.string(),
    title: z.string(),
    description: z.string(),
    topics: z.array(z.string()),
    /** For the viewing student: whether the module test is passed and with what score. */
    quiz: z.object({ correct: z.number().int(), total: z.number().int() }).nullable(),
  })
  .meta({ id: 'PracticeModule' });
export type Module = z.infer<typeof Module>;

export const Question = z
  .object({ id: Id, topic: z.string(), text: z.string(), options: z.array(z.string()) })
  .meta({ id: 'PracticeQuestion' });

export const QuizResult = z
  .object({
    correct: z.number().int(),
    total: z.number().int(),
    points: z.number().int().meta({ description: 'Начислено за этот тест (только за первую попытку)' }),
    perQuestion: z.array(z.object({ questionId: Id, option: z.number().int().nullable(), correct: z.number().int(), ok: z.boolean(), explanation: z.string() })),
  })
  .meta({ id: 'PracticeQuizResult' });

export const Quiz = z
  .object({
    moduleId: Id,
    questions: z.array(Question),
    /** The student's last result, with the answer key revealed only after a submission. */
    result: QuizResult.nullable(),
  })
  .meta({ id: 'PracticeQuiz' });

export const QuizInput = z
  .object({ answers: z.array(z.object({ questionId: Id, option: z.number().int().min(0) })).min(1) })
  .meta({ id: 'PracticeQuizInput' });

export const Criterion = z
  .object({ id: z.string(), title: z.string(), description: z.string(), topic: z.string(), maxPoints: z.number().int().min(1).max(50) })
  .meta({ id: 'PracticeCriterion' });
export type Criterion = z.infer<typeof Criterion>;

export const Assignment = z
  .object({
    id: Id,
    moduleId: Id,
    title: z.string(),
    condition: z.string(),
    materials: z.string(),
    difficulty: Difficulty,
    criteria: z.array(Criterion),
    createdAt: Timestamp,
    /** For the viewing student: latest attempt status, null if not started. */
    myStatus: AttemptStatus.nullable(),
  })
  .meta({ id: 'PracticeAssignment' });

export const NewAssignment = z
  .object({
    moduleId: Id,
    title: z.string().trim().min(3).max(160),
    condition: z.string().trim().min(20).max(4000),
    materials: z.string().trim().max(4000).default(''),
    difficulty: Difficulty,
    criteria: z
      .array(z.object({ title: z.string().trim().min(3).max(120), description: z.string().trim().min(5).max(600), topic: z.string(), maxPoints: z.number().int().min(1).max(50) }))
      .min(1)
      .max(8),
  })
  .meta({ id: 'PracticeNewAssignment' });

export const AssignmentsQuery = z.object({ moduleId: Id.optional() });

/** Model output after verification: verdict null means the model skipped the criterion. */
export const CheckedCriterion = z
  .object({
    criterionId: z.string(),
    verdict: Verdict.nullable(),
    explanation: z.string(),
    errors: z.array(z.object({ quote: z.string(), issue: z.string() })),
    recommendation: z.string(),
  })
  .meta({ id: 'PracticeCheckedCriterion' });

export const Check = z
  .object({ criteria: z.array(CheckedCriterion), droppedQuotes: z.number().int() })
  .meta({ id: 'PracticeCheck' });
export type Check = z.infer<typeof Check>;

export const Attempt = z
  .object({
    id: Id,
    assignmentId: Id,
    profileId: Id,
    attemptNo: z.number().int(),
    answer: z.string(),
    check: Check.nullable().meta({ description: 'null — модель была недоступна, работу проверит преподаватель' }),
    status: AttemptStatus,
    evidenceId: Id.nullable(),
    /** Preliminary points by the rules; the teacher confirms them. */
    preview: z.object({ correctness: z.number().int(), completeness: z.number().int(), selfCorrection: z.number().int(), completion: z.number().int() }),
    /** Criteria fixed compared with earlier attempts. */
    corrected: z.array(z.string()),
    createdAt: Timestamp,
  })
  .meta({ id: 'PracticeAttempt' });
export type Attempt = z.infer<typeof Attempt>;

export const AttemptInput = z.object({ answer: z.string().trim().min(20).max(8000) }).meta({ id: 'PracticeAttemptInput' });

export const AttemptDetail = Attempt.extend({ assignment: Assignment, studentName: z.string() }).meta({ id: 'PracticeAttemptDetail' });

export const DashboardQuery = z.object({ moduleId: Id });

export const Dashboard = z
  .object({
    assignments: z.array(z.object({ id: Id, title: z.string(), students: z.number().int(), approved: z.number().int(), avgAttempts: z.number() })),
    students: z.array(
      z.object({
        profileId: Id,
        name: z.string(),
        quiz: z.object({ correct: z.number().int(), total: z.number().int() }).nullable(),
        points: z.number().int(),
        cells: z.array(
          z.object({
            assignmentId: Id,
            attempts: z.number().int(),
            status: AttemptStatus,
            evidenceId: Id.nullable(),
            minutesToSend: z.number().int().nullable().meta({ description: 'Только как дополнительный показатель, баллов не даёт' }),
          }),
        ),
      }),
    ),
    problemTopics: z.array(z.object({ topic: z.string(), quizWrong: z.number().int(), criteriaMissed: z.number().int(), share: z.number() })),
  })
  .meta({ id: 'PracticeDashboard' });
export type Dashboard = z.infer<typeof Dashboard>;

export const Recommendation = z
  .object({ assignmentId: Id, title: z.string(), topic: z.string().nullable(), reason: z.string() })
  .nullable()
  .meta({ id: 'PracticeRecommendation' });
