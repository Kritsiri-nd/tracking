"use client";

import { ArrowRight, Eye, EyeOff, KeyRound, LockKeyhole, UserRound } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { normalizeUsername, usernameToAuthEmail } from "@/lib/profile";
import { cn } from "./shared";

type AuthMode = "login" | "signup";

/** Small Supabase Auth screen used before the private running journal loads. */
export function AuthView() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    setPending(true);
    setError(undefined);
    setMessage(undefined);
    try {
      const normalizedUsername = normalizeUsername(username);
      if (Array.from(normalizedUsername).length < 2 || Array.from(normalizedUsername).length > 32) throw new Error("Use a name between 2 and 32 characters.");
      const email = usernameToAuthEmail(normalizedUsername);
      if (mode === "signup") {
        const result = await supabase.auth.signUp({ email, password, options: { data: { username: normalizedUsername, display_name: normalizedUsername } } });
        if (result.error) throw result.error;
        setMessage(result.data.session ? "Account created. Loading your journal…" : "Account created. Check your email to confirm, then sign in.");
        if (!result.data.session) setMode("login");
      } else {
        const result = await supabase.auth.signInWithPassword({ email, password });
        if (result.error) throw result.error;
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not complete authentication.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top,#eef1e8,transparent_48%),#f5f0e5] px-4 py-8">
      <section className="glass w-full max-w-md rounded-[32px] p-6 shadow-[0_25px_80px_rgba(53,48,39,.12)] sm:p-8">
        <div className="text-center"><div className="mx-auto grid size-16 place-items-center rounded-[22px] bg-[#dce4d7] p-2"><Image src="/stridebook-logo.png" alt="Stridebook logo" width={64} height={64} className="size-full object-contain" /></div><p className="mt-5 text-xs font-semibold uppercase tracking-[.22em] text-[#7a7f75]">Stridebook</p><h1 className="mt-2 text-3xl font-medium tracking-[-.05em]">Your running journal</h1><p className="mt-2 text-sm leading-6 text-[#777b73]">Keep every plan, run, and small win in one calm place.</p></div>
        <div className="mt-7 flex rounded-2xl bg-white/45 p-1" role="tablist" aria-label="Authentication mode"><button type="button" role="tab" aria-selected={mode === "login"} onClick={() => { setMode("login"); setError(undefined); setMessage(undefined); }} className={cn("flex-1 rounded-xl px-3 py-2.5 text-sm font-semibold", mode === "login" ? "bg-[#343b34] text-white" : "text-[#777b73]")}>Sign in</button><button type="button" role="tab" aria-selected={mode === "signup"} onClick={() => { setMode("signup"); setError(undefined); setMessage(undefined); }} className={cn("flex-1 rounded-xl px-3 py-2.5 text-sm font-semibold", mode === "signup" ? "bg-[#343b34] text-white" : "text-[#777b73]")}>Create account</button></div>
        <form className="mt-6 space-y-4" onSubmit={submit}>
          <label className="block text-sm font-semibold text-[#5e665c]">Name<div className="relative mt-2"><UserRound size={17} className="pointer-events-none absolute left-3 top-3.5 text-[#858880]" /><input required minLength={2} maxLength={32} value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Krit" className="h-11 w-full rounded-2xl border border-[#343b34]/10 bg-white/65 pl-10 pr-3 text-sm outline-none focus:border-[#7f9277]" /></div><span className="mt-1 block text-xs font-normal text-[#858880]">2–32 characters. This name is your login.</span></label>
          <label className="block text-sm font-semibold text-[#5e665c]">Password<div className="relative mt-2"><LockKeyhole size={17} className="pointer-events-none absolute left-3 top-3.5 text-[#858880]" /><input required minLength={6} type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 6 characters" className="h-11 w-full rounded-2xl border border-[#343b34]/10 bg-white/65 pl-10 pr-11 text-sm outline-none focus:border-[#7f9277]" /><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((current) => !current)} className="absolute right-2 top-2 grid size-7 place-items-center rounded-xl text-[#777b73]">{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></label>
          {error && <p role="alert" className="rounded-2xl bg-[#ead9d7] px-4 py-3 text-sm leading-5 text-[#874e49]">{error}</p>}
          {message && <p role="status" className="rounded-2xl bg-[#dce4d7] px-4 py-3 text-sm leading-5 text-[#53644e]">{message}</p>}
          <button disabled={pending} className="tap flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#343b34] text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-60">{pending ? "Please wait…" : mode === "login" ? "Sign in to Stridebook" : "Create my account"}<ArrowRight size={17} /></button>
        </form>
        <p className="mt-5 flex items-center justify-center gap-1 text-center text-xs leading-5 text-[#858880]"><KeyRound size={13} />Your profile settings, including Max HR, stay with your account.</p>
      </section>
    </main>
  );
}
