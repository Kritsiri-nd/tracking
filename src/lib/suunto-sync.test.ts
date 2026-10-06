import { describe, expect, it, vi } from "vitest";
import { syncSuuntoWorkouts } from "./suunto-sync";
import type { Activity } from "./types";

function setup() {
  return {
    list: vi.fn(async () => ({ workouts: [{ workoutKey: "new" }], nextOffset: null as number | null })),
    download: vi.fn(async (workout: { workoutKey: string }) => ({ id: workout.workoutKey } as Activity)),
    save: vi.fn(async () => true), alreadySaved: vi.fn(() => false),
    wait: vi.fn(async () => undefined), progress: vi.fn(), signal: new AbortController().signal,
  };
}
describe("Suunto automatic import", () => {
  it("saves every page and avoids re-downloading existing or repeated workouts", async () => {
    const options = setup();
    options.list.mockResolvedValueOnce({ workouts: [{ workoutKey: "existing" }, { workoutKey: "new" }], nextOffset: 20 });
    options.list.mockResolvedValueOnce({ workouts: [{ workoutKey: "new" }, { workoutKey: "second" }], nextOffset: null });
    options.alreadySaved.mockImplementation((key?: string) => key === "existing");
    expect(await syncSuuntoWorkouts(options)).toEqual({ saved: 2, skipped: 1, failed: [] });
    expect(options.list.mock.calls).toEqual([[0], [20]]);
    expect(options.download).toHaveBeenCalledTimes(2);
    expect(options.save).toHaveBeenCalledTimes(2);
  });
  it("retains successful saves and reports a failed FIT without dropping later runs", async () => {
    const options = setup();
    options.list.mockResolvedValueOnce({ workouts: [{ workoutKey: "bad" }, { workoutKey: "good" }], nextOffset: null });
    options.download.mockRejectedValueOnce(new Error("Invalid FIT"));
    const result = await syncSuuntoWorkouts(options);
    expect(result.saved).toBe(1);
    expect(result.failed).toEqual(["bad: Invalid FIT"]);
  });
  it("stops requesting files once the subscription quota is exhausted", async () => {
    const options = setup();
    options.list.mockResolvedValueOnce({ workouts: [{ workoutKey: "one" }, { workoutKey: "two" }], nextOffset: null });
    options.download.mockRejectedValueOnce(Object.assign(new Error("Quota"), { status: 429 }));
    await expect(syncSuuntoWorkouts(options)).rejects.toMatchObject({ status: 429 });
    expect(options.download).toHaveBeenCalledTimes(1);
  });
  it("does not start requests after cancellation", async () => {
    const options = setup();
    const controller = new AbortController(); controller.abort(); options.signal = controller.signal;
    await expect(syncSuuntoWorkouts(options)).rejects.toThrow();
    expect(options.list).not.toHaveBeenCalled();
  });
});
