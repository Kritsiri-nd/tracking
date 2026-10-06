import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { openToken, sealToken, verifySuuntoSignature } from "./suunto-security";

describe("Suunto credential protection", () => {
  const key = "ab".repeat(32);
  it("encrypts credentials with a different nonce each time", () => {
    const first = sealToken("private-refresh-token", key);
    expect(first).not.toContain("private-refresh-token");
    expect(first).not.toBe(sealToken("private-refresh-token", key));
    expect(openToken(first, key)).toBe("private-refresh-token");
  });
  it("rejects changed ciphertext and incorrect keys", () => {
    const sealed = sealToken("token", key);
    const parts = sealed.split(".");
    parts[1] = Buffer.alloc(16).toString("base64url");
    expect(() => openToken(parts.join("."), key)).toThrow();
    expect(() => openToken(sealed, "cd".repeat(32))).toThrow();
  });
  it("checks the signature against the exact raw webhook bytes", () => {
    const body = '{"type":"WORKOUT_CREATED"}';
    const signature = createHmac("sha256", "secret").update(body).digest("hex");
    expect(verifySuuntoSignature(body, signature, "secret")).toBe(true);
    expect(verifySuuntoSignature(`${body} `, signature, "secret")).toBe(false);
    expect(verifySuuntoSignature(body, signature, "wrong")).toBe(false);
    expect(verifySuuntoSignature(body, null, "secret")).toBe(false);
    expect(verifySuuntoSignature(body, "invalid", "secret")).toBe(false);
  });
});
