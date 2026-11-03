'use client';

import { cn } from 'cn';
import { Maximize2Icon, WandSparklesIcon } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/libs/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/libs/ui/components/dialog';
import { Skeleton } from '@/libs/ui/components/skeleton';
import { Spinner } from '@/libs/ui/components/spinner';
import { formatCode, formattable } from './format-code';
import { type CodeLanguage, languageName } from './languages';

// CodeMirror loads with the first code field shown, so pages without one never carry it.
const Surface = dynamic(() => import('./code-surface'), {
  ssr: false,
  loading: () => <Skeleton className="size-full rounded-none" />,
});

interface CodeEditorProps {
  readonly id?: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly language: CodeLanguage;
  // Names the editor for assistive technologies and titles the large editor.
  readonly label: string;
  readonly invalid?: boolean;
  // `short` for a value of a few lines, `regular` for code.
  readonly size?: 'short' | 'regular';
  readonly placeholder?: string;
}

const HEIGHT = { short: 'h-32', regular: 'h-64' } as const;

// Code in a form (FR-032, research R17): highlighted, numbered and indented as its language
// wants, syntax errors marked where they are, a fixed height that the person can drag taller,
// a large editor on demand and, for JavaScript and JSON, a Format button.
export function CodeEditor({
  id,
  value,
  onChange,
  language,
  label,
  invalid = false,
  size = 'regular',
  placeholder,
}: CodeEditorProps) {
  const [large, setLarge] = useState(false);
  const [formatting, startFormatting] = useTransition();

  const format = () => {
    startFormatting(async () => {
      try {
        const laidOut = await formatCode(value, language);
        onChange(laidOut);
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        toast.error('The code could not be formatted', {
          description: reason.split('\n')[0],
        });
      }
    });
  };

  const tools = (
    <div className="flex items-center gap-1">
      <span className="mr-auto text-[11px] font-medium text-muted-foreground">
        {languageName(language)}
      </span>
      {formattable(language) && (
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={format}
          disabled={formatting || value.trim() === ''}
        >
          {formatting ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <WandSparklesIcon data-icon="inline-start" />
          )}
          Format
        </Button>
      )}
    </div>
  );

  return (
    <div
      className={cn(
        'flex flex-col overflow-hidden rounded-lg border',
        invalid && 'border-destructive ring-3 ring-destructive/20',
      )}
    >
      <div className="flex items-center gap-1 border-b bg-muted/40 px-2 py-1">
        <div className="min-w-0 flex-1">{tools}</div>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={`Open ${label} in a large editor`}
          title="Open in a large editor"
          onClick={() => setLarge(true)}
        >
          <Maximize2Icon />
        </Button>
      </div>
      <div
        className={cn(
          'min-h-20 resize-y overflow-hidden text-[13px]',
          HEIGHT[size],
        )}
      >
        <Surface
          id={id}
          value={value}
          onChange={onChange}
          language={language}
          label={label}
          placeholder={placeholder}
        />
      </div>
      <Dialog open={large} onOpenChange={setLarge}>
        <DialogContent className="flex h-[85svh] w-[95vw] max-w-5xl flex-col gap-3 sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>{label}</DialogTitle>
            <DialogDescription>
              Tab indents; press Esc and then Tab to leave the editor. Changes
              are kept as you type.
            </DialogDescription>
          </DialogHeader>
          {tools}
          <div className="min-h-0 flex-1 overflow-hidden rounded-lg border text-[13px]">
            <Surface
              value={value}
              onChange={onChange}
              language={language}
              label={label}
              placeholder={placeholder}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
