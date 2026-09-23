import { BarChart3, CalendarDays, Home, PackageOpen, Sparkles, Upload, UserRound } from "lucide-react";
import Image from "next/image";
import type { RunnerProfile } from "@/lib/types";
import { cn, type Tab } from "./shared";

type CloudStatus = "local" | "loading" | "connected" | "error";

export function Header({ profile, onOpenProfile }: { profile: RunnerProfile; onOpenProfile: () => void }) {
  return (
    <header className="mb-7 flex items-center justify-between gap-3">
      <div>
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[.22em] text-[#7a7f75]"><Image src="/stridebook-logo.png" alt="" width={24} height={24} className="size-6 object-contain" />Stridebook</div>
        <p className="mt-1 text-sm text-[#777b73]">Move gently. Grow steadily.</p>
      </div>
      <button type="button" onClick={onOpenProfile} className="tap flex items-center gap-2 rounded-full border border-white/70 bg-white/45 px-2 py-1.5 text-left shadow-sm" aria-label="Open profile"><span className="grid size-8 place-items-center rounded-full bg-[#dce4d7] text-xs font-bold text-[#53644e]">{profile.displayName.slice(0, 1).toUpperCase() || <UserRound size={15} />}</span><span className="hidden max-w-28 truncate text-sm font-semibold text-[#656960] sm:inline">{profile.displayName || "Profile"}</span></button>
    </header>
  );
}

export function Nav({ tab, onChange, cloudStatus }: { tab: Tab; onChange: (tab: Tab) => void; cloudStatus: CloudStatus }) {
  const items: Array<{ id: Tab; label: string; icon: typeof Home }> = [
    { id: "today", label: "Today", icon: Home },
    { id: "calendar", label: "Plan", icon: CalendarDays },
    { id: "upload", label: "Import", icon: Upload },
    { id: "progress", label: "Progress", icon: BarChart3 },
    { id: "gear", label: "Gear", icon: PackageOpen },
  ];
  return (
    <>
      <nav className="fixed inset-x-3 bottom-3 z-50 flex items-center justify-around rounded-[24px] border border-white/75 bg-[#f9f6ef]/88 px-2 py-2 shadow-[0_18px_50px_rgba(53,48,39,.18)] backdrop-blur-2xl md:hidden safe-bottom">
        {items.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => onChange(id)} className={cn("tap flex min-w-[58px] flex-col items-center justify-center gap-1 rounded-2xl px-1.5 py-1.5 text-[10px] font-semibold transition", tab === id ? "bg-[#343b34] text-white" : "text-[#777b72]")}><Icon size={18} strokeWidth={1.8} />{label}</button>
        ))}
      </nav>
      <aside className="fixed inset-y-5 left-5 z-40 hidden w-60 flex-col rounded-[30px] border border-white/75 bg-[#f9f6ef]/72 p-5 shadow-[0_22px_60px_rgba(53,48,39,.1)] backdrop-blur-2xl md:flex">
        <div className="mb-10 flex items-center gap-3"><div className="grid size-11 place-items-center rounded-2xl bg-[#dce4d7] p-1"><Image src="/stridebook-logo.png" alt="Stridebook logo" width={44} height={44} className="size-full object-contain" /></div><div><div className="font-semibold">Stridebook</div><div className="text-xs text-[#7b7e76]">your running journal</div></div></div>
        <div className="space-y-2">{items.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => onChange(id)} className={cn("tap flex w-full items-center gap-3 rounded-2xl px-4 text-sm font-medium transition", tab === id ? "bg-[#343b34] text-white shadow-lg" : "text-[#686c64] hover:bg-white/60")}><Icon size={19} />{label}</button>)}</div>
        <div className="mt-auto rounded-2xl bg-[#dce4d7]/65 p-4 text-xs leading-5 text-[#586554]"><Sparkles size={16} className="mb-2" /><b>{cloudStatus === "connected" ? "Cloud synced" : cloudStatus === "loading" ? "Connecting…" : cloudStatus === "error" ? "Cloud unavailable" : "Local draft"}</b><br />{cloudStatus === "connected" ? "Your data is synced to Supabase." : cloudStatus === "error" ? "Changes are kept locally for now." : "Your data stays in this browser."}</div>
      </aside>
    </>
  );
}
