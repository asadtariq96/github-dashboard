'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ArrowUpDown, Check } from 'lucide-react';
import { SORTS, sortSpec, type SortId } from '../lib/sort';

const ITEM_SELECTOR = '[role="menuitemradio"]';

export function SortMenu({ value, onChange }: { value: SortId; onChange: (id: SortId) => void }) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const active = sortSpec(value);

  const close = (returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;

    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>(ITEM_SELECTOR) ?? []);
    (items.find((el) => el.getAttribute('aria-checked') === 'true') ?? items[0])?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close(true);
        return;
      }
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End') {
        return;
      }
      e.preventDefault();
      const current = items.indexOf(document.activeElement as HTMLElement);
      const last = items.length - 1;
      const next =
        e.key === 'Home'
          ? 0
          : e.key === 'End'
            ? last
            : e.key === 'ArrowDown'
              ? (current + 1) % items.length
              : (current - 1 + items.length) % items.length;
      items[next]?.focus();
    };

    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (menuRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      setOpen(false);
    };

    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('mousedown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, [open]);

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Sort: ${active.field}, ${active.direction}. Change sort order`}
        title={`${active.field} — ${active.direction}`}
        className="tap-safe inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface-raised px-3 py-2 text-xs text-muted shadow-sm transition-all duration-instant ease-out hover:-translate-y-px hover:border-line-strong hover:text-ink"
      >
        <ArrowUpDown aria-hidden strokeWidth={1.5} className="h-3.5 w-3.5" />
        <span className="whitespace-nowrap">{active.short}</span>
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-label="Sort order"
          className="absolute right-0 top-full z-popover mt-1 w-56 overflow-hidden rounded-lg border border-line-strong bg-surface-raised py-1 shadow-float"
        >
          {SORTS.map((spec) => {
            const checked = spec.id === value;
            return (
              <button
                key={spec.id}
                role="menuitemradio"
                aria-checked={checked}
                onClick={() => {
                  onChange(spec.id);
                  close(true);
                }}
                className={`pointer-safe flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-sm transition-colors duration-instant ease-out ${
                  checked ? 'text-accent' : 'text-muted hover:bg-surface-hover hover:text-ink'
                }`}
              >
                <Check
                  aria-hidden
                  strokeWidth={2}
                  className={`h-3.5 w-3.5 shrink-0 ${checked ? '' : 'invisible'}`}
                />
                <span className="min-w-0 flex-1">
                  {spec.field}
                  <span className="block text-2xs text-dim">{spec.direction}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
