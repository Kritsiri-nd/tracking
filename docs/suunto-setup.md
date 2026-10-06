# Suunto setup

The integration includes OAuth, encrypted server-side credentials, token refresh,
recent workout discovery, FIT review/import, disconnect, and signed webhook capture.
Webhook capture queues new workout keys. Load & save all imports every page of the
last 30 days directly into Progress, skipping saved workouts. Keep the Profile page
open during import. Downloads are spaced 8.5 seconds apart; each run is saved to
Supabase before proceeding. Stop import retains completed saves. This version does
not import workouts unattended when the app is closed.

1. Run `supabase/migrations/20261006_suunto.sql` in the Supabase SQL Editor.
   This migration is additive. Do not rerun `supabase/schema.sql` against existing data.
2. Set these private environment variables in Vercel and redeploy:

| Variable | Value |
| --- | --- |
| `SUUNTO_CLIENT_ID` | `1f67c51e-1cb2-4148-8b91-b327604b642f` |
| `SUUNTO_CLIENT_SECRET` | The secret you saved in Suunto OAuth settings |
| `SUUNTO_SUBSCRIPTION_KEY` | Primary key from the Active Developer API subscription |
| `SUUNTO_REDIRECT_URI` | `https://tracking-jet-three.vercel.app/api/suunto/callback` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase server service role key, never the public publishable key |
| `SUUNTO_TOKEN_ENCRYPTION_KEY` | Random 32-byte key encoded as 64 hex characters |
| `SUUNTO_WEBHOOK_SECRET` | Random secret matching Notification access secret in Suunto |

Keep `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` as configured.
Never put private keys in a `NEXT_PUBLIC_` variable or commit them. The encryption key
must remain stable; changing it makes existing stored tokens unreadable and requires
reconnecting. A local random key can be generated with:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

3. Suunto redirect: `/api/suunto/callback`; modern JSON workout notification URL:
   `https://tracking-jet-three.vercel.app/api/suunto/webhook`.
   Configure the matching notification secret before enabling Notification sending.
4. In Stridebook, sign in, open Profile, select Connect Suunto, and authorize your account.
5. Select Load & save all · last 30 days. All pages are imported directly into Progress.
   Review run remains available for individual file previews.
   Existing import matching prevents duplicate runs and links matching training plans.
6. Developer API allows 10 calls/minute and 200/week. Requests have an atomic
   per-account 8-second cooldown; multiple accounts still share the app subscription
   limit. Suunto quota errors are shown to the user. Production requires the separate
   Suunto production subscription process.

For localhost OAuth testing, add `http://localhost:3000/api/suunto/callback` as a
second redirect in Suunto and set `SUUNTO_REDIRECT_URI` locally to that exact value.
Webhooks require a publicly reachable HTTPS endpoint.

Deployment verification: status returns configuration error when env is absent;
unauthenticated API calls are denied; unsigned webhooks are denied; cancelled OAuth
returns to Profile with an error. Test actual authorization, FIT import and webhook
delivery after deploying with credentials and the migration.

References: https://apizone.suunto.com/how-to-start and https://apizone.suunto.com/webhooks
