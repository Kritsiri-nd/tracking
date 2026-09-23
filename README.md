# Stridebook — Draft 1

Mobile-first local prototype for two runners using Suunto and COROS watches.

## Included

- Today dashboard and shared recent activity feed
- Weekly training calendar with quick workout creation
- FIT-only import, local parse, preview, duplicate protection, and plan matching
- Activity detail with route placeholder, HR chart, metrics, and laps
- Progress analytics for distance, pace, HR, workout type, and planned vs actual
- Two local runner profiles with a quick profile switch
- Stridebook branding with a warm, minimal UI and soft glass surfaces
- PWA manifest, app icon, and production service worker
- Browser `localStorage` persistence (no Supabase credentials required)

## Commands

```bash
npm run dev
npm run lint
npm run typecheck
npm test
npm run build
```

Open [http://localhost:3000](http://localhost:3000) after running `npm run dev`.

## Draft limitations

- Local browser data only; clearing site data resets the draft.
- Map is a visual placeholder until GPS coordinates are wired to a map library.
- FIT parsing is implemented for standard session, lap, and record fields. A COROS FIT sample should be added to the next compatibility pass.
- Authentication, Supabase, cloud file storage, automatic watch sync, sleep data, and AI coaching are intentionally out of scope.
