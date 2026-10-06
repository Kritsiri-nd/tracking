import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => {
  const pages: unknown[][] = [];
  const eq = vi.fn();
  const range = vi.fn(async () => ({ data: pages.shift() ?? [], error: null }));
  const chain = { eq, gte: vi.fn(), lt: vi.fn(), order: vi.fn(), range };
  const from = vi.fn((table: string) => ({ select: () => table === "suunto_health_sync" ? { eq: async (field: string, owner: string) => { eq(field, owner); return { data: [], error: null }; } } : chain }));
  const requireOwner = vi.fn(async () => ({ db: { from }, owner: "verified-owner" }));
  return { pages, eq, chain, from, requireOwner };
});
vi.mock("@/lib/suunto-server", async (original) => ({ ...await original<typeof import("@/lib/suunto-server")>(), requireOwner: mocks.requireOwner }));
import { GET } from "./route";
import { SuuntoError } from "@/lib/suunto-server";

beforeEach(() => {
  vi.clearAllMocks(); mocks.pages.length = 0;
  mocks.eq.mockReturnValue(mocks.chain);
  mocks.chain.gte.mockReturnValue(mocks.chain);
  mocks.chain.lt.mockReturnValue(mocks.chain);
  mocks.chain.order.mockReturnValue(mocks.chain);
});
const request = (range = "from=1791158400000&to=1791244800000") => new Request(`https://example.com/api/suunto/health?${range}&owner=attacker`);
describe("Health read boundary", () => {
  it("paginates beyond Supabase's 1000 rows and uses the authenticated owner", async () => {
    mocks.pages.push(Array.from({ length: 1000 }, (_, i) => ({ external_key: String(i) })), [{ external_key: "last" }]);
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect((await response.json()).samples).toHaveLength(1001);
    expect(mocks.eq).toHaveBeenCalledWith("owner_id", "verified-owner");
    expect(mocks.eq).not.toHaveBeenCalledWith("owner_id", "attacker");
    expect(mocks.chain.range).toHaveBeenNthCalledWith(2, 1000, 1999);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
  it("rejects invalid dates before querying tables", async () => {
    expect((await GET(request("from=1&to=9999999999999"))).status).toBe(400);
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("does not query health data when authentication fails", async () => {
    mocks.requireOwner.mockRejectedValueOnce(new SuuntoError("Sign in", 401));
    expect((await GET(request())).status).toBe(401);
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
