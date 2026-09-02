'use client';

import React from 'react';
import { Toaster as Sonner } from 'sonner';

/**
 * Sonner stacks, so two writes finishing at once no longer overwrite each other's message.
 * Every surface comes from the app's own tokens, because Sonner's default theme is not
 * this palette. `richColors` is off for the same reason.
 */
export function Toaster() {
  return (
    <Sonner
      position="bottom-right"
      duration={6000}
      gap={8}
      visibleToasts={5}
      closeButton
      toastOptions={{
        classNames: {
          toast:
            'group !rounded-lg !border !border-line-strong !bg-surface-raised !text-ink !shadow-float !text-sm !font-sans',
          title: '!text-ink !font-medium',
          description: '!text-muted',
          actionButton:
            '!rounded-sm !bg-accent-wash !px-1.5 !py-0.5 !text-xs !font-semibold !text-accent',
          cancelButton: '!rounded-sm !text-xs !text-dim',
          closeButton: '!border-line-strong !bg-surface-raised !text-dim hover:!text-ink',
          success: '[&_[data-icon]]:!text-ready',
          error: '!text-danger [&_[data-title]]:!text-danger [&_[data-icon]]:!text-danger',
          loading: '[&_[data-icon]]:!text-accent',
        },
      }}
    />
  );
}
