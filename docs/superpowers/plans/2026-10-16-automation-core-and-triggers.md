# Automation: ядро и триггеры — план реализации

> **Исполнение:** нативно в этой сессии (superpowers:executing-plans), без коммитов. Ревью делает пользователь в конце.

**Цель:** реализовать контекст Automation по утверждённой модели. Объём:

- **A, ядро:** workflow, черновик, проблемы настройки, выпуски, тестовый и ручной запуск на `@nestjs/workflows`, формулы, ядро узлов, вывод шагов в S3, история, отмена;
- **B, триггеры:** активация, расписания, webhook.

**Архитектура:**

- **Domain:** чистый, восемь классов: Workflow, Release, Graph, Node, Connection, Run, Step, WebhookEndpoint, плюс VO WebhookSecret.
- **Application:** линейные use cases, политика `WorkflowPolicy`, сервис `ConfigurationCheck`, порты.
- **Interface-adapters:**
  - типы узлов: zod-схема параметров — это контракт входа узла;
  - движок формул на acorn;
  - S3-хранилище вывода;
  - engine-workflows;
  - HTTP.
- **Frameworks:** DI-модули, роли процесса `api` и `worker`, фабрика S3.

**Стек:** NestJS 12, `@nestjs/workflows` 0.0.3, `@nestjs/idempotency` 0.0.2, `@nestjs/outbox`, Drizzle и PostgreSQL 18, `@aws-sdk/client-s3` с Garage v2.4.1, acorn, luxon, re2js, cheerio, fast-xml-parser, marked, turndown, zod 4, Vitest и Testcontainers.

**Спецификация:**

- `specs/002-workflow-builder/spec.md` (FR-001…FR-027, без C–F);
- `specs/002-workflow-builder/data-model.md`;
- `docs/architecture/01-domain.md`.

## Global Constraints

- Слои: `domain` и `application` без импортов фреймворков (lint), `@Policy()` — единственное исключение.
- Стиль домена — как в Invitation, User, Account:
  - один класс на файл, `#private` поле на каждое свойство, геттеры;
  - публичный конструктор из props и статическая фабрика;
  - guard-clauses с пустыми строками вокруг;
  - нет `toProps()`, хелпер-фабрик, spread- и flatMap-цепочек;
  - копия агрегата создаётся одним вызовом конструктора с полными props.
- `User` получает геттер `isEditor`, рядом с `isAdmin`.
- Use case — один класс, один `execute`, линейное тело, без try/catch. Правила, которым нужен lookup, живут в use case; правила собственного состояния — в сущности.
- Commands — одна транзакция (`@Transactional()` в контроллере). Шаги движка открывают транзакцию сами (`StepTransaction`).
- Комментариев в коде нет. Awaited-значение присваивается переменной до использования.
- Зависимости пинуются точно, `minimumReleaseAge` 24 часа.
- Лимиты:
  - 200 узлов, 256 КБ параметров на узел, 5 МБ на запрос;
  - образец: 100 элементов и 1 МБ;
  - ручной вход: 1000 элементов и 1 МБ;
  - глубина JSON 64;
  - шаг: 10 000 элементов и 16 МБ; запуск: 256 МБ;
  - таймаут запуска: по умолчанию 1 час, максимум 30 дней;
  - 5 исполняемых запусков на workflow;
  - webhook: тело 1 МБ, доставка помнится 7 дней, сдвиг подписи 5 минут.
- Без коммитов.

## Review Focus

1. **Отмена во время исполнения узла.** Запись результата не должна падать на конфликте версии и не должна исполнять узел повторно. Тест: `RecordNode` после `CancelRun` сохраняет вывод, запуск остаётся `cancelled`.
2. **Узел, ни один вход которого не получил элементов, с `alwaysOutputData`.** Узел исполняется и выдаёт один пустой элемент. Тест в `run.spec` и в исполнителе.
3. **Переименование узла.** Ссылки по id продолжают работать, `$('Старое')` в формулах переписывается. Тест в `save-draft.spec`.
4. **Webhook.** Неверный секрет, неверный метод, неактивный workflow и неизвестный адрес дают одинаковый 404. Тест в компонентных тестах.
5. **Повтор доставки после сбоя между записью запуска и запоминанием доставки.** Возвращается существующий запуск. Тест в `start-webhook-run.spec`.

---

## Задачи

### 1. Зависимости и конфигурация

- `pnpm add`: `@aws-sdk/client-s3@3.1152.0`, `acorn@8.19.0`, `luxon@3.7.2`, `re2js@2.8.6`, `cheerio@1.2.0`, `fast-xml-parser@5.11.2`, `marked@18.1.1`, `turndown@7.2.4`; dev: `@types/luxon@3.7.6`, `@types/turndown@5.0.6`.
- Переменные окружения в `frameworks/di/config.module.ts`:
  - процесс: `ROLE` (`api|worker`), `WORKER_CONCURRENCY`, `RUN_CONCURRENCY_PER_WORKFLOW`;
  - хранилище: `STORAGE_ENDPOINT`, `STORAGE_REGION`, `STORAGE_BUCKET`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY`;
  - секреты и адреса: `SECRET_KEYS` (`id:base64,...`), `SECRET_KEY_CURRENT`, `PUBLIC_BASE_URL`.
- Обновить `.env.example`, `test/support/setup-env.ts`.

### 2. Домен: граф

- **Files:** `domain/enums.ts`, `domain/errors.ts`, `domain/interfaces.ts`, `domain/node.ts`, `domain/connection.ts`, `domain/graph.ts`; тест `test/unit/domain/graph.spec.ts`, `node.spec.ts`.
- **Graph(props):**
  - строит Node и Connection;
  - собирает нарушения формы `GraphFault` (`duplicate-node-id`, `unknown-connection-node`, `duplicate-node-name`, `cycle`) и бросает `InvalidGraphError(faults)`.
- **Graph, поведение:**
  - `node(id)` (иначе `NodeNotFoundError`), `has(id)`, `triggers`, `triggersOf(type)`, `credentialIds`;
  - `orderFrom(trigger)`: Кан по достижимому подграфу, при равенстве — по позиции `x`, затем `y`, затем id;
  - `incoming(node)`, `upstreamOf(node)`, `keepCredentials(ids)`, `renamesFrom(previous)`.
- **Node:** `isTrigger`, `retryDelay(failure, attempt)`:
  - `limit`, `isolation` → `null`;
  - `platform` → до 3 попыток, 1 с ×2; если тип недоступен — 5 с ×2, не больше 60 с, пока не прошло 15 минут;
  - `user` → пока `attempt < retry.attempts`, ожидание `retry.waitMs`.

### 3. Домен: Workflow и Release

- **Files:** `domain/workflow.ts`, `domain/release.ts`, `domain/user.ts` (`isEditor`); тесты `workflow.spec.ts`, `release.spec.ts`.
- **Workflow:**
  - `create`, `rename`, `saveDraft(revision, graph, settings)`, `pin`, `unpin`;
  - `publish(revision, problems, publishedBy)`, `activate(release, problems)`, `deactivate`, `archive`, `restore`;
  - `transferTo`, `duplicate`;
  - запуски: `startTestRun`, `startManualRun`, `startTriggeredRun`;
  - `serves(releaseNumber)`;
  - события `ActivationChanged`: `events`, `clearEvents()`.
- Ревизия начинается с 1.

### 4. Домен: Run и Step

- **Files:** `domain/run.ts`, `domain/step.ts`; тест `run.spec.ts`.
- **Run, создание и приём данных:**
  - `queue(NewRun)`: id — UUIDv8 из ключа триггера, если ключ есть (`Run.idFrom(key)`);
  - `receiveInput(outputs)`, `takePin(nodeId, outputs)` — только в статусе `queued`.
- **Run, ход исполнения:**
  - `begin()`, `order`;
  - `reach(nodeId)` → `Arrival` (порядок решений из data-model);
  - `inputOf(nodeId)` → `NodeInput`;
  - `complete(nodeId, attempt, outputs, limits)`, `fail(nodeId, attempt, failure, outputs)`;
  - `cancel`, `terminate(error)`, `finish`.

### 5. Домен: WebhookEndpoint

- **Files:** `domain/webhook-endpoint.ts`, `domain/webhook-secret.ts`; тест.

### 6. Формулы (адаптер)

- **Files:** `interface-adapters/formulas/formula-engine.ts`, `formula.ts` (разбор шаблона `{{ }}`), `formula-interpreter.ts`, `formula-scope.ts`; тест `test/unit/formulas/*.spec.ts`.
- Безопасный интерпретатор ESTree без функций, циклов, присваиваний и регулярных выражений. Бюджет 100 мс и 1 МБ.
- Методы из allow-list для строк, чисел, массивов, объектов и Luxon `DateTime`.
- Переменные: `$json`, `$input`, `$('Имя')`, `$now`, `$today`, `$execution`, `$workflow`.
- `check(formula, scope)` → проблемы синтаксиса и области видимости. `renameNode(text, from, to)` переписывает по позициям парсера.

### 7. Каркас типов узлов (адаптер)

- **Files:** `interface-adapters/node-types/`:
  - `node-type.ts` — интерфейс типа;
  - `bindings.ts` — разрешение привязок;
  - `binding-check.ts` — проверка при сохранении: zod, динамические пути отфильтрованы;
  - `node-context.ts`, `node-errors.ts`, `conditions.ts`, `field-shapes.ts`;
  - `node-type.registry.ts` — порт `NodeTypeCatalog`.
- Тесты в `test/unit/node-types/`.

### 8. Ядро узлов

- **Триггеры:** `manualTrigger`, `scheduleTrigger`, `webhook`.
- **Поток:** `if`, `switch`, `merge`, `filter`, `stopAndError`, `noOp`.
- **Преобразования:** `editFields`, `renameKeys`, `aggregate`, `splitOut`, `summarize`, `sort`, `limit`, `removeDuplicates`, `compareDatasets`, `dateTime`, `crypto`, `html`, `xml`, `markdown`.
- По одному файлу на тип: `node-types/<id>.node.ts`. Тест на каждый режим.

### 9. Application: workflow

- **Порты:** `WorkflowRepository`, `ReleaseRepository`, `WorkflowQueries`, `NodeTypeCatalog`, `NodeSamples`, `FormulaEngine`, `ArtifactStore`.
- `WorkflowPolicy` (`author`, `manage`), `ConfigurationCheck`.
- **Use cases:**
  - команды: `CreateWorkflow`, `RenameWorkflow`, `SaveDraft`, `PinSample`, `UnpinSample`, `PublishRelease`, `ArchiveWorkflow`, `RestoreWorkflow`, `DuplicateWorkflow`, `TransferWorkflow`;
  - запросы: `GetWorkflow`, `ListWorkflows`, `ListReleases`, `GetRelease`, `ListNodeTypes`.
- Тесты на in-memory fakes (`test/support/automation-fakes.ts`).

### 10. Application: запуски

- **Порты:** `RunRepository`, `RunQueries`, `NodeExecutor`.
- **Use cases:**
  - команды: `StartTestRun`, `StartManualRun`, `CancelRun`;
  - шаги движка: `BeginRun`, `ReachNode`, `ExecuteNode`, `RecordNode`, `FinishRun`, `TerminateRun`;
  - запросы: `ListStaleRuns`, `GetRun`, `ListRuns`, `ReadStepOutput`.
- Тесты.

### 11. Хранение

- Схема Drizzle: `workflow`, `release`, `run`, `step`, `node_sample`, `webhook_endpoint`, `idempotency_key`. Миграция `0003`.
- Mappers, репозитории (`update` с outbox-событиями), queries, `DrizzleNodeSamples`.
- Интеграционные тесты.

### 12. Хранилище вывода

- `interface-adapters/storage/s3-artifact.store.ts`: JSONL-чанки по 500 элементов или 4 МиБ.
- `frameworks/s3/client.ts`.
- Garage в `test/support/global-setup.ts`. Интеграционный тест.

### 13. Исполнитель узлов

- `interface-adapters/node-types/node-executor.ts` (порт `NodeExecutor`):
  - читает входы и применяет `firstItemOnly`;
  - разрешает и проверяет параметры на каждом элементе;
  - исполняет тип и пишет выходы с лимитами шага;
  - выдаёт пустой элемент при `alwaysOutputData`;
  - при `errorOutput` отдаёт элементы в выход ошибки;
  - собирает известные поля;
  - переводит ошибки в `NodeFailure`.
- Тест на fake store.

### 14. Движок

- `interface-adapters/workflows/`:
  - `run.workflow.ts`, `run-launcher.ts`, `step-transaction.ts`;
  - `maintenance.workflow.ts`: зависшие запуски и сверка расписаний.
- `frameworks/di/workflows.module.ts`, `main.ts` с ролями процесса.
- Интеграционный тест прогона через `drain()`.

### 15. HTTP и сборка A

- Контроллеры: workflows, releases, runs, node-types. Плюс DTO, presenters, маппинг ошибок.
- `frameworks/di/automation.module.ts`, лимиты body parser, `rawBody`.
- Компонентные тесты полного цикла A.

### 16. B: секреты и адреса webhook

- `SecretCipher` (AES-256-GCM, версии ключей), `WebhookEndpointRepository`, `WebhookEndpointIssuer`.
- Выдача адресов при `SaveDraft` и `DuplicateWorkflow`.
- `ListWebhookEndpoints`, `RotateWebhookSecret`.

### 17. B: активация и расписания

- `ActivateRelease`, `DeactivateWorkflow`.
- Outbox-обработчик `ActivationChanged` → регистратор расписаний.
- `ScheduledTriggerWorkflow`, `StartScheduledRun`, сверка расписаний в maintenance.
- Компонентные тесты с `ManualWorkflowClock`.

### 18. B: webhook ingress

- `WebhookIngressGuard` (единый 404), `IdempotencyModule` + `DrizzleIdempotencyStore`.
- `StartWebhookRun`, `ResolveWebhook`.
- Компонентные тесты.

### 19. Окружение и проверка

- `compose.yaml`: `worker`, `objects` (Garage), `infra/garage/garage.toml`.
- Документация (03-api.md, 04-execution.md).
- Прогон: `pnpm --filter api lint`, `check-types`, `test`, `test:int`, prettier.

## Self-review

- **Покрытие:** FR-001…FR-017, FR-018 (без waiting), FR-019…FR-023, FR-024 (без wait/children), FR-025…FR-027, FR-043, FR-046 (части A и B).
- **Вне объёма:** C (Wait, подпроцессы, error workflow), D (учётные данные, HTTP Request), E (Code), F (retention). Поле `credentialId` и настройка `errorWorkflowId` хранятся, но в этом раунде не исполняются.
