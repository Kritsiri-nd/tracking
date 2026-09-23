import { describe, expect, it } from "vitest";
import { getBangkokDateKey, getBangkokWeekDates, shiftBangkokDateKey } from "./date";

describe("Bangkok date helpers", () => {
  it("uses Bangkok time when UTC is still the previous day", () => {
    expect(getBangkokDateKey(new Date("2026-09-21T17:30:00.000Z"))).toBe("2026-09-22");
  });

  it("returns a Monday-to-Sunday week", () => {
    expect(getBangkokWeekDates("2026-09-22")).toEqual([
      "2026-09-21",
      "2026-09-22",
      "2026-09-23",
      "2026-09-24",
      "2026-09-25",
      "2026-09-26",
      "2026-09-27",
    ]);
  });

  it("shifts week navigation dates across month boundaries", () => {
    expect(shiftBangkokDateKey("2026-09-28", 7)).toBe("2026-10-05");
    expect(shiftBangkokDateKey("2026-09-28", -7)).toBe("2026-09-21");
  });
});
