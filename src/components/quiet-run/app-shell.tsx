"use client";

import { Lottie } from "lottie-react";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getBangkokDateKey, getBangkokWeekDates, shiftBangkokDateKey } from "@/lib/date";
import { parseFitFile } from "@/lib/fit";
import { importActivities } from "@/lib/import-logic";
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
import { cn, Tab } from "./shared";

const validTabs: Tab[] = ["today", "calendar", "upload", "progress", "gear"];

function tabFromUrl(): Tab {
  if (typeof window === "undefined") return "today";
  const value = new URLSearchParams(window.location.search).get("tab") as Tab | null;
  return value && validTabs.includes(value) ? value : "today";
}

export function QuietRunApp() {
  const [state, setState] = useState<LocalState>(initialState);
  const latestState = useRef(state);
  useEffect(() => { latestState.current = state; }, [state]);
  const [profile, setProfile] = useState<RunnerProfile>(() => defaultRunnerProfile());
  const [tab, setTab] = useState<Tab>(tabFromUrl);
  const [themeMode, setThemeMode] = useState<"dark" | "light">("dark");
  const [showProfile, setShowProfile] = useState(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("profile") === "1");
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null | undefined>(() => isSupabaseConfigured() ? undefined : null);
  const [cloudReady, setCloudReady] = useState(() => !isSupabaseConfigured());
  const [cloudStatus, setCloudStatus] = useState<"local" | "loading" | "saving" | "connected" | "error">("local");
  const [syncRevision, setSyncRevision] = useState(0);
  const cloudBootstrapped = useRef(false);
  const lastAuthOwner = useRef<string | null | undefined>(undefined);
  const [previews, setPreviews] = useState<Activity[]>([]);
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
      if (active) {
        if (lastAuthOwner.current === undefined) lastAuthOwner.current = data.session?.user.id ?? null;
        setSession(data.session);
      }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      const nextOwner = nextSession?.user.id ?? null;
      // Focus and token refresh can announce the same account again. Resetting
      // cloudReady then would leave the loader waiting for an unchanged owner.
      if (lastAuthOwner.current === nextOwner) return;
      lastAuthOwner.current = nextOwner;
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
    const timer = window.setTimeout(() => {
      const saved = window.localStorage.getItem("stridebook-profile-v1");
      if (!saved) return;
      try {
        setProfile((current) => {
          const next = { ...current, ...(JSON.parse(saved) as Partial<RunnerProfile>) };
          return next;
        });
      } catch {
        window.localStorage.removeItem("stridebook-profile-v1");
      }
    });
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const savedTheme = window.localStorage.getItem("stridebook-theme-v1");
      if (savedTheme === "light") setThemeMode("light");
    });
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (ready) window.localStorage.setItem("stridebook-theme-v1", themeMode);
  }, [ready, themeMode]);

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
    const timer = window.setTimeout(() => {
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
    return () => window.clearTimeout(timer);
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
  useEffect(() => {
    const handlePopState = () => {
      setTab(tabFromUrl());
      setShowProfile(new URLSearchParams(window.location.search).get("profile") === "1");
      setActiveActivity(undefined);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);
  useEffect(() => { if (ready) window.localStorage.setItem("quiet-run-draft-v1", JSON.stringify(state)); }, [ready, state]);
  useEffect(() => { if (ready) window.localStorage.setItem("stridebook-profile-v1", JSON.stringify(profile)); }, [profile, ready]);
  useEffect(() => {
    if (!ready || !cloudReady) return;
    if (!isSupabaseConfigured()) {
      return;
    }
    const timer = window.setTimeout(() => {
      setCloudStatus("saving");
      void syncStateToSupabase(state, authUserId)
        .then(() => setCloudStatus("connected"))
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : "Could not sync with Supabase.";
          console.error("Supabase sync failed", error);
          setCloudStatus("error");
          notify(message);
        });
    }, 450);
    return () => window.clearTimeout(timer);
  }, [authUserId, cloudReady, ready, state, syncRevision]);

  /** Show a short confirmation without coupling page components to app-level state. */
  function notify(message: string) {
    setToast(message);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(undefined), 2600);
  }

  function writeNavigationUrl(nextTab: Tab, profileOpen = false) {
    const params = new URLSearchParams(window.location.search);
    params.set("tab", nextTab);
    if (profileOpen) params.set("profile", "1");
    else params.delete("profile");
    const query = params.toString();
    window.history.pushState(null, "", query ? `${window.location.pathname}?${query}` : window.location.pathname);
  }
  const openTab = (next: Tab) => { setActiveActivity(undefined); setShowProfile(false); setTab(next); writeNavigationUrl(next); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const openProfile = () => { setActiveActivity(undefined); setShowProfile(true); writeNavigationUrl(tab, true); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const closeProfile = () => { setShowProfile(false); writeNavigationUrl(tab); };
  const retryCloudSync = () => { setCloudStatus("saving"); setSyncRevision((current) => current + 1); };
  /** Parse one or more FIT files in the browser; persistence happens only after review. */
  async function handleFiles(files: File[]) {
    if (loading || !files.length) return;
    const fitFiles = files.filter((file) => file.name.toLowerCase().endsWith(".fit"));
    if (!fitFiles.length) {
      setUploadError("Stridebook accepts .FIT files only in this draft.");
      return;
    }
    setLoading(true); setUploadError(undefined);
    const parsed: Activity[] = [];
    const errors: string[] = files.filter((file) => !file.name.toLowerCase().endsWith(".fit")).map((file) => `${file.name}: Only .FIT files are supported.`);
    for (const file of fitFiles) {
      try {
        parsed.push(await parseFitFile(file, "me"));
      } catch (error) {
        errors.push(`${file.name}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    setPreviews(parsed);
    if (errors.length) setUploadError(`Some files could not be read. ${errors.join(" ")}`);
    setLoading(false);
  }
  /** Commit reviewed activities and link each one to a matching plan when possible. */
  async function saveSuuntoActivity(activity: Activity) {
    if (!authUserId || !cloudReady) throw new Error("Wait for your cloud data to finish loading before importing.");
    const result = importActivities(latestState.current, [activity]);
    if (!result.imported.length) return false;
    // Finish the cloud save before marking this workout imported or fetching another.
    await syncStateToSupabase(result.state, authUserId);
    latestState.current = result.state;
    setState(result.state);
    setCloudStatus("connected");
    return true;
  }

  function confirmImport() {
    if (!previews.length) return;
    const { state: nextState, imported, skipped } = importActivities(state, previews);
    if (!imported.length) {
      setUploadError("These activities already exist. Duplicate import was stopped.");
      return;
    }
    setState(nextState);
    notify(`${imported.length} activit${imported.length === 1 ? "y" : "ies"} saved.${skipped ? ` Skipped ${skipped} duplicate${skipped === 1 ? "" : "s"}.` : ""}`);
    setPreviews([]); setActiveActivity(imported[imported.length - 1]);
    setUploadError(undefined);
  }
  /** Keep workout mutations in one place so Today and Plan share identical behavior. */
  function updateWorkout(workoutId: string, updates: Partial<PlannedWorkout>) {
    setState((current) => ({ ...current, workouts: current.workouts.map((workout) => workout.id === workoutId ? { ...workout, ...updates } : workout) }));
    notify(updates.date ? "Plan updated." : updates.status === "missed" ? "Plan marked as missed." : "Plan updated.");
  }
  function addWorkout(workout: PlannedWorkout) {
    setState((current) => ({ ...current, workouts: [...current.workouts, workout] }));
    notify("Plan added.");
  }
  /** Delete remotely first; only update the UI after Supabase confirms success. */
  async function deleteWorkout(workoutId: string) {
    await deleteWorkoutFromSupabase(workoutId, authUserId);
    setState((current) => ({ ...current, workouts: current.workouts.filter((workout) => workout.id !== workoutId) }));
    notify("Plan deleted.");
  }
  function updateActivity(activityId: string, updates: Partial<Pick<Activity, "shoeId" | "rpe" | "note">>) {
    setState((current) => ({ ...current, activities: current.activities.map((activity) => activity.id === activityId ? { ...activity, ...updates } : activity) }));
    setActiveActivity((current) => current?.id === activityId ? { ...current, ...updates } : current);
    if (updates.shoeId !== undefined) notify("Shoe assignment updated.");
    else if (updates.note !== undefined || updates.rpe !== undefined) notify("Run feedback saved.");
  }
  /** Upsert goals locally; the debounced cloud sync persists the latest state. */
  function saveMonthlyGoal(goal: MonthlyGoal) {
    setState((current) => ({ ...current, monthlyGoals: [...current.monthlyGoals.filter((item) => item.id !== goal.id), goal] }));
    notify("Monthly goal saved.");
  }
  /** Save account settings to Supabase, with local storage as a fast fallback. */
  async function handleProfileSave(nextProfile: RunnerProfile) {
    const safeProfile = { ...nextProfile, maxHr: Math.min(240, Math.max(100, Math.round(nextProfile.maxHr || 190))) };
    if (supabase && session?.user) await saveRunnerProfile(safeProfile);
    setProfile(safeProfile);
    window.localStorage.setItem("stridebook-profile-v1", JSON.stringify(safeProfile));
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
    <div className={cn("app-shell dashboard-theme min-h-screen pb-28 md:pb-8 md:pl-[250px]", themeMode === "light" && "dashboard-theme-light")}>
      <Nav tab={tab} onChange={openTab} cloudStatus={cloudStatus} onRetrySync={retryCloudSync} />
      {toast && <div role="status" className="fixed inset-x-4 top-4 z-[60] mx-auto max-w-sm rounded-2xl border border-[#7f9277]/20 bg-[#343b34] px-4 py-3 text-center text-sm font-semibold text-white shadow-[0_14px_35px_rgba(53,48,39,.18)]">{toast}</div>}
      <main className="relative mx-auto w-full max-w-[1500px] px-4 pb-6 pt-5 sm:px-6 md:px-8 md:pt-7 lg:px-10">
        <Header profile={profile} themeMode={themeMode} onToggleTheme={() => setThemeMode((current) => current === "dark" ? "light" : "dark")} onOpenProfile={openProfile} />
        {showProfile ? <ProfileView key={profile.id} profile={profile} onBack={closeProfile} onSave={handleProfileSave} onSignOut={supabase ? signOut : undefined} onOpenGear={() => openTab("gear")} onSuuntoSave={saveSuuntoActivity} suuntoActivities={state.activities} onOpenProgress={() => openTab("progress")} onSuuntoImport={(activity) => { setPreviews([activity]); setUploadError(undefined); setActiveActivity(undefined); openTab("upload"); }} /> : activeActivity ? <ActivityDetail key={activeActivity.id} activity={activeActivity} workout={activeWorkout} shoes={state.shoes} maxHr={profile.maxHr} onMaxHrChange={handleMaxHrChange} onBack={() => setActiveActivity(undefined)} onShoeChange={(shoeId) => updateActivity(activeActivity.id, { shoeId })} onActivityUpdate={(updates) => updateActivity(activeActivity.id, updates)} onExportGpx={() => downloadGpx(activeActivity)} /> : <>
          {tab === "today" && <TodayView state={state} personId="me" today={today} weekDates={visibleWeekDates} weekOffset={weekOffset} onWeekChange={setWeekOffset} onWorkoutUpdate={updateWorkout} />}
          {tab === "calendar" && <CalendarView state={state} personId="me" today={today} onAdd={addWorkout} onUpdate={updateWorkout} onDelete={deleteWorkout} />}
          {tab === "upload" && <UploadView cloudEnabled={Boolean(session)} previews={previews} loading={loading} error={uploadError} onFiles={handleFiles} onReset={() => { setPreviews([]); setUploadError(undefined); }} onConfirm={confirmImport} />}
          {tab === "progress" && <ProgressView state={state} personId="me" today={today} onGoalSave={saveMonthlyGoal} onOpenActivity={setActiveActivity} />}
          {tab === "gear" && <GearView state={state} personId="me" onShoeAdd={addShoe} onShoeUpdate={updateShoe} onShoeRetire={retireShoe} onShoeImageChange={updateShoeImage} />}
        </>}
      </main>
    </div>
  );
}
