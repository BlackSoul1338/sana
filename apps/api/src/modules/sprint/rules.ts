import type { Award } from '../../core/points/ledger.js';
import { SPRINT_POINTS, STAGE_TITLES } from './points.config.js';
import { MODULE, type StageKey } from './types.js';

export type Tech = { slug: string; title: string; difficulty: number };

/** Факты о подтверждённом действии. Собирает их обработчик, правила только считают. */
export type ApprovalFacts = {
  evidence: {
    id: string;
    kind: 'link' | 'screenshot' | 'interview' | 'report';
    url: string | null;
    submittedAt: Date;
    submittedBy: string;
  };
  project: { id: string; teamId: string };
  /** Подтверждение закрывает этап. */
  stage?: { key: StageKey; plannedAt: string };
  /** Подтверждение закрывает задачу. */
  task?: { id: string; title: string; assigneeId: string | null; skill: Tech | null };
  /** Сколько интервью проекта уже засчитано до этого подтверждения. */
  interviewsCounted: number;
  /** Технологии подтверждённых задач проекта (для этапа «прототип»). */
  techUsed: Tech[];
  /** Этап «прототип» уже подтверждён (для технологий задач, закрытых позже). */
  prototypeApproved: boolean;
};

const team = (f: ApprovalFacts) => ({ subjectType: 'team' as const, subjectId: f.project.teamId, module: MODULE, evidenceId: f.evidence.id });

/** Подтверждено в срок: дата отправки не позже плановой даты этапа (весь день включительно). */
export function submittedOnTime(submittedAt: Date, plannedAt: string): boolean {
  const deadline = new Date(`${plannedAt}T23:59:59.999Z`);
  return submittedAt.getTime() <= deadline.getTime();
}

/** Бонус за скорость — доля от баллов уже подтверждённого этапа, не больше cap. Без этапа — ноль. */
export function speedBonus(stagePoints: number, submittedAt: Date, plannedAt: string): number {
  if (stagePoints <= 0 || !submittedOnTime(submittedAt, plannedAt)) return 0;
  return Math.min(SPRINT_POINTS.speed.cap, Math.round(stagePoints * SPRINT_POINTS.speed.share));
}

export const techPoints = (t: Tech) => SPRINT_POINTS.techPerDifficulty * t.difficulty;

/**
 * Все начисления за одно подтверждение. Чистая функция: одинаковые факты — одинаковые баллы.
 * Ключи идемпотентности привязаны к объекту, поэтому повторный вызов ничего не удвоит.
 */
export function awardsForApproval(f: ApprovalFacts): Award[] {
  const out: Award[] = [];

  if (f.stage) {
    const pts = SPRINT_POINTS.stage[f.stage.key];
    const title = STAGE_TITLES[f.stage.key];
    out.push({
      ...team(f),
      ruleId: 'stage_completed',
      points: pts,
      explanation: `Этап «${title}» подтверждён куратором: +${pts}`,
      idempotencyKey: `sprint:stage:${f.project.id}:${f.stage.key}`,
    });
    const bonus = speedBonus(pts, f.evidence.submittedAt, f.stage.plannedAt);
    if (bonus > 0) {
      out.push({
        ...team(f),
        ruleId: 'speed_bonus',
        points: bonus,
        explanation: `Этап «${title}» сдан не позже плана (${f.stage.plannedAt}) и подтверждён: +${bonus} (10% от баллов этапа, максимум ${SPRINT_POINTS.speed.cap})`,
        idempotencyKey: `sprint:speed:${f.project.id}:${f.stage.key}`,
      });
    }
    if (f.stage.key === 'prototype' && f.evidence.kind === 'link' && f.evidence.url) {
      out.push({
        ...team(f),
        ruleId: 'working_prototype',
        points: SPRINT_POINTS.workingPrototype,
        explanation: `Ссылка на работающий прототип подтверждена: +${SPRINT_POINTS.workingPrototype}`,
        idempotencyKey: `sprint:prototype:${f.project.id}`,
      });
    }
    if (f.stage.key === 'prototype') {
      for (const t of dedupeTech(f.techUsed)) out.push(techAward(f, t));
    }
  }

  if (f.evidence.kind === 'interview' && f.interviewsCounted < SPRINT_POINTS.interview.cap) {
    const n = f.interviewsCounted + 1;
    out.push({
      ...team(f),
      ruleId: 'interview',
      points: SPRINT_POINTS.interview.each,
      explanation: `Интервью с клиентом подтверждено (${n} из ${SPRINT_POINTS.interview.cap}): +${SPRINT_POINTS.interview.each}`,
      idempotencyKey: `sprint:interview:${f.evidence.id}`,
    });
  }

  if (f.task) {
    const difficulty = f.task.skill?.difficulty ?? 1;
    const pts = SPRINT_POINTS.taskPerDifficulty * difficulty;
    const who = f.task.assigneeId ?? f.evidence.submittedBy;
    out.push({
      subjectType: 'profile',
      subjectId: who,
      module: MODULE,
      evidenceId: f.evidence.id,
      ruleId: 'task_done',
      points: pts,
      explanation: `Задача «${f.task.title}» подтверждена${f.task.skill ? ` (${f.task.skill.title}, сложность ${difficulty})` : ''}: +${pts} исполнителю`,
      idempotencyKey: `sprint:task:${f.task.id}`,
    });
    // Технология, применённая после подтверждения прототипа, тоже засчитывается команде — один раз на проект.
    if (f.prototypeApproved && f.task.skill) out.push(techAward(f, f.task.skill));
  }

  return out;
}

function techAward(f: ApprovalFacts, t: Tech): Award {
  const pts = techPoints(t);
  return {
    ...team(f),
    ruleId: 'tech_complexity',
    points: pts,
    explanation: `Технология «${t.title}» (сложность ${t.difficulty}) применена в подтверждённом прототипе: +${pts}`,
    idempotencyKey: `sprint:tech:${f.project.id}:${t.slug}`,
  };
}

const dedupeTech = (list: Tech[]) => [...new Map(list.map((t) => [t.slug, t])).values()];
