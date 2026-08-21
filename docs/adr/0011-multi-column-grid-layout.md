# 0011: Multi-Column Responsive Grid and Spacing Density Configurations

We decided to support customizable multi-column card grids (1, 2, 3, or 4 columns, auto-responsive) alongside persistent density controls saved in local storage.

## Context

On wide monitors (e.g., Ultrawide or 4K screens), full-width single-column cards leave wide empty gaps on the right side of short PR metadata. Users want to configure multi-column grid layouts (e.g. 2, 3, or 4 cards per row) while ensuring cards naturally collapse down on smaller screens.

## Decision

1. **Grid Column Selectors**:
   - Provide a persistent column switcher:
     - `1 Col`: Full-width stack (`grid-cols-1`).
     - `2 Cols`: Dual-column grid on desktop (`grid-cols-1 lg:grid-cols-2`).
     - `3 Cols`: Three-column grid on wide screens (`grid-cols-1 md:grid-cols-2 xl:grid-cols-3`).
     - `4 Cols`: Four-column dense grid on wide screens (`grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4`).
   - Store selection in `localStorage` under `gh_dashboard_grid_cols`.
2. **Compact Card Typography & Tight Spacing**:
   - Tighten internal card padding and margins so cards fit cleanly in multi-column layouts without awkward wrapping.
   - Expandable drawers span the full width within their respective card container with scrollable inspection views.

## Consequences

- Highly efficient screen utilization on large monitors.
- User can tailor layout density to their monitor width and personal workflow.
