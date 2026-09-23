import { describe, expect, it } from "vitest";
import { ageFromBirthDate, estimateMaxHrFromBirthDate } from "./profile";

describe("Tanaka Max HR estimate", () => {
  const today = new Date("2026-09-23T00:00:00+07:00");

  it("calculates completed age without a timezone shift", () => {
    expect(ageFromBirthDate("1986-09-24", today)).toBe(39);
    expect(ageFromBirthDate("1986-09-23", today)).toBe(40);
  });

  it("uses 208 minus 0.7 times age", () => {
    expect(estimateMaxHrFromBirthDate("1986-09-23", today)).toBe(180);
  });

  it("ignores implausible birth dates", () => {
    expect(estimateMaxHrFromBirthDate("2019-09-23", today)).toBeUndefined();
  });
});
