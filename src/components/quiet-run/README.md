# Stridebook component map

The app is split by responsibility so changes stay local to one feature:

- `app-shell.tsx` owns Supabase bootstrapping, shared state, navigation, and mutations.
- `navigation.tsx` contains the desktop sidebar, mobile navigation, header, and cloud status.
- `today-view.tsx` contains the weekly Planned & Actual workflow.
- `plan-view.tsx` contains the monthly calendar, mobile agenda, filters, and plan editor.
- `import-view.tsx` contains the FIT choose/review/save workflow.
- `progress-view.tsx` contains Overview, Goals, and Statistics.
- `gear-view.tsx` contains shoe tracking, photo upload, edit, and retirement.
- `activity-detail.tsx` and `route-preview.tsx` contain imported-run details and GPS rendering.
- `shared.tsx` contains reusable cards, metrics, status pills, labels, and date helpers.

Keep database writes in `app-shell.tsx` and `src/lib/supabase-sync.ts`. Page components should receive data and callbacks through props instead of calling Supabase directly.
