import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
const { upsert, maybeSingle, from } = vi.hoisted(() => {
  const upsert = vi.fn(async () => ({ error: null }));
  const maybeSingle = vi.fn(async () => ({ data: { owner_id: "owner" }, error: null }));
  const from = vi.fn(() => ({ select: () => ({ eq: () => ({ maybeSingle }) }), upsert }));
  return { upsert, maybeSingle, from };
});
vi.mock("@/lib/suunto-server", async (original) => ({ ...await original<typeof import("@/lib/suunto-server")>(), adminDb: () => ({ from }) }));
import { POST } from "./route";

function webhook(body: string, signed = true) {
  return new Request("https://example.com/api/suunto/webhook", { method: "POST", body, headers: signed ? { "x-hmac-sha256-signature": createHmac("sha256", "test-secret").update(body).digest("hex") } : {} });
}
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
describe("Suunto webhook boundary", () => {
  it("stores signed health samples under the verified connection owner", async () => {
    vi.stubEnv("SUUNTO_WEBHOOK_SECRET", "test-secret");
    const event = JSON.stringify({ type: "SUUNTO_247_SLEEP_CREATED", username: "runner", samples: [{ timestamp: "2026-10-06T00:00:00Z", entryData: { SleepId: "night", Duration: 28800, owner_id: "attacker" } }] });
    expect((await POST(webhook(event))).status).toBe(200);
    expect(upsert).toHaveBeenCalledWith([expect.objectContaining({ owner_id: "owner", kind: "sleep", external_key: "night", entry_data: { SleepId: "night", Duration: 28800 } })], { onConflict: "owner_id,kind,external_key" });
  });
  it("rejects invalid health samples before contacting the database", async () => {
    vi.stubEnv("SUUNTO_WEBHOOK_SECRET", "test-secret");
    expect((await POST(webhook(JSON.stringify({ type: "SUUNTO_247_ACTIVITY_CREATED", username: "runner", samples: [{ timestamp: "bad", entryData: {} }] })))).status).toBe(400);
    expect(from).not.toHaveBeenCalled();
  });
  it("rejects unsigned events before contacting the database", async () => {
    vi.stubEnv("SUUNTO_WEBHOOK_SECRET", "test-secret");
    expect((await POST(webhook('{}', false))).status).toBe(401);
    expect(from).not.toHaveBeenCalled();
  });
  it("queues a signed workout durably without overwriting duplicates", async () => {
    vi.stubEnv("SUUNTO_WEBHOOK_SECRET", "test-secret");
    const event = JSON.stringify({ type: "WORKOUT_CREATED", username: "runner", workout: { workoutKey: "abc123" } });
    expect((await POST(webhook(event))).status).toBe(200);
    expect(upsert).toHaveBeenCalledWith({ username: "runner", workout_key: "abc123" }, { onConflict: "username,workout_key", ignoreDuplicates: true });
  });
  it("does not queue notifications for disconnected users", async () => {
    vi.stubEnv("SUUNTO_WEBHOOK_SECRET", "test-secret");
    maybeSingle.mockResolvedValueOnce({ data: null as unknown as { owner_id: string }, error: null });
    expect((await POST(webhook(JSON.stringify({ type: "WORKOUT_CREATED", username: "runner", workout: { workoutKey: "abc" } })))).status).toBe(200);
    expect(upsert).not.toHaveBeenCalled();
  });
  it("rejects malformed JSON and invalid workout keys", async () => {
    vi.stubEnv("SUUNTO_WEBHOOK_SECRET", "test-secret");
    expect((await POST(webhook('invalid-json'))).status).toBe(400);
    expect((await POST(webhook(JSON.stringify({ type: "WORKOUT_CREATED", username: "runner", workout: { workoutKey: "../bad" } })))).status).toBe(400);
    expect(from).not.toHaveBeenCalled();
  });
});
