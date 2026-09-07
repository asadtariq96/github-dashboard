'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Loader2 } from 'lucide-react';

type IconType = React.ComponentType<{
  className?: string;
  strokeWidth?: number;
  'aria-hidden'?: boolean;
}>;

const AVATAR_TONES = [
  'bg-[#d97a5c]',
  'bg-[#5b86c4]',
  'bg-[#6fa564]',
  'bg-[#9a72c4]',
  'bg-[#c79a45]',
];

function toneFor(name: string) {
  let sum = 0;
  for (const ch of name) sum += ch.charCodeAt(0);
  return AVATAR_TONES[sum % AVATAR_TONES.length];
}

export function Avatar({ name, src, size = 20 }: { name: string; src?: string; size?: number }) {
  if (src) {
    return (
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className="shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <span
      aria-hidden
      style={{ width: size, height: size, fontSize: Math.round(size * 0.46) }}
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold uppercase text-white ${toneFor(name)}`}
    >
      {name.slice(0, 1)}
    </span>
  );
}

export function DiffStat({
  additions,
  deletions,
  className = '',
}: {
  additions: number;
  deletions: number;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 font-mono text-xs font-semibold tabular ${className}`}
    >
      <span className="text-ready">+{additions}</span>
      <span className="text-danger">&minus;{deletions}</span>
    </span>
  );
}

export function DiffBar({
  additions,
  deletions,
  width = 32,
}: {
  additions: number;
  deletions: number;
  width?: number;
}) {
  const total = additions + deletions;
  const addPct = total === 0 ? 0 : Math.round((additions / total) * 100);

  return (
    <span
      aria-hidden
      style={{ width }}
      className="inline-flex h-[5px] overflow-hidden rounded-full bg-line-strong"
    >
      <span style={{ width: `${addPct}%` }} className="h-full bg-ready" />
      <span style={{ width: `${100 - addPct}%` }} className="h-full bg-danger" />
    </span>
  );
}

export function CountPill({
  children,
  active = false,
}: {
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <span
      className={`rounded-full px-1.5 py-px font-mono text-2xs font-semibold tabular ${
        active ? 'bg-accent-wash text-accent' : 'bg-surface-muted text-muted'
      }`}
    >
      {children}
    </span>
  );
}

const CHIP_TONE = {
  neutral: 'border-line bg-surface-raised text-muted',
  danger: 'border-danger-border bg-danger-wash font-semibold text-danger',
  warn: 'border-warn/40 bg-warn-wash font-semibold text-warn',
  queue: 'border-queue/40 bg-queue-wash font-semibold text-queue',
  draft: 'border-line bg-surface-muted font-semibold text-muted',
} as const;

export function Chip({
  icon: Icon,
  iconClass = 'text-dim',
  tone = 'neutral',
  title,
  children,
}: {
  icon?: IconType;
  iconClass?: string;
  tone?: keyof typeof CHIP_TONE;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      title={title}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium shadow-sm ${CHIP_TONE[tone]}`}
    >
      {Icon && (
        <Icon aria-hidden strokeWidth={2} className={`h-[14px] w-[14px] shrink-0 ${iconClass}`} />
      )}
      {children}
    </span>
  );
}

const BUTTON_BASE =
  'inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg text-xs font-medium shadow-sm transition-all duration-instant ease-out hover:-translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0';

const BUTTON_TONE = {
  outline: 'border border-line bg-surface text-muted hover:bg-surface-muted hover:text-ink',
  danger:
    'border border-danger-border bg-surface text-danger hover:bg-danger-wash hover:border-danger',
  warn: 'border border-line bg-surface font-semibold text-warn hover:bg-warn-wash',
  accent: 'border border-transparent bg-accent-fill text-accent-on hover:bg-accent-hover',
  fillWarn: 'border border-transparent bg-warn-fill text-white hover:opacity-90',
  fillReady: 'border border-transparent bg-ready-fill text-white hover:opacity-90',
} as const;

export function ActionButton({
  icon: Icon,
  children,
  tone = 'outline',
  href,
  onClick,
  disabled,
  busy,
  trailingChevron,
  compact = false,
  title,
}: {
  icon?: IconType;
  children: React.ReactNode;
  tone?: keyof typeof BUTTON_TONE;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  busy?: boolean;
  trailingChevron?: boolean;
  compact?: boolean;
  title?: string;
}) {
  const className = `${BUTTON_BASE} ${BUTTON_TONE[tone]} tap-safe ${compact ? 'px-2 py-1' : 'pointer-safe px-3 py-2'}`;
  const inner = (
    <>
      {busy ? (
        <Loader2 aria-hidden className="h-[13px] w-[13px] shrink-0 animate-spin" />
      ) : (
        Icon && (
          <Icon aria-hidden strokeWidth={2} className="h-[13px] w-[13px] shrink-0 opacity-80" />
        )
      )}
      {children}
      {trailingChevron && (
        <ChevronDown aria-hidden strokeWidth={2} className="h-3 w-3 shrink-0 opacity-70" />
      )}
    </>
  );

  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" title={title} className={className}>
        {inner}
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      title={title}
      className={className}
    >
      {inner}
    </button>
  );
}

export interface MenuItem {
  id: string;
  label: string;
  icon?: IconType;
  tone?: 'default' | 'danger';
  onSelect: () => void;
  disabled?: boolean;
}

/**
 * Escape returns focus to the trigger, arrows rove, a click outside closes. The trigger
 * is supplied by the caller so the same menu serves the split button and the kebab.
 */
export function Menu({
  items,
  label,
  align = 'right',
  renderTrigger,
}: {
  items: MenuItem[];
  label: string;
  align?: 'left' | 'right';
  renderTrigger: (props: {
    onClick: () => void;
    'aria-expanded': boolean;
    'aria-haspopup': 'menu';
    ref: React.Ref<HTMLButtonElement>;
  }) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (listRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    };

    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  useEffect(() => {
    if (open) listRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  }, [open]);

  const close = (returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const focusables = Array.from(
      listRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [],
    );
    const index = focusables.indexOf(document.activeElement as HTMLElement);

    if (e.key === 'Escape') {
      e.stopPropagation();
      close(true);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      focusables[(index + 1) % focusables.length]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      focusables[(index - 1 + focusables.length) % focusables.length]?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      focusables[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      focusables[focusables.length - 1]?.focus();
    }
  };

  return (
    <span className="relative inline-flex">
      {renderTrigger({
        onClick: () => setOpen((v) => !v),
        'aria-expanded': open,
        'aria-haspopup': 'menu',
        ref: triggerRef,
      })}

      {open && (
        <div
          ref={listRef}
          role="menu"
          aria-label={label}
          onKeyDown={onKeyDown}
          className={`absolute top-full z-popover mt-1 min-w-[13rem] overflow-hidden rounded-lg border border-line bg-surface-raised py-1 shadow-float ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {items.map((item) => (
            <button
              key={item.id}
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                close(false);
                item.onSelect();
              }}
              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors duration-instant ease-out disabled:opacity-45 ${
                item.tone === 'danger'
                  ? 'text-danger hover:bg-danger-wash'
                  : 'text-muted hover:bg-surface-hover hover:text-ink'
              }`}
            >
              {item.icon && (
                <item.icon
                  aria-hidden
                  strokeWidth={2}
                  className="h-3.5 w-3.5 shrink-0 opacity-80"
                />
              )}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </span>
  );
}

const SPLIT_FILL = {
  accent: 'bg-accent-fill hover:bg-accent-hover',
  ready: 'bg-ready-fill hover:opacity-90',
  danger: 'bg-danger-fill hover:bg-danger-hover',
  queue: 'bg-queue hover:opacity-90',
} as const;

/** The one action for this state, with the rest of them on an attached menu trigger. */
export function SplitButton({
  children,
  icon: Icon,
  tone = 'accent',
  onClick,
  busy,
  menuItems,
  menuLabel,
  compact = false,
}: {
  children: React.ReactNode;
  icon?: IconType;
  tone?: keyof typeof SPLIT_FILL;
  onClick: () => void;
  busy?: boolean;
  menuItems: MenuItem[];
  menuLabel: string;
  compact?: boolean;
}) {
  const fill = SPLIT_FILL[tone];

  return (
    <span
      className={`inline-flex shrink-0 overflow-hidden rounded-lg border border-black/10 shadow-md transition-transform duration-instant ease-out hover:-translate-y-px ${fill}`}
    >
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        className={`tap-safe inline-flex items-center gap-1.5 ${compact ? 'px-2 py-1' : 'px-3.5 py-2'} text-xs font-semibold text-accent-on transition-colors duration-instant ease-out focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent-on disabled:opacity-60`}
      >
        {busy ? (
          <Loader2 aria-hidden className="h-[14px] w-[14px] animate-spin" />
        ) : (
          Icon && <Icon aria-hidden strokeWidth={2.5} className="h-[14px] w-[14px]" />
        )}
        {children}
      </button>

      {menuItems.length > 0 && (
        <Menu
          items={menuItems}
          label={menuLabel}
          renderTrigger={(props) => (
            <button
              type="button"
              {...props}
              aria-label={menuLabel}
              className="tap-safe flex items-center border-l border-white/25 px-2 py-1.5 text-accent-on transition-colors duration-instant ease-out focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent-on"
            >
              <ChevronDown aria-hidden strokeWidth={2} className="h-3.5 w-3.5" />
            </button>
          )}
        />
      )}
    </span>
  );
}
