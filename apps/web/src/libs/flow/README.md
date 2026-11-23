# libs/flow

The flow canvas: a named, scrolling region that draws its content scaled, with its zoom control. Infrastructure with no business words; what is drawn inside is the caller's.

Owner: web — foundation. Decisions: design system §6 (Flow canvas: zoom in, zoom out and fit pinned in the canvas, no minimap), §7 (Flow canvas, Resizable: the canvas's scrollbars are the single-pointer alternative to dragging, WCAG 2.2 SC 2.5.7, resolution M-91); the tech lead's ruling TL-33 (zoom 75–150 %, so a 32 px hit area never draws below 24 px, SC 2.5.8) and TL-34 (zooming keeps the view's centre); the designer's F1-05 and F1-06.

## API

`<FlowCanvas label description? focusable>{content}</FlowCanvas>` fills its container.

- `label` names the region; `description`, when given, says how to move inside it (`aria-describedby`).
- `focusable`: the region is a Tab stop of its own, for content with no controls, so the keyboard can scroll it; content with controls keeps the stop itself.
- It opens fitted to its width, never above 100 % nor below 75 %, centred on the top of its content; what does not fit scrolls inside the region, never the page.
- The "Zoom" group, pinned bottom-left, or top-right with `zoomAt="top-right"` (a flow read on its own, so the bar stays off the content): Zoom in and Zoom out move between 75, 100, 125 and 150 %, snapping to the next step; Fit shows all of the content, between 75 and 100 %. Each keeps the centre of the view where it was. The level is shown beside the buttons and announced politely.
- The content is scaled by a transform, so layout positions inside it (`offsetLeft`, `offsetTop`) are the content's own; a drawing over it measures in those.

## Tests

`flow-canvas.test.tsx` (jsdom with the layout's sizes given) and `zoom.test.ts`; the flow view's Playground and its smoke test show it in a browser.
