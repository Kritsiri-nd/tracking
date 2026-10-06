# Suunto health sync

Apply `supabase/migrations/20261006_suunto_health.sql` after the original Suunto migration. This only adds health tables; do not rerun the legacy root schema against an existing database.

Profile → Suunto → **Load & save all Suunto data** saves recent workouts directly to Progress and then fetches all four health categories. Progress → Health can sync any 1–28 day window independently. Repeat adjacent windows to retain older history. Historical data stays in Supabase after syncing another window. A stopped or failed batch retains completed saves and reports errors per category.

The four APIs are sleep, daily activity statistics, activity samples and recovery. Measurements depend on the watch and subscription's 24/7 API access. Missing values remain blank. Duration uses seconds, HRV milliseconds, energy joules (converted to kcal), and oxygen/body-resource ratios are converted to percentages. Dates display in Bangkok time. Daily device sources remain separate. Null duplicate daily totals do not overwrite populated totals in the same response. Tables page through every saved sample; dense charts sample up to 1,000 points.

Health endpoints require a verified Supabase user and always filter by that owner. Browser clients cannot access the health tables directly: RLS is enabled and anon/authenticated table privileges are revoked. The existing server service-role credential handles persistence. No new client-side secrets are needed.

Optional push notifications use the existing `/api/suunto/webhook` endpoint for `SUUNTO_247_ACTIVITY_CREATED`, `SUUNTO_247_SLEEP_CREATED` and `SUUNTO_247_RECOVERY_CREATED`. These are accepted only when the raw-body HMAC signature matches `SUUNTO_WEBHOOK_SECRET`. Configure matching notification secret and URLs in the Suunto portal before enabling notifications. Polling through the sync button works independently of notifications. Workout notifications are queued; automatic FIT processing is not performed by the webhook.

Official API reference: https://apizone.suunto.com/api-details#api=new-247-api
Webhook reference: https://apizone.suunto.com/webhooks
