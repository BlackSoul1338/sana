// Russian labels for API enums. Server-side titles are not exposed in responses, so they live here.

export const STAGE_TITLES = {
  idea: 'Идея',
  problem: 'Проверка проблемы',
  interviews: 'Интервью с клиентами',
  prototype: 'Прототип',
  testing: 'Тестирование',
} as const;
export type StageKey = keyof typeof STAGE_TITLES;
export const STAGE_ORDER = Object.keys(STAGE_TITLES) as StageKey[];

export const STAGE_STATUS = {
  open: 'Открыт',
  submitted: 'На проверке',
  approved: 'Подтверждён',
  rejected: 'Нужна доработка',
} as const;

export const TASK_STATUS = {
  todo: 'К работе',
  in_progress: 'В работе',
  submitted: 'На проверке',
  done: 'Готово',
} as const;

export const EVIDENCE_KIND = {
  link: 'Ссылка',
  screenshot: 'Скриншот',
  interview: 'Интервью',
  report: 'Отчёт',
} as const;

export const EVIDENCE_STATUS = {
  pending: 'На проверке',
  approved: 'Принято',
  rejected: 'Отклонено',
  adjusted: 'Принято с поправкой',
} as const;

/** FeedItem.title for points is the raw ruleId. */
export const RULE_TITLES: Record<string, string> = {
  stage_completed: 'Этап подтверждён',
  speed_bonus: 'Бонус за скорость',
  working_prototype: 'Работающий прототип',
  interview: 'Интервью с клиентом',
  tech_complexity: 'Сложность технологии',
  task_done: 'Задача выполнена',
  mentor_adjustment: 'Поправка ментора',
  challenge_readiness: 'Готовность задачи',
  real_task_bonus: 'Бонус за реальную задачу',
};

export const MODULE_TITLES: Record<string, string> = {
  sprint: 'Стартап-спринт',
  challenge_builder: 'Конструктор задач',
  match: 'Задачи бизнеса',
};

export const DIFFICULTY = { 1: 'Базовая', 2: 'Средняя', 3: 'Сложная' } as const;

export const CARD_FIELDS = {
  title: { label: 'Название', weight: 5 },
  context: { label: 'Контекст', weight: 15 },
  goal: { label: 'Цель', weight: 15 },
  users: { label: 'Пользователи', weight: 15 },
  data: { label: 'Доступные данные', weight: 20 },
  constraints: { label: 'Ограничения', weight: 10 },
  criteria: { label: 'Критерии результата', weight: 20 },
} as const;
export type CardFieldKey = keyof typeof CARD_FIELDS;
export const CARD_FIELD_ORDER = Object.keys(CARD_FIELDS) as CardFieldKey[];
export const READY_THRESHOLD = 80;

export const APPLICATION_STATUS = {
  pending: 'На рассмотрении',
  accepted: 'Принята',
  declined: 'Отклонена',
  withdrawn: 'Отозвана',
} as const;

export const EVIDENCE_SUBJECT: Record<string, string> = {
  sprint_stage: 'Закрытие этапа',
  sprint_task: 'Задача',
  sprint_interview: 'Интервью',
};
