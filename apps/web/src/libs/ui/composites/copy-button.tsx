'use client';

import { CheckIcon, CopyIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '../components/button';

interface CopyButtonProps {
  readonly value: string;
  readonly label?: string;
  readonly size?: 'icon-xs' | 'icon-sm' | 'sm';
}

const SHOWN_MS = 1500;

// Copies a value to the clipboard and says so.
export function CopyButton({
  value,
  label = 'Copy',
  size = 'icon-sm',
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), SHOWN_MS);
    } catch {
      toast.error('The browser refused to copy; select the text instead.');
    }
  }

  const icon = copied ? <CheckIcon /> : <CopyIcon />;

  return (
    <Button
      type="button"
      variant="ghost"
      size={size}
      onClick={copy}
      aria-label={label}
      title={label}
    >
      {icon}
      {size === 'sm' && (copied ? 'Copied' : label)}
    </Button>
  );
}
