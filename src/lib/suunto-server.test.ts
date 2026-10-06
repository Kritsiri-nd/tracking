import { afterEach, describe, expect, it, vi } from "vitest";
import { apiError, requireOwner, SuuntoError, tokenUsername } from "./suunto-server";

afterEach(() => vi.unstubAllGlobals());
describe("Suunto authentication", () => {
  it("rejects unauthenticated calls before database setup or network access", async () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    await expect(requireOwner(new Request("https://example.com"))).rejects.toMatchObject({ status: 401 });
    expect(fetch).not.toHaveBeenCalled();
  });
  it("does not include internal errors or tokens in public error messages", async () => {
    expect(await apiError(new Error("private-secret")).text()).not.toContain("private-secret");
    expect(apiError(new SuuntoError("Sign in", 401)).status).toBe(401);
  });
  it("uses the token exchange user field or documented JWT user claim", () => {
    const tokens = { access_token: `header.${Buffer.from(JSON.stringify({ user: "suunto-user" })).toString("base64url")}.signature`, refresh_token: "refresh", expires_in: 86400 };
    expect(tokenUsername(tokens)).toBe("suunto-user");
    expect(tokenUsername({ ...tokens, user: "response-user" })).toBe("response-user");
    expect(tokenUsername({ ...tokens, access_token: "invalid" })).toBeUndefined();
  });
});
