"use client";

import { ArrowLeft, LogOut, PackageOpen, Save, UserRound } from "lucide-react";
import { useState } from "react";
import { ageFromBirthDate, estimateMaxHrFromBirthDate } from "@/lib/profile";
import type { RunnerProfile } from "@/lib/types";
import { GlassCard } from "./shared";

type ProfileViewProps = {
  profile: RunnerProfile;
  onBack: () => void;
  onOpenGear: () => void;
  onSave: (profile: RunnerProfile) => Promise<void>;
  onSignOut?: () => void;
};

function numberOrUndefined(value: string) {
  const parsed = Number(value);
  return value && Number.isFinite(parsed) ? parsed : undefined;
}

/** Account settings and runner baselines used by activity analysis. */
export function ProfileView({ profile, onBack, onOpenGear, onSave, onSignOut }: ProfileViewProps) {
  const [form, setForm] = useState(() => ({
    ...profile,
    maxHr: estimateMaxHrFromBirthDate(profile.birthDate) ?? profile.maxHr,
  }));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string>();
  const estimatedMaxHr = estimateMaxHrFromBirthDate(form.birthDate);
  const age = form.birthDate ? ageFromBirthDate(form.birthDate) : undefined;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setSaved(false);
    setError(undefined);
    try {
      await onSave({ ...form, maxHr: Math.min(240, Math.max(100, Math.round(form.maxHr || 190))) });
      setSaved(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save your profile.");
    } finally {
      setSaving(false);
    }
  }

  function changeBirthDate(birthDate: string) {
    const nextBirthDate = birthDate || undefined;
    setForm((current) => ({
      ...current,
      birthDate: nextBirthDate,
      maxHr: estimateMaxHrFromBirthDate(nextBirthDate) ?? current.maxHr,
    }));
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={onBack} className="tap flex items-center gap-2 rounded-full bg-white/45 px-4 py-2 text-sm font-semibold"><ArrowLeft size={17} />Back</button>
          <button type="button" onClick={onOpenGear} className="tap flex items-center gap-2 rounded-full bg-white/45 px-4 py-2 text-sm font-semibold"><PackageOpen size={16} />Gear</button>
        </div>
        {onSignOut && <button type="button" onClick={onSignOut} className="tap flex items-center gap-2 rounded-full bg-[#ead9d7]/70 px-4 py-2 text-sm font-semibold text-[#874e49]"><LogOut size={16} />Sign out</button>}
      </div>

      <div><p className="text-sm text-[#7d8078]">Account settings</p><h1 className="mt-1 text-[34px] font-medium tracking-[-.055em]">Your profile</h1><p className="mt-1 text-sm text-[#777b73]">Set the basics Stridebook uses to understand your training.</p></div>

      <form onSubmit={submit} className="grid gap-5 lg:grid-cols-[1fr_.8fr]">
        <GlassCard className="p-5 sm:p-6">
          <div className="flex items-center gap-3"><div className="grid size-12 place-items-center rounded-2xl bg-[#dce4d7] text-[#53644e]"><UserRound size={22} /></div><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-[#85887f]">Runner identity</p><h2 className="mt-1 text-lg font-medium">About you</h2></div></div>
          <div className="mt-6 space-y-4">
            <label className="block text-sm font-semibold text-[#5e665c]">Username<input value={form.username} readOnly className="mt-2 h-11 w-full rounded-2xl border border-[#343b34]/8 bg-[#f1f3ec]/70 px-3 text-sm text-[#858880] outline-none" /></label>
            <label className="block text-sm font-semibold text-[#5e665c]">Display name<input value={form.displayName} onChange={(event) => setForm((current) => ({ ...current, displayName: event.target.value }))} className="mt-2 h-11 w-full rounded-2xl border border-[#343b34]/10 bg-white/65 px-3 text-sm outline-none focus:border-[#7f9277]" /></label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-semibold text-[#5e665c]">Date of birth<input type="date" value={form.birthDate ?? ""} onChange={(event) => changeBirthDate(event.target.value)} className="mt-2 h-11 w-full rounded-2xl border border-[#343b34]/10 bg-white/65 px-3 text-sm outline-none focus:border-[#7f9277]" /></label>
              <label className="block text-sm font-semibold text-[#5e665c]">Running goal<input value={form.runningGoal ?? ""} onChange={(event) => setForm((current) => ({ ...current, runningGoal: event.target.value || undefined }))} placeholder="Build a steady base" className="mt-2 h-11 w-full rounded-2xl border border-[#343b34]/10 bg-white/65 px-3 text-sm outline-none focus:border-[#7f9277]" /></label>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-5 sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#85887f]">Training baselines</p><h2 className="mt-1 text-lg font-medium">Heart rate & body</h2><p className="mt-1 text-xs leading-5 text-[#858880]">Max HR is used for every activity&apos;s Zone 1-5 breakdown.</p>
          <div className="mt-6 space-y-4">
            <label className="block text-sm font-semibold text-[#5e665c]">Max HR<input required type="number" min="100" max="240" readOnly={Boolean(estimatedMaxHr)} value={form.maxHr} onChange={(event) => setForm((current) => ({ ...current, maxHr: Number(event.target.value) }))} className="mt-2 h-11 w-full rounded-2xl border border-[#343b34]/10 bg-white/65 px-3 text-sm outline-none focus:border-[#7f9277] read-only:cursor-not-allowed read-only:opacity-75" /><span className="mt-1 block text-xs font-normal text-[#858880]">{estimatedMaxHr ? `Tanaka estimate from age ${age} · ${estimatedMaxHr} bpm. Applied automatically from your date of birth.` : "Add your date of birth to estimate Max HR with the Tanaka formula, or enter a tested value."}</span></label>
            <label className="block text-sm font-semibold text-[#5e665c]">Resting HR <span className="font-normal text-[#858880]">(optional)</span><input type="number" min="30" max="120" value={form.restingHr ?? ""} onChange={(event) => setForm((current) => ({ ...current, restingHr: numberOrUndefined(event.target.value) }))} className="mt-2 h-11 w-full rounded-2xl border border-[#343b34]/10 bg-white/65 px-3 text-sm outline-none focus:border-[#7f9277]" /></label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-semibold text-[#5e665c]">Height <span className="font-normal text-[#858880]">cm</span><input type="number" min="80" max="250" value={form.heightCm ?? ""} onChange={(event) => setForm((current) => ({ ...current, heightCm: numberOrUndefined(event.target.value) }))} className="mt-2 h-11 w-full rounded-2xl border border-[#343b34]/10 bg-white/65 px-3 text-sm outline-none focus:border-[#7f9277]" /></label>
              <label className="block text-sm font-semibold text-[#5e665c]">Weight <span className="font-normal text-[#858880]">kg</span><input type="number" min="20" max="300" step="0.1" value={form.weightKg ?? ""} onChange={(event) => setForm((current) => ({ ...current, weightKg: numberOrUndefined(event.target.value) }))} className="mt-2 h-11 w-full rounded-2xl border border-[#343b34]/10 bg-white/65 px-3 text-sm outline-none focus:border-[#7f9277]" /></label>
            </div>
          </div>
          {error && <p role="alert" className="mt-4 rounded-2xl bg-[#ead9d7] px-4 py-3 text-sm leading-5 text-[#874e49]">{error}</p>}
          <div className="mt-6 flex items-center justify-between gap-3"><span className="text-xs font-semibold text-[#53644e]">{saved ? "Saved to your profile" : "Changes are private to your account"}</span><button disabled={saving} className="tap inline-flex items-center gap-2 rounded-2xl bg-[#343b34] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"><Save size={16} />{saving ? "Saving..." : "Save profile"}</button></div>
        </GlassCard>
      </form>
    </div>
  );
}
