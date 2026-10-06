import { BarChart3, CalendarDays, Home, Footprints, Moon, RefreshCw, Sparkles, Sun, Upload, UserRound } from "lucide-react";
import Image from "next/image";
import type { RunnerProfile } from "@/lib/types";
import { cn, type Tab } from "./shared";

type CloudStatus = "local" | "loading" | "saving" | "connected" | "error";

export function Header({ profile, themeMode, onToggleTheme, onOpenProfile }: { profile: RunnerProfile; themeMode: "dark" | "light"; onToggleTheme: () => void; onOpenProfile: () => void }) {
  return (
    <header className="dashboard-header mb-7 flex flex-wrap items-center gap-3 sm:gap-4">
      <div className="dashboard-header-copy hidden md:block"><p className="dashboard-header-kicker">Stridebook / running journal</p><p className="dashboard-header-title">Train with intention.</p></div>
      <div className="dashboard-mobile-brand flex items-center gap-2 md:hidden"><div className="dashboard-brand-mark grid size-9 place-items-center rounded-xl p-1"><Image src="/stridebook-logo.png" alt="Stridebook logo" width={36} height={36} className="size-full object-contain" /></div><span className="text-sm font-semibold tracking-tight">Stridebook</span></div>
      <div className="ml-auto flex items-center gap-2"><span className="dashboard-header-caption hidden xl:inline">Your running journal</span><button type="button" onClick={onToggleTheme} className="dashboard-theme-toggle tap grid size-11 place-items-center rounded-2xl" aria-label={`Switch to ${themeMode === "dark" ? "light" : "dark"} mode`} title={`Switch to ${themeMode === "dark" ? "light" : "dark"} mode`}>{themeMode === "dark" ? <Sun size={17} /> : <Moon size={17} />}</button><button type="button" onClick={onOpenProfile} className="dashboard-profile tap flex items-center gap-2 rounded-full px-1.5 py-1.5 text-left" aria-label="Open profile"><span className="grid size-9 place-items-center rounded-full bg-[#a6ff00] text-sm font-bold text-[#111411]">{profile.displayName.slice(0, 1).toUpperCase() || <UserRound size={15} />}</span><span className="hidden max-w-28 truncate text-sm font-semibold sm:inline">{profile.displayName || "Profile"}</span></button></div>
    </header>
  );
}

export function Nav({ tab, onChange, cloudStatus, onRetrySync }: { tab: Tab; onChange: (tab: Tab) => void; cloudStatus: CloudStatus; onRetrySync?: () => void }) {
  const items: Array<{ id: Tab; label: string; icon: typeof Home }> = [
    { id: "today", label: "Today", icon: Home },
    { id: "calendar", label: "Plan", icon: CalendarDays },
    { id: "upload", label: "Import", icon: Upload },
    { id: "progress", label: "Progress", icon: BarChart3 },
    { id: "gear", label: "Gear", icon: Footprints },
  ];
  const statusLabel = cloudStatus === "connected" ? "Cloud synced" : cloudStatus === "error" ? "Cloud unavailable" : cloudStatus === "saving" ? "Saving changes" : cloudStatus === "loading" ? "Connecting" : "Local draft";

  return (
    <>
      <nav className="dashboard-mobile-nav fixed inset-x-3 bottom-3 z-50 flex items-center justify-around rounded-[24px] px-2 py-2 md:hidden safe-bottom">
        {items.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => onChange(id)} aria-label={label} aria-current={tab === id ? "page" : undefined} className={cn("tap flex min-w-[58px] flex-col items-center justify-center gap-1 rounded-2xl px-1.5 py-1.5 text-[10px] font-semibold transition", tab === id ? "dashboard-nav-active" : "dashboard-nav-idle")}><Icon size={18} strokeWidth={1.8} /><span>{label}</span></button>)}
      </nav>
      <aside className="dashboard-sidebar fixed inset-y-5 left-5 z-40 hidden w-56 flex-col rounded-[26px] p-4 md:flex">
        <div className="mb-10 flex items-center gap-3"><div className="dashboard-sidebar-logo grid size-12 shrink-0 place-items-center rounded-2xl p-1.5"><Image src="/stridebook-logo.png" alt="Stridebook logo" width={48} height={48} className="size-full object-contain" /></div><div><div className="font-semibold tracking-tight">Stridebook</div><div className="text-xs text-[#7b7e76]">your running journal</div></div></div>
        <div className="dashboard-nav-group-label">Workspace</div><div className="flex w-full flex-col gap-2">{items.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => onChange(id)} title={label} aria-label={label} aria-current={tab === id ? "page" : undefined} className={cn("dashboard-nav-button tap flex w-full items-center gap-3 rounded-2xl px-4 text-sm font-medium transition", tab === id ? "dashboard-nav-active" : "dashboard-nav-idle")}><Icon size={19} /><span>{label}</span></button>)}</div>
        <div className="dashboard-sidebar-status mt-auto flex items-start gap-2 rounded-2xl p-3 text-xs leading-5" title={statusLabel} aria-label={statusLabel}><Sparkles size={16} className="mt-0.5 shrink-0" /><span className="min-w-0 flex-1"><b>{statusLabel}</b><br /><span className="opacity-65">{cloudStatus === "connected" ? "Synced to Supabase" : cloudStatus === "saving" ? "Syncing your latest change" : cloudStatus === "error" ? "Changes need another try" : "Your data stays private"}</span></span>{cloudStatus === "error" && onRetrySync && <button type="button" onClick={onRetrySync} aria-label="Retry sync" title="Retry sync" className="tap grid size-8 shrink-0 place-items-center rounded-xl bg-white/10 text-current"><RefreshCw size={14} /></button>}</div>
      </aside>
    </>
  );
}
