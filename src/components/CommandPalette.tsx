'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Search } from 'lucide-react';
import { CARD_SPRING } from '../lib/motion';
import type { LucideIcon } from 'lucide-react';

export interface PaletteCommand {
  label: string;
  hint: string;
  icon: LucideIcon;
  run: () => void;
}

export function CommandPalette({
  open,
  onClose,
  commands,
}: {
  open: boolean;
  onClose: () => void;
  commands: PaletteCommand[];
}) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);
  const shown = commands.filter((item) => item.label.toLowerCase().includes(query.toLowerCase()));
  useEffect(() => setSelectedIndex(0), [query]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-modal flex items-start justify-center bg-ink/20 px-4 pt-[14vh] backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={CARD_SPRING}
            onMouseDown={(event) => event.stopPropagation()}
            className="w-full max-w-lg overflow-hidden rounded-lg border border-line-strong bg-surface-raised shadow-float"
          >
            <div className="flex items-center gap-3 border-b border-line px-4">
              <Search aria-hidden className="h-4 w-4 text-dim" />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') onClose();
                  if (event.key === 'ArrowDown') {
                    event.preventDefault();
                    setSelectedIndex((index) => (index + 1) % Math.max(shown.length, 1));
                  }
                  if (event.key === 'ArrowUp') {
                    event.preventDefault();
                    setSelectedIndex(
                      (index) =>
                        (index - 1 + Math.max(shown.length, 1)) % Math.max(shown.length, 1),
                    );
                  }
                  if (event.key === 'Enter' && shown[selectedIndex]) {
                    shown[selectedIndex].run();
                    onClose();
                  }
                }}
                placeholder="Type a command…"
                className="min-w-0 flex-1 bg-transparent py-4 text-sm text-ink outline-none placeholder:text-dim"
              />
              <kbd className="rounded-md border border-line bg-surface-muted px-1.5 py-0.5 font-mono text-2xs text-dim">
                esc
              </kbd>
            </div>
            <div className="max-h-80 overflow-y-auto p-2">
              {shown.map((command, index) => (
                <button
                  key={command.label}
                  onMouseEnter={() => setSelectedIndex(index)}
                  onClick={() => {
                    command.run();
                    onClose();
                  }}
                  className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm ${
                    selectedIndex === index
                      ? 'bg-surface-hover text-ink'
                      : 'text-muted hover:bg-surface-hover hover:text-ink'
                  }`}
                >
                  <command.icon aria-hidden className="h-4 w-4 text-dim" />
                  <span className="flex-1">{command.label}</span>
                  <kbd className="font-mono text-2xs text-dim">{command.hint}</kbd>
                </button>
              ))}
              {shown.length === 0 && (
                <p className="px-3 py-8 text-center text-sm text-dim">No matching command.</p>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
