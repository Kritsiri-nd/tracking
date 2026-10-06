import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { expect, it, vi } from "vitest";

it("keeps private health and cross-origin Supabase requests out of the offline cache", () => {
  const handlers: Record<string, (event: { request: Request; respondWith: ReturnType<typeof vi.fn> }) => void> = {};
  runInNewContext(readFileSync("public/sw.js", "utf8"), { URL, self: { location: { origin: "https://app.example" }, addEventListener: (name: string, handler: typeof handlers[string]) => { handlers[name] = handler; } } });
  for (const request of [new Request("https://app.example/api/suunto/health"), new Request("https://db.supabase.co/rest/v1/activities"), new Request("https://app.example/private", { headers: { Authorization: "Bearer test" } })]) {
    const respondWith = vi.fn(); handlers.fetch({ request, respondWith });
    expect(respondWith).not.toHaveBeenCalled();
  }
});
