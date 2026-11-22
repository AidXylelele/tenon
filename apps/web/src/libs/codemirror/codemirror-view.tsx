"use client";

import { Compartment, EditorState, type Extension } from "@codemirror/state";
import { EditorView, type ViewUpdate } from "@codemirror/view";
import { cn } from "@/libs/ui/tokens/cn";
import {
  type JSX,
  useEffect,
  useEffectEvent,
  useId,
  useRef,
  useState,
} from "react";
import { baseSetup } from "./base-setup";

interface CodeMirrorViewProps {
  readonly doc: string;
  readonly extensions?: Extension;
  readonly readOnly?: boolean;
  readonly label: string;
  readonly className?: string;
  readonly onView?: (view: EditorView) => void;
  readonly onUpdate?: (update: ViewUpdate) => void;
}

const NO_EXTENSIONS: Extension = [];

const ownerExtensions = new Compartment();
const editability = new Compartment();

function editabilityOf(readOnly: boolean, hint: string): Extension {
  const described: Record<string, string> = readOnly
    ? {}
    : { "aria-describedby": hint };
  return [
    EditorState.readOnly.of(readOnly),
    EditorView.editable.of(!readOnly),
    EditorView.contentAttributes.of(described),
  ];
}

export function CodeMirrorView({
  doc,
  extensions = NO_EXTENSIONS,
  readOnly = false,
  label,
  className,
  onView,
  onUpdate,
}: CodeMirrorViewProps): JSX.Element {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView>(null);
  const hint = useId();
  const [focused, setFocused] = useState(false);

  const handOver = useEffectEvent((created: EditorView) => {
    onView?.(created);
  });
  const report = useEffectEvent((update: ViewUpdate) => {
    onUpdate?.(update);
  });
  const create = useEffectEvent(
    () =>
      new EditorView({
        doc,
        extensions: [
          baseSetup(),
          EditorView.contentAttributes.of({ "aria-label": label }),
          EditorView.domEventHandlers({
            focus: () => {
              setFocused(true);
            },
            blur: () => {
              setFocused(false);
            },
          }),
          EditorView.updateListener.of((update) => {
            report(update);
          }),
          ownerExtensions.of(extensions),
          editability.of(editabilityOf(readOnly, hint)),
        ],
      }),
  );

  useEffect(() => {
    const reconfiguration = ownerExtensions.reconfigure(extensions);
    view.current?.dispatch({ effects: reconfiguration });
  }, [extensions]);

  useEffect(() => {
    const facets = editabilityOf(readOnly, hint);
    const reconfiguration = editability.reconfigure(facets);
    view.current?.dispatch({ effects: reconfiguration });
  }, [readOnly, hint]);

  useEffect(() => {
    const created = create();
    host.current?.append(created.dom);
    view.current = created;
    handOver(created);
    return () => {
      created.destroy();
      view.current = null;
    };
  }, []);

  return (
    <div className={cn("relative", className)}>
      <div ref={host} className="h-full" />
      {!readOnly && (
        <p
          id={hint}
          className={cn(
            "pointer-events-none absolute right-2 bottom-2 z-10 rounded-md border bg-popover px-2 py-0.5 text-xs text-muted-foreground shadow-xs",
            !focused && "sr-only",
          )}
        >
          Tab indents. To leave the text, press Esc, then Tab.
        </p>
      )}
    </div>
  );
}
