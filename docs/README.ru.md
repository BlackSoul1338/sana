# AI Sana — платформа практических заданий

[![English](https://img.shields.io/badge/README-in_English-1f6feb)](../README.md)
[![Демо](https://img.shields.io/badge/демо-sana--alpha--one.vercel.app-ff6b4a?logo=vercel&logoColor=white)](https://sana-alpha-one.vercel.app)
![Node.js](https://img.shields.io/badge/Node.js-%E2%89%A524-5fa04e?logo=nodedotjs&logoColor=white)
![pnpm](https://img.shields.io/badge/pnpm-12-f69220?logo=pnpm&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-6-3178c6?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=black)
![Hono](https://img.shields.io/badge/Hono-4-e36002?logo=hono&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-Postgres%20%7C%20Auth-3ecf8e?logo=supabase&logoColor=white)
![Cloudflare Workers](https://img.shields.io/badge/API-Cloudflare%20Workers-f38020?logo=cloudflareworkers&logoColor=white)

AI Sana связывает студентов, кураторов, преподавателей и бизнес вокруг практических задач: команда ведёт проект по этапам и получает баллы только за подтверждённый прогресс, бизнес с помощью модели превращает описание проблемы в карточку задачи, подбор объясняет, какой команде какая задача подходит; в Practice Lab модель проверяет работу студента по критериям до решения преподавателя, а в Research Arena команда в обсуждении приходит к выводу, который проверяет преподаватель.

Репозиторий — pnpm-монорепозиторий: API-first модульный монолит на TypeScript и русскоязычный веб-клиент.

**Развёртывание** (на английском): [локально](local-deploy.md) · [на сервере (Vercel + Cloudflare Workers + Supabase)](server-deploy.md)

| Модуль | Что делает |
| --- | --- |
| Ядро | профили и роли (студент, куратор, преподаватель, бизнес), команды и навыки, каталог задач, подтверждения, журнал баллов, рейтинги |
| Startup Sprint | проект команды, 5 этапов от идеи до тестирования, задачи с технологиями, баллы за подтверждённый прогресс, достижения, следующий шаг |
| Business Challenge Builder | диалог с бизнесом: проверка полноты, уточняющие вопросы, готовность, карточка задачи, ручная публикация, сравнение до/после |
| Challenge Match | рекомендации задач команде с объяснением, отклик, решение бизнеса → проект в трекере, отзыв бизнеса и коэффициент реальной задачи |
| Practice Lab | модули с тестом, задания с критериями, проверка моделью с цитатами ошибок, до 5 попыток, баллы за самоисправление после принятия преподавателем, дашборд преподавателя с проблемными темами |
| Research Arena | исследовательские вопросы, обсуждение команды с ролями, вывод с аргументами и источниками, проверка преподавателем |

## Пакеты

- `apps/api` (`@sana/api`) — HTTP API на Hono с OpenAPI 3.1: документация на `/docs`, все маршруты под `/api`. Хранит данные в Postgres (Drizzle ORM), проверяет JWT Supabase Auth, файлы подтверждений кладёт в Supabase Storage, модель вызывает через AI SDK и Gemini. Локально работает как Node-сервер, в продакшене — как Cloudflare Worker.
- `apps/web` (`@sana/web`) — SPA на Vite, React 19, TanStack Router и Query, Tailwind CSS 4 и shadcn/ui; структура по Feature-Sliced Design.
- `packages/contracts` (`@sana/contracts`) — Zod-схемы запросов и ответов и выгруженный `openapi.json`. Пакет публикуется как исходники TypeScript, без сборки.

API валидирует запросы схемами из `@sana/contracts` и выгружает из них `openapi.json`; веб генерирует из этого файла типы клиента `openapi-fetch` и использует те же схемы в формах. Supabase в браузере нужен только для входа и загрузки файла по подписанной ссылке — все данные идут через API.

## Веб-клиент

Домашний экран зависит от роли.

- **Студент** — команда (участники, роли, навыки), проекты спринта, проект: карта этапов, следующий шаг, задачи, подтверждения с загрузкой файлов, лента баллов, рейтинг; задачи бизнеса с рекомендациями и отклик; заявки.
- **Куратор** — очередь проверки (принять / с поправкой / на доработку), проекты: сроки этапов и поправка баллов.
- **Преподаватель** — модули практики: задания, результаты студентов, проблемные темы; проверка практических работ и выводов исследований.
- **Бизнес** — конструктор задачи: диалог с живой карточкой, сборка и правка карточки, публикация, «до и после»; мои задачи: отклики, решение по заявке, прогресс команды, отзыв на результат.

Вход — почта и пароль Supabase Auth. Регистрация идёт через API (`POST /auth/sign-up`): аккаунт создаётся сразу подтверждённым, письмо не отправляется. После регистрации пользователь выбирает роль: студент или бизнес; роли куратора и преподавателя самостоятельно не выдаются.

## Быстрый старт

Нужны Node.js 24+, pnpm 12.17.0 и Podman (или Docker) для локального Supabase. Подробно: [local-deploy.md](local-deploy.md).

```bash
pnpm install
```

```bash
pnpm db:start
```

```bash
cp .env.example .env
```

Подставьте `SUPABASE_PUBLISHABLE_KEY` и `SUPABASE_SECRET_KEY` из вывода `pnpm db:status`, затем:

```bash
pnpm db:migrate
```

```bash
pnpm seed
```

```bash
pnpm dev
```

```bash
pnpm dev:web
```

API: http://localhost:8787 (документация — `/docs`). Веб: http://localhost:5173. Демо-аккаунты: `alice@sana.local` (студент), `mentor@sana.local`, `teacher@sana.local`, `daily@sana.local` (бизнес); пароль после seed — в `data/demo-accounts.json` (задайте `SEED_PASSWORD`, чтобы он не менялся между запусками).

## Настройка

API и веб читают один файл `.env` в корне репозитория: API — через `--env-file-if-exists` в скриптах `@sana/api`, Vite — через `envDir`, причём в браузер попадают только переменные `VITE_*`. В `.env.example` — значения для локального Supabase. Cloudflare Worker получает те же настройки через привязки, см. [развёртывание на сервере](server-deploy.md).

| Переменная | Обязательна | По умолчанию | Назначение |
| --- | --- | --- | --- |
| `DATABASE_URL` | да | — | строка подключения Postgres; локально `postgresql://postgres:postgres@127.0.0.1:54322/postgres` |
| `SUPABASE_URL` | да | — | адрес Supabase; локально `http://127.0.0.1:54321` |
| `SUPABASE_PUBLISHABLE_KEY` | да | — | публичный ключ Supabase |
| `SUPABASE_SECRET_KEY` | да | — | секретный ключ Supabase для API и seed; никогда не передавайте его в веб |
| `AI_PROVIDER` | нет | `mock` | `google` — вызывать Gemini; `mock` — модель отключена |
| `GOOGLE_API_KEY` | для `google` | — | ключ Gemini API |
| `AI_MODEL_FAST` | для `google` | — | модель для быстрых вызовов: ход диалога конструктора, требования к задаче, текст следующего шага, проверка практики, сводка и оценка исследования |
| `AI_MODEL_STRONG` | нет | значение `AI_MODEL_FAST` | модель для сборки карточки |
| `AI_THINKING_FAST`, `AI_THINKING_STRONG` | нет | не задаётся | уровень размышлений `minimal`, `low`, `medium` или `high`; только для моделей, которые его поддерживают |
| `PORT` | нет | `8787` | порт API (Node-сервер) |
| `EVIDENCE_BUCKET` | нет | `evidence` | бакет Storage для файлов подтверждений |
| `CORS_ORIGINS` | нет | `http://localhost:5173,http://localhost:3000` | адреса веб-клиента через запятую, которым API разрешает запросы |
| `VITE_API_URL` | да, для веба | — | адрес API, например `http://localhost:8787` |
| `VITE_SUPABASE_URL` | да, для веба | — | адрес Supabase; в `.env.example` — `$SUPABASE_URL` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | да, для веба | — | публичный ключ Supabase; в `.env.example` — `$SUPABASE_PUBLISHABLE_KEY` |

API при старте проверяет переменные и завершается со списком ошибок, если обязательные не заданы.

## Проверки

```bash
pnpm typecheck
```

```bash
pnpm lint
```

```bash
pnpm test
```

```bash
pnpm build
```

- `pnpm lint` — ESLint, включая границы модулей API (модули не импортируют друг друга) и правила React-хуков.
- `pnpm test` — unit-тесты правил, интеграционные HTTP-тесты API и unit-тесты веба. HTTP-тесты пересоздают отдельную базу `sana_test` в локальном Postgres, поэтому нужен запущенный `pnpm db:start`.
- `pnpm --filter @sana/web lint:fsd` — Steiger: слои и публичные API Feature-Sliced Design.

## Изменение API

После изменения маршрутов или схем выгрузите OpenAPI и перегенерируйте типы клиента:

```bash
pnpm --filter @sana/api openapi
```

```bash
pnpm --filter @sana/web gen:api
```

Миграции: после изменения схемы Drizzle — `pnpm db:generate`, затем `pnpm db:migrate`. Миграции включают RLS и снимают права Data API: данные доступны только через API.

Скрипты для модели (нужен `AI_PROVIDER=google` и ключ):

- `pnpm --filter @sana/api ai:smoke [модели…]` — доступ к Gemini и структурный ответ.
- `pnpm --filter @sana/api eval:bcb` — прогон конструктора на 15 описаниях из `data/bcb-descriptions.json`: сильные описания должны получать готовность выше слабых.
- `pnpm --filter @sana/api eval:practice` — проверка Practice Lab на 9 ответах из `data/practice-answers.json`: сильные ответы должны получать больше баллов, чем средние, средние — больше, чем слабые.
- `pnpm --filter @sana/api demo:match [Команда]` — рекомендации и план роста для команды на данных seed (модель не нужна).

## Устройство кода

```
packages/contracts/   Zod-схемы API (общие с вебом) и openapi.json
apps/api/src/
  platform/           env, БД, auth (проверка JWT), ошибки RFC 9457, события, AI-провайдер, storage
  core/               identity, catalog, evidence, points — общее ядро
  modules/            sprint, challenge-builder, match, practice, research — не импортируют друг друга
  flows/              межмодульные сценарии (принятие заявки → задача → проект Sprint)
  index.ts, worker.ts точки входа: Node-сервер и Cloudflare Worker
apps/api/drizzle/     SQL-миграции
apps/web/src/         app → pages → widgets → features → entities → shared (FSD)
data/                 синтетические данные для seed: навыки, роли, шаблоны, задачи, команды, описания, модули практики, исследовательские задачи и обсуждения
docs/                 руководства по развёртыванию и этот README
SKILLS/               навыки агента для репозитория (развёртывание в продакшен)
```

Ошибки API приходят в формате `application/problem+json` (RFC 9457); веб показывает ошибки полей прямо в формах.

## Правила предметной области

- Баллы считает код, а не модель. Модель классифицирует и формулирует; начисления — чистые функции, журнал только дополняется, ключ идемпотентности не даёт начислить дважды.
- Баллы — только за подтверждённые куратором действия. Скорость даёт бонус лишь к баллам подтверждённого этапа.
- Конструктор не придумывает сведения за компанию: цитата модели должна найтись в репликах бизнеса, иначе поле — «не указано». Персональные данные (email, телефон, ИИН с контрольной цифрой, карта по Луну) блокируют публикацию.
- Подбор использует только навыки, время и интересы команды; рекомендация — не назначение, сотрудничество подтверждают обе стороны.

Шкалы баллов и веса полей — стартовые и задаются в коде: `apps/api/src/modules/sprint/points.config.ts`, `apps/api/src/modules/challenge-builder/readiness.ts`, `apps/api/src/modules/match/scoring.ts`.
