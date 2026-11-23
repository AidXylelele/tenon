# viewer-notice

What a viewer reads where a page offers changes they may not make. Viewers read workflows and runs; editors and administrators change them.

Owner: web — pages.

## API

- `<ViewerNotice what />`: an empty state for a page a viewer cannot use, saying what the page is for (`what`, one sentence), that viewers read workflows and runs, and to ask an administrator for the editor role.
- `<ViewerLine />`: the same fact in one line, for a header whose actions a viewer does not get.

## Consumers

- `spaces/workflows/modules/workflow-detail`: the line.
- `spaces/connections/**`, `spaces/secrets/modules/secrets`: the notice.
- `spaces/runs/modules/run-detail`: the line.

## Playground

`viewer-notice.stories.tsx`: the notice and the line.
