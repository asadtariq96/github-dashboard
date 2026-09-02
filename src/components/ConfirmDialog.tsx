'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';

export interface ConfirmState {
  title: string;
  detail: string;
  confirmLabel: string;
  /** Awaited, so the dialog can hold itself open until GitHub answers. */
  run: () => Promise<void> | void;
}

export function ConfirmDialog({
  state,
  onCancel,
}: {
  state: ConfirmState | null;
  onCancel: () => void;
}) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!state) {
      setBusy(false);
      return;
    }
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [state, onCancel, busy]);

  if (!state) return null;

  const confirm = async () => {
    setBusy(true);
    try {
      await state.run();
    } finally {
      setBusy(false);
      onCancel();
    }
  };

  return (
    <div
      className="fixed inset-0 z-modal flex items-center justify-center bg-canvas/70 p-4"
      onClick={() => {
        if (!busy) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-detail"
        aria-busy={busy}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-lg border border-line-strong bg-surface-raised p-4 shadow-float"
      >
        <div className="flex items-start gap-3">
          <AlertTriangle aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-danger" />
          <div className="min-w-0">
            <h2 id="confirm-title" className="text-lg font-semibold text-ink">
              {state.title}
            </h2>
            <p id="confirm-detail" className="mt-1 whitespace-pre-line text-sm text-muted">
              {state.detail}
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          {busy && (
            <span role="status" className="mr-auto text-xs text-dim">
              Talking to GitHub&hellip;
            </span>
          )}

          <button
            onClick={onCancel}
            disabled={busy}
            className="tap-safe rounded-md border border-line-control bg-surface px-3 py-1.5 text-sm text-muted transition-colors duration-instant ease-out hover:text-ink disabled:cursor-not-allowed disabled:opacity-45"
          >
            Cancel
          </button>
          <button
            ref={confirmRef}
            onClick={confirm}
            disabled={busy}
            className="tap-safe inline-flex items-center gap-2 rounded-md bg-danger-fill px-3 py-1.5 text-sm font-semibold text-accent-on transition-opacity duration-instant ease-out hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy && <Loader2 aria-hidden className="h-4 w-4 animate-spin" />}
            {busy ? 'Working…' : state.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
