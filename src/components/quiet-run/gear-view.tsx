"use client";

import { Footprints, PackageOpen, Route, X } from "lucide-react";
import { FormEvent, useState } from "react";
import type { LocalState, PersonId, Shoe } from "@/lib/types";
import { GlassCard, Metric } from "./shared";

/** Gear management for active running shoes, mileage, photos, and retirement. */
export function GearView({ state, personId, onShoeAdd, onShoeUpdate, onShoeRetire, onShoeImageChange }: { state: LocalState; personId: PersonId; onShoeAdd: (shoe: Shoe, imageFile?: File) => Promise<void>; onShoeUpdate: (shoeId: string, updates: Partial<Shoe>) => Promise<void>; onShoeRetire: (shoeId: string) => Promise<void>; onShoeImageChange: (shoeId: string, file: File) => Promise<void> }) {
  const [shoeName, setShoeName] = useState("");
  const [shoeBrand, setShoeBrand] = useState("");
  const [shoeModel, setShoeModel] = useState("");
  const [shoeMaxDistance, setShoeMaxDistance] = useState("800");
  const [shoeImage, setShoeImage] = useState<File>();
  const [shoeSaving, setShoeSaving] = useState(false);
  const [shoeError, setShoeError] = useState<string>();
  const [editingShoe, setEditingShoe] = useState<Shoe>();
  const [editName, setEditName] = useState("");
  const [editBrand, setEditBrand] = useState("");
  const [editModel, setEditModel] = useState("");
  const [editMaxDistance, setEditMaxDistance] = useState("");
  const [editError, setEditError] = useState<string>();
  const activities = state.activities.filter((activity) => activity.personId === personId);
  const shoes = state.shoes.filter((shoe) => shoe.personId === personId && !shoe.retired);
  const shoeUsage = shoes.map((shoe) => ({ shoe, distance: activities.filter((activity) => activity.shoeId === shoe.id).reduce((sum, activity) => sum + activity.distanceKm, 0) }));
  const totalDistance = shoeUsage.reduce((sum, item) => sum + item.distance, 0);

  async function addShoe(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const maxDistanceKm = Number(shoeMaxDistance);
    if (!shoeName.trim() || !Number.isFinite(maxDistanceKm) || maxDistanceKm <= 0) return;
    setShoeSaving(true);
    setShoeError(undefined);
    try {
      await onShoeAdd({ id: "shoe-" + Date.now(), personId, name: shoeName.trim(), brand: shoeBrand.trim() || undefined, model: shoeModel.trim() || undefined, maxDistanceKm }, shoeImage);
      setShoeName("");
      setShoeBrand("");
      setShoeModel("");
      setShoeMaxDistance("800");
      setShoeImage(undefined);
    } catch (error) {
      setShoeError(error instanceof Error ? error.message : "Could not save the shoe.");
    } finally {
      setShoeSaving(false);
    }
  }

  function openShoeEditor(shoe: Shoe) {
    setEditingShoe(shoe);
    setEditName(shoe.name);
    setEditBrand(shoe.brand ?? "");
    setEditModel(shoe.model ?? "");
    setEditMaxDistance(String(shoe.maxDistanceKm));
    setEditError(undefined);
  }

  async function saveShoe(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingShoe || !editName.trim()) return;
    const maxDistanceKm = Number(editMaxDistance);
    if (!Number.isFinite(maxDistanceKm) || maxDistanceKm <= 0) {
      setEditError("Enter a maximum distance greater than 0 km.");
      return;
    }
    try {
      await onShoeUpdate(editingShoe.id, { name: editName.trim(), brand: editBrand.trim() || undefined, model: editModel.trim() || undefined, maxDistanceKm });
      setEditingShoe(undefined);
    } catch (error) {
      setEditError(error instanceof Error ? error.message : "Could not update the shoe.");
    }
  }

  return (
    <div className="space-y-5">
      <div><p className="text-sm text-[#7d8078]">Shoes and equipment</p><h1 className="mt-1 text-[34px] font-medium tracking-[-.055em]">Gear</h1><p className="mt-2 max-w-lg text-sm leading-6 text-[#73776f]">Keep your running shoes in one place and see how much distance each pair has covered.</p></div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3"><Metric label="Active shoes" value={String(shoes.length)} icon={PackageOpen} /><Metric label="Distance logged" value={totalDistance.toFixed(1)} suffix="km" icon={Route} /><Metric label="With photos" value={String(shoes.filter((shoe) => Boolean(shoe.imageUrl)).length)} icon={Footprints} /></div>
      <GlassCard className="p-5 sm:p-6">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-[#85887f]">Shoe tracking</p><h2 className="mt-1 text-xl font-medium">Running shoes</h2></div><PackageOpen className="text-[#bd755c]" size={21} /></div>
        <div className="space-y-3">{shoeUsage.length ? shoeUsage.map(({ shoe, distance }) => { const percentage = Math.min(100, distance / shoe.maxDistanceKm * 100); return <div key={shoe.id} className="rounded-2xl border border-white/70 bg-white/42 p-4"><div className="flex items-start gap-3"><div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-2xl bg-[#dce4d7] text-[#53644e]">{shoe.imageUrl ? <div role="img" aria-label={`${shoe.name} photo`} className="size-full bg-cover bg-center" style={{ backgroundImage: `url(${shoe.imageUrl})` }} /> : <Footprints size={23} />}</div><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><div><div className="font-semibold">{shoe.name}</div><div className="mt-1 text-xs text-[#858880]">{[shoe.brand, shoe.model].filter(Boolean).join(" · ") || "Custom shoe"} · {distance.toFixed(1)} / {shoe.maxDistanceKm} km</div></div><span className="text-xs font-semibold text-[#7b6334]">{Math.round(percentage)}%</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-[#e9e6dc]"><div className="h-full rounded-full bg-[#bd755c]" style={{ width: String(percentage) + "%" }} /></div><div className="mt-3 flex flex-wrap items-center gap-3"><label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-[#687362]">{shoe.imageUrl ? "Change photo" : "Add photo"}<input type="file" accept="image/*" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) void onShoeImageChange(shoe.id, file); }} /></label><button type="button" onClick={() => openShoeEditor(shoe)} className="tap text-xs font-semibold text-[#687362]">Edit</button><button type="button" onClick={() => void onShoeRetire(shoe.id)} className="tap text-xs font-semibold text-[#92514d]">Retire</button></div></div></div></div>; }) : <div className="rounded-2xl border border-dashed border-[#343b34]/12 p-4 text-sm text-[#858880]">No running shoes yet. Add your first pair below.</div>}</div>
        <form onSubmit={addShoe} className="mt-5 grid gap-3 border-t border-[#343b34]/8 pt-5 sm:grid-cols-4 sm:items-end"><label className="text-xs font-medium text-[#72766d]">Shoe name<input required value={shoeName} onChange={(event) => setShoeName(event.target.value)} placeholder="Daily trainer" className="mt-1.5 h-11 w-full rounded-2xl border border-[#343b34]/10 bg-white/55 px-3 text-sm outline-none focus:border-[#7f9277]" /></label><label className="text-xs font-medium text-[#72766d]">Brand<input value={shoeBrand} onChange={(event) => setShoeBrand(event.target.value)} placeholder="ASICS" className="mt-1.5 h-11 w-full rounded-2xl border border-[#343b34]/10 bg-white/55 px-3 text-sm outline-none focus:border-[#7f9277]" /></label><label className="text-xs font-medium text-[#72766d]">Model<input value={shoeModel} onChange={(event) => setShoeModel(event.target.value)} placeholder="Novablast" className="mt-1.5 h-11 w-full rounded-2xl border border-[#343b34]/10 bg-white/55 px-3 text-sm outline-none focus:border-[#7f9277]" /></label><label className="text-xs font-medium text-[#72766d]">Max distance (km)<input type="number" min="1" value={shoeMaxDistance} onChange={(event) => setShoeMaxDistance(event.target.value)} className="mt-1.5 h-11 w-full rounded-2xl border border-[#343b34]/10 bg-white/55 px-3 text-sm outline-none focus:border-[#7f9277]" /></label><label className="text-xs font-medium text-[#72766d]">Shoe photo<input type="file" accept="image/*" onChange={(event) => setShoeImage(event.target.files?.[0])} className="mt-1.5 block w-full text-xs text-[#72766d] file:mr-2 file:rounded-full file:border-0 file:bg-[#dce4d7] file:px-3 file:py-2 file:text-xs file:font-semibold file:text-[#53644e]" /></label><button type="submit" disabled={shoeSaving} className="tap h-11 rounded-2xl bg-[#343b34] text-sm font-semibold text-white disabled:opacity-60 sm:col-span-3">{shoeSaving ? "Saving…" : "Add shoe"}</button>{shoeError && <p role="alert" className="text-xs font-medium text-[#92514d] sm:col-span-4">{shoeError}</p>}</form>
      </GlassCard>
      {editingShoe && <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#293029]/30 p-0 backdrop-blur-sm sm:items-center sm:p-5" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditingShoe(undefined); }}><GlassCard className="w-full max-w-lg rounded-b-none rounded-t-[28px] p-5 sm:rounded-[28px] sm:p-6" role="dialog" aria-modal="true" aria-label="Edit shoe"><div className="mb-5 flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-[#85887f]">Gear</p><h2 className="mt-1 text-2xl font-medium">Edit shoe</h2></div><button type="button" aria-label="Close shoe editor" onClick={() => setEditingShoe(undefined)} className="tap grid size-9 place-items-center rounded-2xl bg-white/55"><X size={18} /></button></div><form onSubmit={saveShoe} className="space-y-4"><label className="block text-xs font-medium text-[#72766d]">Shoe name<input required value={editName} onChange={(event) => setEditName(event.target.value)} className="mt-1.5 h-12 w-full rounded-2xl border border-[#343b34]/10 bg-white/55 px-3 text-sm outline-none focus:border-[#7f9277]" /></label><div className="grid gap-3 sm:grid-cols-2"><label className="block text-xs font-medium text-[#72766d]">Brand<input value={editBrand} onChange={(event) => setEditBrand(event.target.value)} className="mt-1.5 h-12 w-full rounded-2xl border border-[#343b34]/10 bg-white/55 px-3 text-sm outline-none focus:border-[#7f9277]" /></label><label className="block text-xs font-medium text-[#72766d]">Model<input value={editModel} onChange={(event) => setEditModel(event.target.value)} className="mt-1.5 h-12 w-full rounded-2xl border border-[#343b34]/10 bg-white/55 px-3 text-sm outline-none focus:border-[#7f9277]" /></label></div><label className="block text-xs font-medium text-[#72766d]">Max distance (km)<input type="number" min="1" required value={editMaxDistance} onChange={(event) => setEditMaxDistance(event.target.value)} className="mt-1.5 h-12 w-full rounded-2xl border border-[#343b34]/10 bg-white/55 px-3 text-sm outline-none focus:border-[#7f9277]" /></label>{editError && <p role="alert" className="rounded-2xl bg-[#ead9d7]/70 px-3 py-2 text-xs text-[#92514d]">{editError}</p>}<div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => setEditingShoe(undefined)} className="tap rounded-2xl border border-[#343b34]/12 bg-white/45 text-sm font-semibold">Cancel</button><button type="submit" className="tap rounded-2xl bg-[#343b34] text-sm font-semibold text-white">Save changes</button></div></form></GlassCard></div>}
    </div>
  );
}


