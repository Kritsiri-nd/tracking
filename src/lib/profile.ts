import type { User } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import type { RunnerProfile } from "./types";

type AnyRow = Record<string, unknown>;

/** Convert the visible username into a stable internal Supabase Auth email. */
export function usernameToAuthEmail(username: string) {
  let hash = 2166136261;
  for (const character of username.trim().toLowerCase()) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  const projectDomain = (() => {
    try {
      return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname || "example.com";
    } catch {
      return "example.com";
    }
  })();
  return `u-${(hash >>> 0).toString(16)}@${projectDomain}`;
}

export function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

/** Return the runner's completed age for an ISO date without timezone drift. */
export function ageFromBirthDate(birthDate: string, today = new Date()) {
  const parts = birthDate.split("-").map(Number);
  if (parts.length !== 3 || parts.some((part) => !Number.isInteger(part))) return undefined;
  const [year, month, day] = parts;
  if (!year || !month || !day) return undefined;
  const age = today.getFullYear() - year - ((today.getMonth() + 1 < month || (today.getMonth() + 1 === month && today.getDate() < day)) ? 1 : 0);
  return age >= 10 && age <= 100 ? age : undefined;
}

/** Estimate Max HR with the Tanaka formula: 208 - (0.7 × age). */
export function estimateMaxHrFromBirthDate(birthDate?: string, today = new Date()) {
  if (!birthDate) return undefined;
  const age = ageFromBirthDate(birthDate, today);
  return age === undefined ? undefined : Math.round(208 - (0.7 * age));
}

export function defaultRunnerProfile(user?: Pick<User, "id" | "email" | "user_metadata">): RunnerProfile {
  const email = user?.email ?? "";
  const metadataUsername = typeof user?.user_metadata?.username === "string" ? user.user_metadata.username : email.split("@")[0] || "runner";
  const metadataName = typeof user?.user_metadata?.display_name === "string" ? user.user_metadata.display_name : metadataUsername;
  return {
    id: user?.id ?? "local-profile",
    email,
    username: metadataUsername,
    displayName: metadataName || email.split("@")[0] || "Runner",
    maxHr: 190,
  };
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function mapProfile(row: AnyRow, user: User): RunnerProfile {
  const fallback = defaultRunnerProfile(user);
  const birthDate = typeof row.birth_date === "string" && row.birth_date ? row.birth_date : undefined;
  const storedMaxHr = numberValue(row.max_hr);
  const estimatedMaxHr = estimateMaxHrFromBirthDate(birthDate);
  return {
    ...fallback,
    username: typeof row.username === "string" && row.username ? row.username : fallback.username,
    displayName: typeof row.display_name === "string" && row.display_name ? row.display_name : fallback.displayName,
    maxHr: storedMaxHr ?? estimatedMaxHr ?? fallback.maxHr,
    restingHr: numberValue(row.resting_hr),
    birthDate,
    heightCm: numberValue(row.height_cm),
    weightKg: numberValue(row.weight_kg),
    runningGoal: typeof row.running_goal === "string" && row.running_goal ? row.running_goal : undefined,
  };
}

/** Load the signed-in user's profile, creating the first row when needed. */
export async function loadRunnerProfile(user: User) {
  if (!supabase) return defaultRunnerProfile(user);
  const result = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (result.error) throw new Error(`Loading profile: ${result.error.message}`);
  if (result.data) {
    const row = result.data as AnyRow;
    const profile = mapProfile(row, user);
    if (profile.birthDate && profile.maxHr !== numberValue(row.max_hr)) await saveRunnerProfile(profile);
    return profile;
  }
  const profile = defaultRunnerProfile(user);
  await saveRunnerProfile(profile);
  return profile;
}

/** Persist editable profile fields without storing the email outside Supabase Auth. */
export async function saveRunnerProfile(profile: RunnerProfile) {
  if (!supabase) return;
  const result = await supabase.from("profiles").upsert({
    id: profile.id,
    username: profile.username,
    display_name: profile.displayName,
    max_hr: profile.maxHr,
    resting_hr: profile.restingHr ?? null,
    birth_date: profile.birthDate || null,
    height_cm: profile.heightCm ?? null,
    weight_kg: profile.weightKg ?? null,
    running_goal: profile.runningGoal || null,
    updated_at: new Date().toISOString(),
  }, { onConflict: "id" });
  if (result.error) throw new Error(`Saving profile: ${result.error.message}`);
}
