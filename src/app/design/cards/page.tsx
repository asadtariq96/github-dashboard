'use client';

import { useState } from 'react';
import { PRCard } from '../../../components/pr-card/PRCard';
import { FIXTURES } from '../../../components/pr-card/fixtures';
import { ThemeToggle } from '../../../components/ThemeToggle';

/** Every card state on one page, so both themes can be checked without hitting GitHub. */
export default function CardDesignPage() {
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(FIXTURES.map(({ pr }) => [pr.id, true])),
  );

  return (
    <main className="min-h-dvh bg-canvas px-6 py-8">
      <div className="mx-auto flex max-w-[1420px] flex-col gap-8">
        <header className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-ink">Card states</h1>
          <span className="ml-auto">
            <ThemeToggle />
          </span>
        </header>

        <section className="flex flex-col gap-2.5">
          <h2 className="text-2xs font-bold uppercase tracking-[0.08em] text-dim">
            Description tab
          </h2>
          <ul className="flex flex-col gap-3">
            <li>
              <PRCard
                pr={FIXTURES[0].pr}
                mode="mine"
                isExpanded
                defaultTab="description"
                onToggleExpand={() => undefined}
                onToggleHide={() => undefined}
                onRunAction={() => undefined}
              />
            </li>
          </ul>
        </section>

        <section className="flex flex-col gap-2.5">
          <h2 className="text-2xs font-bold uppercase tracking-[0.08em] text-dim">
            Threads tab, first thread open
          </h2>
          <ul className="flex flex-col gap-3">
            <li>
              <PRCard
                pr={FIXTURES[0].pr}
                mode="mine"
                isExpanded
                defaultTab="threads"
                openFirstThread
                onToggleExpand={() => undefined}
                onToggleHide={() => undefined}
                onRunAction={() => undefined}
              />
            </li>
          </ul>
        </section>

        {FIXTURES.map(({ label, pr }) => (
          <section key={pr.id} className="flex flex-col gap-2.5">
            <h2 className="text-2xs font-bold uppercase tracking-[0.08em] text-dim">{label}</h2>
            <ul className="flex flex-col gap-3">
              <li>
                <PRCard
                  pr={pr}
                  mode="mine"
                  isExpanded={Boolean(expanded[pr.id])}
                  onToggleExpand={() => setExpanded((prev) => ({ ...prev, [pr.id]: !prev[pr.id] }))}
                  onToggleHide={() => undefined}
                  onRunAction={() => undefined}
                />
              </li>
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}
