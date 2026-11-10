# AI Sana — платформа практических заданий (бэкенд)

API-first модульный монолит на TypeScript: ядро платформы и три модуля из `docs/5case_og.md`.

| Модуль | Кейс | Что делает |
| --- | --- | --- |
| Ядро | — | профили и роли (студент, куратор, бизнес), команды и навыки, каталог задач, подтверждения, журнал баллов, рейтинги |
| Startup Sprint | 1 | проект команды, 5 этапов от идеи до тестирования, задачи с технологиями, баллы за подтверждённый прогресс, достижения, следующий шаг |
| Business Challenge Builder | 2 | диалог с бизнесом: проверка полноты, уточняющие вопросы, готовность, карточка задачи, ручная публикация, сравнение до/после |
| Challenge Match | 3 | рекомендации задач команде с объяснением, отклик, решение бизнеса → проект в трекере, отзыв бизнеса и коэффициент реальной задачи |

Фронтенда пока нет: контракт — OpenAPI (`/docs`, `packages/contracts/openapi.json`) и Zod-схемы в `@sana/contracts`.

## Стек

Node 24+, pnpm workspaces, Hono + `@hono/zod-openapi` (OpenAPI 3.1, Scalar), Zod 4, Drizzle ORM + postgres.js, Supabase (Postgres, Auth, Storage) локально на podman/docker, AI SDK 7 + Gemini (`@ai-sdk/google`), Vitest.

## Запуск

```bash
pnpm install
```

```bash
systemctl --user enable --now podman.socket
```

```bash
pnpm db:start
```

Скопируйте `.env.example` в `.env` и заполните ключи из `pnpm db:status` и ключ Gemini. Затем:

```bash
pnpm db:migrate
```

```bash
pnpm seed
```

```bash
pnpm dev
```

API: http://localhost:8787, документация: http://localhost:8787/docs. Аккаунты и пароль после seed — в `data/demo-accounts.json` (файл в `.gitignore`).

Токен для запросов выдаёт Supabase Auth (`POST /auth/v1/token?grant_type=password`), API принимает его в `Authorization: Bearer …`. После регистрации пользователь создаёт профиль: `POST /api/me/profile` (роль куратора самостоятельно не выдаётся).

## Проверки

| Команда | Что проверяет |
| --- | --- |
| `pnpm typecheck` | типы во всех пакетах |
| `pnpm lint` | ESLint, включая границы модулей (модули не импортируют друг друга) |
| `pnpm test` | unit-тесты правил и интеграционные HTTP-тесты на отдельной базе `sana_test` (нужен запущенный `pnpm db:start`) |
| `pnpm --filter @sana/api eval:bcb` | живой прогон Gemini на 15 описаниях: сильные описания получают готовность выше слабых |
| `pnpm --filter @sana/api demo:match [Команда]` | рекомендации и план роста для команды на данных seed |
| `pnpm --filter @sana/api ai:smoke [модели…]` | доступ к Gemini и структурный ответ |
| `pnpm --filter @sana/api openapi` | экспорт `packages/contracts/openapi.json` |

## Устройство

```
packages/contracts/   Zod-схемы API (общие с будущим фронтендом) + openapi.json
apps/api/src/
  platform/           env, БД, auth (проверка JWT), ошибки RFC 9457, события, AI-провайдер, storage
  core/               identity, catalog, evidence, points — общее ядро
  modules/            sprint, challenge-builder, match — не импортируют друг друга
  flows/              межмодульные сценарии (принятие заявки → задача → проект Sprint)
  app.ts              корень композиции
apps/api/drizzle/     миграции (RLS включён, права Data API сняты — данные только через API)
data/                 синтетические данные: навыки, роли, шаблоны, 30 задач, 20 команд, 15 описаний
```

Главные правила:

- Баллы считает код, а не модель. Модель классифицирует и формулирует; начисления — чистые функции, журнал только дополняется, ключ идемпотентности не даёт начислить дважды.
- Баллы — только за подтверждённые куратором действия. Скорость даёт бонус лишь к баллам подтверждённого этапа.
- Конструктор не придумывает сведения за компанию: цитата модели должна найтись в репликах бизнеса, иначе поле — «не указано». Персональные данные (email, телефон, ИИН с контрольной цифрой, карта по Луну) блокируют публикацию.
- Подбор использует только навыки, время и интересы команды; рекомендация — не назначение, сотрудничество подтверждают обе стороны.

Шкалы баллов и веса полей — стартовые: `apps/api/src/modules/sprint/points.config.ts`, `apps/api/src/modules/challenge-builder/readiness.ts`, `apps/api/src/modules/match/scoring.ts`.
