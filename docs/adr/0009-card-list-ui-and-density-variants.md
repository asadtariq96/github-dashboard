# 0009: Signal-First Card List UI with Density Variants

We decided to replace the rigid table column layout with a full-width, signal-first card list architecture supporting user-toggled spacing density variants (`Compact List` vs `Spaced Cards`) and omitting neutral status badges.

## Context

A rigid 7-column table creates immense wasted horizontal space and forces repetitive rendering of neutral, low-signal badges (`Ready for Review`, `Blocked by Policy`, `0 comments`). PR titles were cramped while columns of identical status badges dominated the screen.

## Decision

1. **Full-Width Card Layout**:
   - Each PR is rendered as a clean card/row where the title and metadata take the entire primary width.
   - Status indicators are rendered as inline signal pills beneath the metadata.
2. **Signal-First Badging (Omit Neutral States)**:
   - Neutral baseline states (`0 unresolved comments`, `Ready for review`, `Blocked by policy`, `No checks`) are omitted entirely to maximize signal-to-noise ratio.
   - Only active blockers (`Failing Checks`, `Changes Requested`, `Unresolved Comments`, `Merge Conflicts`), milestones (`Approved`, `In Merge Queue`, `Waiting Approval`), or exceptional states (`Draft`, `Stacked`) render badges.
3. **Density Variants**:
   - Provide a persistent toggle in the header allowing the user to switch between:
     - **Compact List**: Single continuous bordered list container with subtle separators (Linear/GitHub style).
     - **Spaced Cards**: Distinct rounded cards with discrete elevation/borders and padding.

## Consequences

- 100% of PR titles and repo/branch names are visible without horizontal clipping.
- Immediate visual triage — only PRs with actual action items or progress have visible badges.
- Flexibility for the user to select their preferred visual density.
