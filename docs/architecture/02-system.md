# System

## System context

```mermaid
C4Context
  title Workflow Platform - System Context
  Person(user, "User", "Roles: admin, editor, viewer")
  System(platform, "Workflow Platform", "Builds, runs and observes no-code automations")
  System_Ext(ext, "External services", "Targets of integration nodes; webhook senders")
  System_Ext(llm, "Model providers", "LLM APIs used by AI nodes")
  Rel(user, platform, "Uses", "HTTPS")
  Rel(platform, ext, "Calls", "HTTPS")
  Rel(ext, platform, "Sends webhooks", "HTTPS")
  Rel(platform, llm, "Calls", "HTTPS")
```

## Containers

```mermaid
C4Container
  title Workflow Platform - Containers
  Person(user, "User")
  System_Ext(ext, "External services")
  System_Ext(llm, "Model providers")
  System_Boundary(platform, "Workflow Platform") {
    Container(web, "Web", "Next.js (BFF + client)", "UI, session cookie, API composition")
    Container(api, "API process", "NestJS, role api", "REST /api/v1, authentication, use cases, webhook ingress, schedules")
    Container(worker, "Worker process", "NestJS, role worker", "Run execution, polling triggers, retention")
    Container(sandbox, "Code Sandbox", "go-judge sidecar", "Scripted JSON transforms")
    ContainerDb(pg, "PostgreSQL", "", "Application tables, nest_workflows")
    ContainerDb(s3, "Object Storage", "S3-compatible", "Run artifacts")
  }
  Rel(user, web, "HTTPS, cookie")
  Rel(web, api, "HTTP, cookie forwarded")
  Rel(ext, api, "Webhooks")
  Rel(api, pg, "SQL; start and signal runs")
  Rel(worker, pg, "Claim and journal runs; schedules")
  Rel(worker, s3, "Read and write artifacts")
  Rel(worker, sandbox, "REST, localhost")
  Rel(worker, ext, "Integration calls")
  Rel(worker, llm, "Model calls")
```

## Process roles

One codebase, one image, one `AppModule`. The `ROLE` variable selects the bootstrap and the module options.

| Role     | Bootstrap                                                  | WorkflowsModule        | Responsibility                                                        |
| -------- | ---------------------------------------------------------- | ---------------------- | --------------------------------------------------------------------- |
| `api`    | `NestFactory.create(AppModule)`, HTTP listener             | `worker: false`        | Starts, signals and inspects runs; manages schedules; serves HTTP     |
| `worker` | `NestFactory.createApplicationContext(AppModule)`, no HTTP | `worker.enabled: true` | Claims and executes run instances; polling trigger job; retention job |

Workflow classes and the PostgreSQL workflow store are registered in both roles. Both roles enable shutdown hooks; `shutdownTimeout` is below the platform grace period.

## Deployment

| Aspect         | Value                                                                                   |
| -------------- | --------------------------------------------------------------------------------------- |
| Image          | One image for both roles; command differs by `ROLE`                                     |
| API scaling    | HPA on CPU and request rate                                                             |
| Worker scaling | KEDA PostgreSQL scaler on due instances in `nest_workflows.instances`                   |
| Worker pod     | Worker container plus go-judge sidecar on `localhost:5050`                              |
| State          | PostgreSQL and Object Storage only; processes are stateless                             |
| Migrations     | `drizzle-kit migrate` and `nest-workflows migrate` run as a release step before rollout |
| Configuration  | Environment variables validated at startup                                              |
