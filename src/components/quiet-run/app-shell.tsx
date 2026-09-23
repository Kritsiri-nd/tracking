"use client";

import { Lottie } from "lottie-react";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getBangkokDateKey, getBangkokWeekDates, shiftBangkokDateKey } from "@/lib/date";
import { parseFitFile } from "@/lib/fit";
import { findMatchingWorkout, isDuplicateActivity } from "@/lib/import-logic";
import { getWorkoutStatus } from "@/lib/progress";
import { initialState } from "@/lib/mock-data";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { defaultRunnerProfile, loadRunnerProfile, saveRunnerProfile } from "@/lib/profile";
import { deleteWorkoutFromSupabase, loadCloudState, syncStateToSupabase, uploadShoeImage } from "@/lib/supabase-sync";
import { downloadGpx } from "@/lib/download";
import type { Activity, LocalState, MonthlyGoal, PlannedWorkout, RunnerProfile, Shoe } from "@/lib/types";
import energyAnimation from "@/lib/energy-herbamojo.json";
import { ActivityDetail } from "./activity-detail";
import { AuthView } from "./auth-view";
import { GearView } from "./gear-view";
import { Header, Nav } from "./navigation";
import { ProgressView } from "./progress-view";
import { TodayView } from "./today-view";
import { CalendarView } from "./plan-view";
import { UploadView } from "./import-view";
import { ProfileView } from "./profile-view";
import { Tab } from "./shared";

export function QuietRunApp() {
  const [state, setState] = useState<LocalState>(initialState);
  const [profile, setProfile] = useState<RunnerProfile>(() => defaultRunnerProfile());
  const [tab, setTab] = useState<Tab>("today");
  const [showProfile, setShowProfile] = useState(false);
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null | undefined>(() => isSupabaseConfigured() ? undefined : null);
  const [cloudReady, setCloudReady] = useState(() => !isSupabaseConfigured());
  const [cloudStatus, setCloudStatus] = useState<"local" | "loading" | "connected" | "error">("local");
  const cloudBootstrapped = useRef(false);
  const [preview, setPreview] = useState<Activity>();
  const [loading, setLoading] = useState(false);
  const [uploadError, setUploadError] = useState<string>();
  const [activeActivity, setActiveActivity] = useState<Activity>();
  const [toast, setToast] = useState<string>();
  const toastTimer = useRef<number | undefined>(undefined);
  const [today, setToday] = useState(() => getBangkokDateKey());
  const [weekOffset, setWeekOffset] = useState(0);
  const visibleWeekDates = useMemo(() => getBangkokWeekDates(shiftBangkokDateKey(today, weekOffset * 7)), [today, weekOffset]);
  const authUser = session?.user;
  const authUserId = authUser?.id;

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (active) setSession(data.session);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      cloudBootstrapped.current = false;
      setCloudReady(false);
      if (!nextSession) {
        setProfile(defaultRunnerProfile());
        setState(initialState);
        setShowProfile(false);
      }
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const saved = window.localStorage.getItem("stridebook-profile-v1");
      if (!saved) return;
      try {
        setProfile((current) => ({ ...current, ...(JSON.parse(saved) as Partial<RunnerProfile>) }));
      } catch {
        window.localStorage.removeItem("stridebook-profile-v1");
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!authUser) return;
    void loadRunnerProfile(authUser).then(setProfile).catch(() => setProfile((current) => ({ ...current, id: authUser.id, email: authUser.email ?? current.email, displayName: current.displayName || defaultRunnerProfile(authUser).displayName })));
  }, [authUser]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const nextToday = getBangkokDateKey();
      setToday((currentToday) => currentToday === nextToday ? currentToday : nextToday);
    }, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const useCloudAsSource = isSupabaseConfigured();
      const saved = useCloudAsSource ? null : window.localStorage.getItem("quiet-run-draft-v1");
      if (useCloudAsSource) window.localStorage.removeItem("quiet-run-draft-v1");
      if (saved) {
        try {
          const savedState = JSON.parse(saved) as Partial<LocalState>;
          setState({ ...initialState, ...savedState, shoes: savedState.shoes ?? initialState.shoes, monthlyGoals: savedState.monthlyGoals ?? initialState.monthlyGoals });
        } catch { window.localStorage.removeItem("quiet-run-draft-v1"); }
      }
      setReady(true);
    });
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    return () => window.cancelAnimationFrame(frame);
  }, []);
  useEffect(() => {
    if (!ready || cloudBootstrapped.current || (isSupabaseConfigured() && !authUserId)) return;
    cloudBootstrapped.current = true;
    if (!isSupabaseConfigured()) {
      return;
    }
    void loadCloudState(state, authUserId).then(({ state: cloudState }) => {
      setState({ ...cloudState, selectedPerson: "me" });
      setCloudStatus("connected");
      setCloudReady(true);
    }).catch(() => {
      setState((current) => ({ ...current, workouts: [], activities: [], shoes: [], monthlyGoals: [] }));
      setCloudStatus("error");
      setCloudReady(true);
    });
  }, [authUserId, ready, state]);
  useEffect(() => { if (ready) window.localStorage.setItem("quiet-run-draft-v1", JSON.stringify(state)); }, [ready, state]);
  useEffect(() => { if (ready) window.localStorage.setItem("stridebook-profile-v1", JSON.stringify(profile)); }, [profile, ready]);
  useEffect(() => {
    if (!ready || !cloudReady) return;
    const timer = window.setTimeout(() => {
      void syncStateToSupabase(state, authUserId)
        .then(() => setCloudStatus((current) => current === "error" ? "connected" : current))
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : "Could not sync with Supabase.";
          console.error("Supabase sync failed", error);
          setCloudStatus("error");
          notify(message);
        });
    }, 450);
    return () => window.clearTimeout(timer);
  }, [authUserId, cloudReady, ready, state]);

  /** Show a short confirmation without coupling page components to app-level state. */
  function notify(message: string) {
    setToast(message);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(undefined), 2600);
  }

  const openTab = (next: Tab) => { setActiveActivity(undefined); setTab(next); window.scrollTo({ top: 0, behavior: "smooth" }); };
  /** Parse the FIT file in the browser; persistence happens only after review. */
  async function handleFile(file: File) {
    setLoading(true); setUploadError(undefined);
    try {
      if (!file.name.toLowerCase().endsWith(".fit")) throw new Error("Stridebook accepts .FIT files only in this draft.");
      setPreview(await parseFitFile(file, "me"));
    } catch (error) { setUploadError(error instanceof Error ? error.message : String(error)); }
    finally { setLoading(false); }
  }
  /** Commit the reviewed activity and link it to a matching plan when possible. */
  function confirmImport() {
    if (!preview) return;
    if (isDuplicateActivity(preview, state.activities)) { setUploadError("This activity already exists. Duplicate import was stopped."); return; }
    const matching = findMatchingWorkout(preview, state.workouts);
    const updatedPreview = matching ? { ...preview, type: matching.type, title: matching.title } : preview;
    setState((current) => ({ ...current, activities: [...current.activities, updatedPreview], workouts: current.workouts.map((workout) => workout.id === matching?.id ? { ...workout, activityId: updatedPreview.id, status: getWorkoutStatus(workout, updatedPreview) } : workout) }));
    notify("Activity saved.");
    setPreview(undefined); setActiveActivity(updatedPreview); setUploadError(undefined);
  }
  /** Keep workout mutations in one place so Today and Plan share identical behavior. */
  function updateWorkout(workoutId: string, updates: Partial<PlannedWorkout>) {
    setState((current) => ({ ...current, workouts: current.workouts.map((workout) => workout.id === workoutId ? { ...workout, ...updates } : workout) }));
    notify(updates.date ? "Plan updated." : updates.status === "missed" ? "Plan marked as missed." : "Plan updated.");
  }
  /** Delete remotely first; only update the UI after Supabase confirms success. */
  async function deleteWorkout(workoutId: string) {
    await deleteWorkoutFromSupabase(workoutId, authUserId);
    setState((current) => ({ ...current, workouts: current.workouts.filter((workout) => workout.id !== workoutId) }));
    notify("Plan deleted.");
  }
  function updateActivity(activityId: string, updates: Partial<Pick<Activity, "shoeId">>) {
    setState((current) => ({ ...current, activities: current.activities.map((activity) => activity.id === activityId ? { ...activity, ...updates } : activity) }));
    setActiveActivity((current) => current?.id === activityId ? { ...current, ...updates } : current);
    if (updates.shoeId !== undefined) notify("Shoe assignment updated.");
  }
  /** Upsert goals locally; the debounced cloud sync persists the latest state. */
  function saveMonthlyGoal(goal: MonthlyGoal) {
    setState((current) => ({ ...current, monthlyGoals: [...current.monthlyGoals.filter((item) => item.id !== goal.id), goal] }));
    notify("Monthly goal saved.");
  }
  /** Save account settings to Supabase, with local storage as a fast fallback. */
  async function handleProfileSave(nextProfile: RunnerProfile) {
    const safeProfile = { ...nextProfile, maxHr: Math.min(240, Math.max(100, Math.round(nextProfile.maxHr || 190))) };
    setProfile(safeProfile);
    window.localStorage.setItem("stridebook-profile-v1", JSON.stringify(safeProfile));
    if (supabase && session?.user) await saveRunnerProfile(safeProfile);
    notify("Profile saved.");
  }
  /** Persist a Max HR edited directly from the activity detail page. */
  function handleMaxHrChange(value: number) {
    const safeMaxHr = Math.min(240, Math.max(100, Math.round(value || 190)));
    const nextProfile = { ...profile, maxHr: safeMaxHr };
    setProfile(nextProfile);
    window.localStorage.setItem("stridebook-profile-v1", JSON.stringify(nextProfile));
    if (supabase && session?.user) void saveRunnerProfile(nextProfile).catch((error: unknown) => notify(error instanceof Error ? error.message : "Could not save Max HR."));
    notify("Max HR saved to your profile.");
  }
  function signOut() {
    if (supabase) void supabase.auth.signOut();
  }
  async function addShoe(shoe: Shoe, imageFile?: File) {
    const image = imageFile ? await uploadShoeImage(shoe.id, imageFile) : undefined;
    const savedShoe = image ? { ...shoe, ...image } : shoe;
    setState((current) => ({ ...current, shoes: [...current.shoes, savedShoe] }));
    notify("Shoe added.");
  }
  async function updateShoeImage(shoeId: string, file: File) {
    const image = await uploadShoeImage(shoeId, file);
    setState((current) => ({ ...current, shoes: current.shoes.map((shoe) => shoe.id === shoeId ? { ...shoe, ...image } : shoe) }));
    notify("Shoe photo updated.");
  }
  async function updateShoe(shoeId: string, updates: Partial<Shoe>) {
    setState((current) => ({ ...current, shoes: current.shoes.map((shoe) => shoe.id === shoeId ? { ...shoe, ...updates } : shoe) }));
    notify("Shoe updated.");
  }
  async function retireShoe(shoeId: string) {
    await updateShoe(shoeId, { retired: true });
    notify("Shoe retired.");
  }
  const activeWorkout = useMemo(() => activeActivity ? state.workouts.find((workout) => workout.activityId === activeActivity.id || (workout.personId === activeActivity.personId && workout.date === activeActivity.date)) : undefined, [activeActivity, state.workouts]);

  if (isSupabaseConfigured() && session === undefined) {
    return <div className="grid min-h-screen place-items-center px-6 text-center"><div className="glass max-w-sm rounded-[28px] p-7"><div className="mx-auto grid size-16 place-items-center rounded-[22px] bg-[#dce4d7] p-2"><Image src="/stridebook-logo.png" alt="Stridebook logo" width={64} height={64} className="size-full object-contain" /></div><h1 className="mt-5 text-xl font-medium">Checking your account</h1><p className="mt-2 text-sm leading-6 text-[#777b73]">Preparing your private running journal…</p></div></div>;
  }
  if (isSupabaseConfigured() && !session) return <AuthView />;
  if (!ready || (isSupabaseConfigured() && !cloudReady)) {
    return <div className="grid min-h-screen place-items-center px-6 text-center"><div className="glass max-w-sm rounded-[28px] p-7"><div role="img" aria-label="Loading Stridebook" className="mx-auto grid size-24 place-items-center overflow-hidden rounded-[28px] bg-[#183b2b] p-1"><Lottie src={energyAnimation} loop autoplay className="size-full" /></div><h1 className="mt-5 text-xl font-medium">Connecting to Stridebook</h1><p className="mt-2 text-sm leading-6 text-[#777b73]">Loading your plans and activities from Supabase…</p></div></div>;
  }

  return (
    <div className="app-shell min-h-screen pb-28 md:pb-8 md:pl-[280px]">
      <Nav tab={tab} onChange={openTab} cloudStatus={cloudStatus} />
      {toast && <div role="status" className="fixed inset-x-4 top-4 z-[60] mx-auto max-w-sm rounded-2xl border border-[#7f9277]/20 bg-[#343b34] px-4 py-3 text-center text-sm font-semibold text-white shadow-[0_14px_35px_rgba(53,48,39,.18)]">{toast}</div>}
      <main className="relative mx-auto w-full max-w-6xl px-4 pb-6 pt-5 sm:px-6 md:px-8 md:pt-8">
        <Header profile={profile} onOpenProfile={() => { setActiveActivity(undefined); setShowProfile(true); }} />
        {showProfile ? <ProfileView key={`${profile.id}-${profile.maxHr}`} profile={profile} onBack={() => setShowProfile(false)} onSave={handleProfileSave} onSignOut={supabase ? signOut : undefined} /> : activeActivity ? <ActivityDetail key={activeActivity.id} activity={activeActivity} workout={activeWorkout} shoes={state.shoes} maxHr={profile.maxHr} onMaxHrChange={handleMaxHrChange} onBack={() => setActiveActivity(undefined)} onShoeChange={(shoeId) => updateActivity(activeActivity.id, { shoeId })} onExportGpx={() => downloadGpx(activeActivity)} /> : <>
          {tab === "today" && <TodayView state={state} personId="me" today={today} weekDates={visibleWeekDates} weekOffset={weekOffset} onWeekChange={setWeekOffset} onWorkoutUpdate={updateWorkout} />}
          {tab === "calendar" && <CalendarView state={state} personId="me" today={today} onAdd={(workout) => setState((current) => ({ ...current, workouts: [...current.workouts, workout] }))} onUpdate={updateWorkout} onDelete={deleteWorkout} />}
          {tab === "upload" && <UploadView preview={preview} loading={loading} error={uploadError} onFile={handleFile} onReset={() => { setPreview(undefined); setUploadError(undefined); }} onConfirm={confirmImport} />}
          {tab === "progress" && <ProgressView state={state} personId="me" today={today} onGoalSave={saveMonthlyGoal} onOpenActivity={setActiveActivity} />}
          {tab === "gear" && <GearView state={state} personId="me" onShoeAdd={addShoe} onShoeUpdate={updateShoe} onShoeRetire={retireShoe} onShoeImageChange={updateShoeImage} />}
        </>}
      </main>
    </div>
  );
}
