import type { Ctx } from './context.js';

/** Строка подтверждения в том виде, в каком её видят обработчики. */
export type EvidenceSnapshot = {
  id: string;
  module: string;
  subjectType: string;
  subjectId: string;
  teamId: string | null;
  submittedBy: string;
  kind: 'link' | 'screenshot' | 'interview' | 'report';
  url: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'adjusted';
  createdAt: Date;
};

export type DomainEvents = {
  /** Куратор принял решение по подтверждению. Обработчики модулей начисляют баллы в той же транзакции. */
  'evidence.reviewed': {
    evidence: EvidenceSnapshot;
    decision: 'approve' | 'reject' | 'adjust';
    comment: string;
    reviewerId: string;
  };
  /** Задача закреплена за командой. */
  'assignment.created': { assignmentId: string; taskId: string; teamId: string };
};

type Handler<K extends keyof DomainEvents> = (ctx: Ctx, payload: DomainEvents[K]) => Promise<void>;

/**
 * Внутрипроцессная шина доменных событий. Обработчики выполняются последовательно
 * в транзакции отправителя: если обработчик падает, откатывается всё действие.
 */
export class EventBus {
  private handlers: { [K in keyof DomainEvents]?: Handler<K>[] } = {};

  on<K extends keyof DomainEvents>(name: K, handler: Handler<K>): void {
    const list = (this.handlers[name] ??= []) as Handler<K>[];
    list.push(handler);
  }

  async emit<K extends keyof DomainEvents>(ctx: Ctx, name: K, payload: DomainEvents[K]): Promise<void> {
    const list = (this.handlers[name] ?? []) as Handler<K>[];
    for (const h of list) await h(ctx, payload);
  }
}
