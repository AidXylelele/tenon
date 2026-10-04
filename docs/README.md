# Documentation

Architecture documentation of the Workflow Platform, version 1. Each document describes the
system as it is specified; the specification that changes the system updates the document.

| Document                                          | Content                                                              |
| ------------------------------------------------- | -------------------------------------------------------------------- |
| [01-domain.md](architecture/01-domain.md)         | Bounded contexts, context map, domain model of Automation            |
| [02-system.md](architecture/02-system.md)         | System context, containers, process roles, deployment                |
| [03-api.md](architecture/03-api.md)               | API layers, modules, ports and adapters, HTTP interface              |
| [04-execution.md](architecture/04-execution.md)   | Run lifecycle, triggers, data between nodes, status reads, retention |
| [05-node-types.md](architecture/05-node-types.md) | Node type catalogue, manifest, Code Node, AI Agent Node              |
| [06-security.md](architecture/06-security.md)     | Authentication, authorisation, secrets, webhooks, sandbox, limits    |

Engineering rules: [.specify/memory/constitution.md](../.specify/memory/constitution.md).
