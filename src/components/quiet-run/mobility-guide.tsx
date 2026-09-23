"use client";

import { Activity, ArrowLeft, ArrowRight, CheckCircle2, Clock3, Footprints, X } from "lucide-react";
import { useState } from "react";
import { GlassCard, cn } from "./shared";

type MobilityPhase = "before" | "after";
type ExerciseKind = "march" | "swing" | "lunge" | "calf" | "stride" | "walk" | "quad" | "hip" | "glute";

type Exercise = {
  name: string;
  duration: string;
  instruction: string;
  cue: string;
  kind: ExerciseKind;
};

const routines: Record<MobilityPhase, Exercise[]> = {
  before: [
    { name: "March in place", duration: "60 sec", instruction: "Stand tall and march gently while swinging your arms naturally.", cue: "Build heat gradually. Keep your shoulders relaxed.", kind: "march" },
    { name: "Leg swings", duration: "10 each side", instruction: "Hold a wall or chair. Swing one leg forward and back with control, then switch sides.", cue: "Keep the movement smooth instead of forcing the range.", kind: "swing" },
    { name: "Walking lunges", duration: "8 each side", instruction: "Step forward, lower both knees comfortably, then push through the front foot to stand.", cue: "Keep the front knee tracking in line with your toes.", kind: "lunge" },
    { name: "Calf raises", duration: "15 reps", instruction: "Rise onto the balls of your feet, pause briefly, then lower slowly.", cue: "Use a wall for balance and keep the movement controlled.", kind: "calf" },
    { name: "Easy strides", duration: "2 × 20 sec", instruction: "Run smoothly and gradually quicker for 20 seconds, then walk or jog easily before repeating.", cue: "Finish feeling ready, not tired.", kind: "stride" },
  ],
  after: [
    { name: "Easy walk", duration: "2–3 min", instruction: "Walk slowly until your breathing settles and your legs feel less loaded.", cue: "Let your heart rate come down naturally.", kind: "walk" },
    { name: "Standing quad stretch", duration: "30 sec each side", instruction: "Hold your ankle behind you and gently draw the heel toward your seat while standing tall.", cue: "Keep your knees close and avoid arching your back.", kind: "quad" },
    { name: "Wall calf stretch", duration: "30 sec each side", instruction: "Place both hands on a wall, step one foot back and press the heel gently toward the floor.", cue: "Keep the back knee straight and toes pointing forward.", kind: "calf" },
    { name: "Half-kneeling hip flexor", duration: "30 sec each side", instruction: "Kneel on one knee, tuck your pelvis slightly, then shift forward until you feel the front of the hip open.", cue: "Stay tall and keep the stretch gentle.", kind: "hip" },
    { name: "Figure-four glute stretch", duration: "30 sec each side", instruction: "Sit or lie back, cross one ankle over the opposite thigh, and gently draw the legs toward you.", cue: "Breathe slowly and stop before any sharp pain.", kind: "glute" },
  ],
};

function ExerciseArt({ kind }: { kind: ExerciseKind }) {
  const line = { fill: "none", stroke: "currentColor", strokeLinecap: "round" as const, strokeLinejoin: "round" as const, strokeWidth: 3 };
  return (
    <svg viewBox="0 0 180 140" className="h-full w-full" aria-hidden="true">
      <circle cx="90" cy="22" r="10" {...line} />
      {kind === "march" && <><path d="M90 33v43M90 44 66 58M90 44l25 12M90 76 69 111M90 76l28 22" {...line} /><path d="M65 102l5 10M113 95l7 6" {...line} /><path d="M47 52c-12 8-12 25 0 33M133 52c12 8 12 25 0 33" {...line} /></>}
      {kind === "swing" && <><path d="M90 33v39M90 45 70 60M90 45l25 12M90 72 78 108M90 72l20 12" {...line} /><path d="M110 84c28 12 35 25 22 36" {...line} /><path d="m131 114 2 7-7-1" {...line} /><path d="M72 58 42 54" {...line} /></>}
      {kind === "lunge" && <><path d="M90 33v38M90 45 67 57M90 45l24 12M90 71 69 108M90 71l39 21M69 108l-22 13M129 92l21 1" {...line} /><path d="M44 121h108" {...line} /></>}
      {kind === "calf" && <><path d="M90 33v42M90 45 68 58M90 45l23 13M90 75 75 109M90 75l17 34M75 109l-17 13M107 109l17 13" {...line} /><path d="M54 122h75" {...line} /><path d="m71 93 5-12 5 12M101 93l6-12 5 12" {...line} /></>}
      {kind === "stride" && <><path d="M90 33 78 64M78 45 57 54M78 45l28 2M78 64 53 91M78 64l38 7M53 91l-22 3M116 71l27-13" {...line} /><path d="M39 105c24-13 75-13 104 0" {...line} /><path d="m137 58 8 0-5 6" {...line} /></>}
      {kind === "walk" && <><path d="M90 33v42M90 45 69 58M90 45l23 13M90 75 72 108M90 75l26 30M72 108l-22 10M116 105l25 2" {...line} /><path d="M42 122h100" {...line} /></>}
      {kind === "quad" && <><path d="M90 33v40M90 45 67 57M90 45l25 12M90 73 78 108M90 73l19 28M78 108l17 9M109 101l-5-28" {...line} /><path d="M90 121h38" {...line} /><path d="m104 73-10-7 2 13" {...line} /></>}
      {kind === "hip" && <><path d="M90 33v37M90 45 66 57M90 45l23 12M90 70 65 96M90 70l37 28M65 96l-19 23M127 98l20 16" {...line} /><path d="M42 122h110" {...line} /><path d="M66 57 51 43" {...line} /></>}
      {kind === "glute" && <><path d="M90 33v39M90 45 66 57M90 45l25 12M90 72 71 105M90 72l20 14M71 105l-22 14M110 86l20 18" {...line} /><path d="M40 121h112" {...line} /><path d="M109 86c18-14 31-8 35 4" {...line} /></>}
      <circle cx="90" cy="22" r="5" fill="currentColor" opacity=".24" />
    </svg>
  );
}

function phaseLabel(phase: MobilityPhase) {
  return phase === "before" ? "Before run" : "After run";
}

export function MobilityGuide() {
  const [phase, setPhase] = useState<MobilityPhase>();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const exercises = phase ? routines[phase] : [];
  const selectedExercise = exercises[selectedIndex];

  function openRoutine(nextPhase: MobilityPhase) {
    setPhase(nextPhase);
    setSelectedIndex(0);
  }

  function closeRoutine() {
    setPhase(undefined);
    setSelectedIndex(0);
  }

  return (
    <>
      <GlassCard className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.18em] text-[#85887f]">Run guide</p>
            <h2 className="mt-1 text-xl font-medium tracking-[-.03em]">Prepare well. Recover well.</h2>
            <p className="mt-1 text-sm text-[#777b73]">Quick movement routines for before and after your run.</p>
          </div>
          <div className="grid size-11 place-items-center rounded-2xl bg-[#dce4d7]/70 text-[#53644e]"><Activity size={20} /></div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <button type="button" onClick={() => openRoutine("before")} className="tap flex items-center justify-between rounded-2xl border border-[#7f9277]/25 bg-[#dce4d7]/55 px-4 py-3 text-left transition hover:bg-[#dce4d7]/80"><span><span className="block text-sm font-semibold">Before run</span><span className="mt-1 block text-xs text-[#777b73]">Dynamic warm-up · 5 moves</span></span><ArrowRight size={17} /></button>
          <button type="button" onClick={() => openRoutine("after")} className="tap flex items-center justify-between rounded-2xl border border-[#343b34]/10 bg-white/42 px-4 py-3 text-left transition hover:bg-white/72"><span><span className="block text-sm font-semibold">After run</span><span className="mt-1 block text-xs text-[#777b73]">Cool-down · 5 moves</span></span><ArrowRight size={17} /></button>
        </div>
      </GlassCard>

      {phase && selectedExercise && <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#293029]/35 p-0 backdrop-blur-sm sm:items-center sm:p-5" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeRoutine(); }}>
        <GlassCard className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-b-none rounded-t-[28px] p-5 sm:rounded-[28px] sm:p-6" role="dialog" aria-modal="true" aria-label={`${phaseLabel(phase)} routine`}>
          <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-[#85887f]">Run guide</p><h2 className="mt-1 text-2xl font-medium tracking-[-.045em]">{phaseLabel(phase)}</h2><p className="mt-1 text-sm text-[#777b73]">Move gently and stop if you feel sharp pain.</p></div><button type="button" onClick={closeRoutine} aria-label="Close run guide" title="Close run guide" className="tap grid size-10 place-items-center rounded-2xl bg-white/55"><X size={18} /></button></div>
          <div className="mt-5 grid gap-5 lg:grid-cols-[220px_1fr]">
            <div className="space-y-2">{exercises.map((exercise, index) => <button type="button" key={exercise.name} onClick={() => setSelectedIndex(index)} className={cn("flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition", selectedIndex === index ? "border-[#7f9277]/40 bg-[#dce4d7]/65" : "border-[#343b34]/8 bg-white/35 hover:bg-white/60")}><span className={cn("grid size-8 shrink-0 place-items-center rounded-xl text-xs font-bold", selectedIndex === index ? "bg-[#343b34] text-white" : "bg-[#dce4d7]/70 text-[#53644e]")}>{index + 1}</span><span className="min-w-0"><span className="block truncate text-sm font-semibold">{exercise.name}</span><span className="mt-0.5 block text-[11px] text-[#858880]">{exercise.duration}</span></span>{selectedIndex === index && <CheckCircle2 className="ml-auto shrink-0 text-[#7f9277]" size={16} />}</button>)}</div>
            <div className="rounded-[24px] border border-[#343b34]/8 bg-white/35 p-4 sm:p-5">
              <div className="grid gap-4 sm:grid-cols-[180px_1fr] sm:items-center"><div className="aspect-square rounded-2xl bg-[#dce4d7]/55 p-4 text-[#53644e]"><ExerciseArt kind={selectedExercise.kind} /></div><div><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-[#343b34] px-2.5 py-1 text-[11px] font-semibold text-white">{selectedIndex + 1} / {exercises.length}</span><span className="inline-flex items-center gap-1 text-xs font-medium text-[#777b73]"><Clock3 size={13} />{selectedExercise.duration}</span></div><h3 className="mt-3 text-xl font-medium">{selectedExercise.name}</h3><p className="mt-2 text-sm leading-6 text-[#74786f]">{selectedExercise.instruction}</p><div className="mt-4 rounded-2xl bg-[#eef1e8]/70 p-3 text-xs leading-5 text-[#687066]"><strong className="font-semibold text-[#53644e]">Key cue: </strong>{selectedExercise.cue}</div></div></div>
              <div className="mt-5 flex items-center justify-between gap-2"><button type="button" disabled={selectedIndex === 0} onClick={() => setSelectedIndex((current) => Math.max(current - 1, 0))} className="tap inline-flex items-center gap-1 rounded-2xl border border-[#343b34]/10 bg-white/45 px-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-35"><ArrowLeft size={15} />Previous</button><button type="button" disabled={selectedIndex === exercises.length - 1} onClick={() => setSelectedIndex((current) => Math.min(current + 1, exercises.length - 1))} className="tap inline-flex items-center gap-1 rounded-2xl bg-[#343b34] px-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-35">Next<ArrowRight size={15} /></button></div>
            </div>
          </div>
          <div className="mt-5 flex items-center gap-2 text-xs leading-5 text-[#858880]"><Footprints size={15} />This is a simple guide, not medical advice. Keep every movement comfortable.</div>
        </GlassCard>
      </div>}
    </>
  );
}
