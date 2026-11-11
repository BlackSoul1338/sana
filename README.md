# AI Sana — платформа практических заданий

AI Sana связывает студенческие команды, кураторов и бизнес вокруг практических задач: команда ведёт проект по этапам и получает баллы только за подтверждённый прогресс, бизнес с помощью модели превращает описание проблемы в карточку задачи, а подбор объясняет, какой команде какая задача подходит.

Репозиторий — pnpm-монорепозиторий: API-first модульный монолит на TypeScript и русскоязычный веб-клиент.

| Модуль | Что делает |
| --- | --- |
| Ядро | профили и роли (студент, куратор, бизнес), команды и навыки, каталог задач, подтверждения, журнал баллов, рейтинги |
| Startup Sprint | проект команды, 5 этапов от идеи до тестирования, задачи с технологиями, баллы за подтверждённый прогресс, достижения, следующий шаг |
| Business Challenge Builder | диалог с бизнесом: проверка полноты, уточняющие вопросы, готовность, карточка задачи, ручная публикация, сравнение до/после |
| Challenge Match | рекомендации задач команде с объяснением, отклик, решение бизнеса → проект в трекере, отзыв бизнеса и коэффициент реальной задачи |

## Пакеты

- `apps/api` (`@sana/api`) — HTTP API на Hono с OpenAPI 3.1: документация на `/docs`, все маршруты под `/api`. Хранит данные в Postgres (Drizzle ORM), проверяет JWT Supabase Auth, файлы подтверждений кладёт в Supabase Storage, модель вызывает через AI SDK и Gemini.
- `apps/web` (`@sana/web`) — SPA на Vite, React 19, TanStack Router и Query, Tailwind CSS 4 и shadcn/ui; структура по Feature-Sliced Design.
- `packages/contracts` (`@sana/contracts`) — Zod-схемы запросов и ответов и выгруженный `openapi.json`. Пакет публикуется как исходники TypeScript, без сборки.

Связи: API валидирует запросы схемами из `@sana/contracts` и выгружает из них `openapi.json`; веб генерирует из этого файла типы клиента `openapi-fetch` и использует те же схемы в формах. Supabase в браузере нужен только для входа и загрузки файла по подписанной ссылке — все данные идут через API.

## Веб-клиент

Домашний экран зависит от роли.

- **Студент** — команда (участники, роли, навыки), проекты спринта, проект: карта этапов, следующий шаг, задачи, подтверждения с загрузкой файлов, лента баллов, рейтинг; задачи бизнеса с рекомендациями и отклик; заявки.
- **Куратор** — очередь проверки (принять / с поправкой / на доработку), проекты: сроки этапов и поправка баллов.
- **Бизнес** — конструктор задачи: диалог с живой карточкой, сборка и правка карточки, публикация, «до и после»; мои задачи: отклики, решение по заявке, прогресс команды, отзыв на результат.

Вход — почта и пароль Supabase Auth. После регистрации пользователь выбирает роль: студент или бизнес; роль куратора самостоятельно не выдаётся.

## Требования

- Node.js 24 или новее.
- pnpm 12.17.0 (зафиксирован в `packageManager`, удобно через `corepack enable`).
- Podman с пользовательским сокетом: скрипты `db:*` запускают Supabase CLI (ставится как dev-зависимость) с `DOCKER_HOST=unix://$XDG_RUNTIME_DIR/podman/podman.sock`. Для Docker вызывайте `pnpm exec supabase start` / `stop` / `status` напрямую.
- Для конструктора задачи — ключ Gemini API. Без него API запускается, конструктор отвечает ошибкой `ai_unavailable`, а подсказка следующего шага формулируется по шаблону.

## Локальный запуск

```bash
pnpm install
```

```bash
systemctl --user enable --now podman.socket
```

```bash
pnpm db:start
```

Скопируйте `.env.example` в `.env` в корне и подставьте `PUBLISHABLE_KEY` и `SECRET_KEY` из вывода `pnpm db:status` (см. [Настройка](#настройка)).

```bash
cp .env.example .env
```

Примените миграции и заполните базу синтетическими данными. `pnpm seed` удаляет все данные и по умолчанию работает только с локальным хостом (`127.0.0.1` или `localhost`); для другого хоста нужен флаг `--force`.

```bash
pnpm db:migrate
```

```bash
pnpm seed
```

Запустите API и веб в отдельных терминалах:

```bash
pnpm dev
```

```bash
pnpm dev:web
```

- API: http://localhost:8787, документация: http://localhost:8787/docs.
- Веб: http://localhost:5173. API разрешает CORS для адресов из `CORS_ORIGINS` (по умолчанию `http://localhost:5173` и `http://localhost:3000`).
- Демо-аккаунты после seed: `alice@sana.local` (студент), `mentor@sana.local` (куратор), `daily@sana.local` (бизнес). Пароль seed записывает в `data/demo-accounts.json` — файл в `.gitignore`.

Остановка: Ctrl+C в терминалах dev-процессов, затем

```bash
pnpm db:stop
```

Docker Compose в проекте нет: в контейнерах работает только Supabase, приложение запускается напрямую на Node.

## Настройка

API и веб читают один файл `.env` в корне репозитория: API — через `--env-file-if-exists` в скриптах `@sana/api`, Vite — через `envDir`, причём в браузер попадают только переменные `VITE_*`. Значения по умолчанию в `.env.example` рассчитаны на локальный Supabase.

| Переменная | Обязательна | По умолчанию | Назначение |
| --- | --- | --- | --- |
| `DATABASE_URL` | да | — | строка подключения Postgres; локально `postgresql://postgres:postgres@127.0.0.1:54322/postgres` |
| `SUPABASE_URL` | да | — | адрес Supabase; локально `http://127.0.0.1:54321` |
| `SUPABASE_PUBLISHABLE_KEY` | да | — | публичный ключ Supabase |
| `SUPABASE_SECRET_KEY` | да | — | секретный ключ Supabase для API и seed; никогда не передавайте его в веб |
| `AI_PROVIDER` | нет | `mock` | `google` — вызывать Gemini; `mock` — модель отключена |
| `GOOGLE_API_KEY` | для `google` | — | ключ Gemini API |
| `AI_MODEL_FAST` | для `google` | — | модель для быстрых вызовов: ход диалога конструктора, требования к задаче, текст следующего шага |
| `AI_MODEL_STRONG` | нет | значение `AI_MODEL_FAST` | модель для сборки карточки |
| `AI_THINKING_FAST`, `AI_THINKING_STRONG` | нет | не задаётся | уровень размышлений `minimal`, `low`, `medium` или `high`; только для моделей, которые его поддерживают |
| `PORT` | нет | `8787` | порт API |
| `EVIDENCE_BUCKET` | нет | `evidence` | бакет Storage для файлов подтверждений |
| `CORS_ORIGINS` | нет | `http://localhost:5173,http://localhost:3000` | адреса веб-клиента через запятую, которым API разрешает запросы |
| `VITE_API_URL` | да, для веба | — | адрес API, например `http://localhost:8787` |
| `VITE_SUPABASE_URL` | да, для веба | — | адрес Supabase; в `.env.example` — `$SUPABASE_URL` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | да, для веба | — | публичный ключ Supabase; в `.env.example` — `$SUPABASE_PUBLISHABLE_KEY` |

API при старте проверяет переменные и завершается со списком ошибок, если обязательные не заданы.

## Развёртывание

### Веб на Vercel

`apps/web` собирается в статические файлы (`dist`). В `apps/web/vercel.json` все пути переписываются на `index.html`, чтобы прямые ссылки на экраны открывались. На Vercel укажите корневую папку `apps/web` и задайте `VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` — Vite подставляет их при сборке, поэтому после изменения нужна новая сборка. Адрес развёрнутого веба добавьте в `CORS_ORIGINS` API.

### API на Cloudflare Workers

Точка входа — `apps/api/src/worker.ts`, настройки — `apps/api/cloudflare.config.ts` (формат CLI `cf`, пока в бете). Postgres подключается через Hyperdrive; на каждый запрос открывается своё соединение. Бакет `evidence` Worker не создаёт: он должен уже существовать (его создают `pnpm dev` и `pnpm seed`). Миграции применяются отдельно: `pnpm db:migrate` с `DATABASE_URL` облачной базы.

1. Войдите (`cf auth login`) и один раз зарегистрируйте поддомен `workers.dev` в панели Cloudflare (Workers → Onboarding).
2. Создайте Hyperdrive для базы Supabase (параметры — в Supabase → Connect, например session pooler на порту 5432) и запомните его id:

   ```bash
   cf hyperdrive create --name sana-db --origin-scheme postgresql --origin-host <host> --origin-port 5432 --origin-database postgres --origin-user <user> --origin-password <password>
   ```

   Отключите кэш запросов Hyperdrive, иначе после записи чтение может вернуть устаревшие данные:

   ```bash
   cf hyperdrive update <id> --caching-disabled
   ```

3. Положите секреты в `apps/api/.dev.vars.production` (файл в `.gitignore`): `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `GOOGLE_API_KEY`.
4. Разверните из `apps/api`. Обычные настройки (`AI_*`, `EVIDENCE_BUCKET`, `CORS_ORIGINS`) берутся из окружения оболочки при развёртывании; незаданные получают значения по умолчанию из таблицы выше.

   ```bash
   HYPERDRIVE_ID=<id> AI_PROVIDER=google AI_MODEL_FAST=<model> CORS_ORIGINS=https://<web-domain> pnpm deploy:worker --secrets-file .dev.vars.production
   ```

Локально Worker запускается командой `pnpm --filter @sana/api dev:worker` на http://localhost:8787 (не одновременно с `pnpm dev`) и подключается к локальному Postgres. Секреты для него — в `apps/api/.dev.vars` в формате `.env`.

На бесплатном плане Workers даёт 10 мс процессорного времени на запрос (ожидание базы и модели не считается) и 100 000 запросов в день; Hyperdrive — 100 000 запросов к базе в день.

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
- `pnpm test` — unit-тесты правил, интеграционные HTTP-тесты API и unit-тесты веба. HTTP-тесты пересоздают отдельную базу `sana_test` в локальном Postgres, поэтому нужен запущенный `pnpm db:start`; другой адрес задаётся через `TEST_DATABASE_URL`. Только тесты без базы: `pnpm --filter @sana/api test:unit`.
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
- `pnpm --filter @sana/api demo:match [Команда]` — рекомендации и план роста для команды на данных seed (модель не нужна).

## Устройство кода

```
packages/contracts/   Zod-схемы API (общие с вебом) и openapi.json
apps/api/src/
  platform/           env, БД, auth (проверка JWT), ошибки RFC 9457, события, AI-провайдер, storage
  core/               identity, catalog, evidence, points — общее ядро
  modules/            sprint, challenge-builder, match — не импортируют друг друга
  flows/              межмодульные сценарии (принятие заявки → задача → проект Sprint)
apps/api/drizzle/     SQL-миграции
apps/web/src/         app → pages → widgets → features → entities → shared (FSD)
data/                 синтетические данные для seed: навыки, роли, шаблоны, задачи, команды, описания
```

Ошибки API приходят в формате `application/problem+json` (RFC 9457); веб показывает ошибки полей прямо в формах.

## Правила предметной области

- Баллы считает код, а не модель. Модель классифицирует и формулирует; начисления — чистые функции, журнал только дополняется, ключ идемпотентности не даёт начислить дважды.
- Баллы — только за подтверждённые куратором действия. Скорость даёт бонус лишь к баллам подтверждённого этапа.
- Конструктор не придумывает сведения за компанию: цитата модели должна найтись в репликах бизнеса, иначе поле — «не указано». Персональные данные (email, телефон, ИИН с контрольной цифрой, карта по Луну) блокируют публикацию.
- Подбор использует только навыки, время и интересы команды; рекомендация — не назначение, сотрудничество подтверждают обе стороны.

Шкалы баллов и веса полей — стартовые и задаются в коде: `apps/api/src/modules/sprint/points.config.ts`, `apps/api/src/modules/challenge-builder/readiness.ts`, `apps/api/src/modules/match/scoring.ts`.
