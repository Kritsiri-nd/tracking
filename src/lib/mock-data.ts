import type { Activity, LocalState, MonthlyGoal, PlannedWorkout, Shoe } from "./types";

export const demoDate = "2026-09-21";

const planned: PlannedWorkout[] = [
  { id: "w-1", personId: "me", date: "2026-09-21", type: "easy", title: "Easy morning", distanceKm: 5, paceMin: 6.8, paceMax: 7.4, note: "Keep it conversational", status: "planned" },
  { id: "w-2", personId: "me", date: "2026-09-23", type: "tempo", title: "Tempo blocks", distanceKm: 6, durationMin: 38, paceMin: 5.8, paceMax: 6.2, note: "2 × 10 min steady", status: "planned" },
  { id: "w-3", personId: "me", date: "2026-09-26", type: "long", title: "Long and quiet", distanceKm: 10, paceMin: 7.1, paceMax: 7.8, note: "No pace chasing", status: "planned" },
  { id: "w-4", personId: "partner", date: "2026-09-21", type: "recovery", title: "Soft recovery", distanceKm: 4, durationMin: 32, paceMin: 7.4, paceMax: 8.1, status: "planned" },
  { id: "w-5", personId: "partner", date: "2026-09-24", type: "interval", title: "Short intervals", distanceKm: 5, durationMin: 34, note: "6 × 400 m", status: "planned" },
  { id: "w-6", personId: "partner", date: "2026-09-27", type: "long", title: "Sunday long run", distanceKm: 8, paceMin: 7.2, paceMax: 8, status: "planned" },
];

const activities: Activity[] = [
  {
    id: "a-1", personId: "me", date: "2026-09-15", startedAt: "2026-09-15T17:08:19+07:00", type: "easy", title: "Golden hour run", source: "Suunto Race S", distanceKm: 4.999, durationSec: 2929, paceSecPerKm: 586, avgHr: 149, maxHr: 172, avgCadence: 158, elevationGainM: 5, calories: 478,
    laps: [1, 2, 3, 4, 5].map((lap) => ({ lap, distanceKm: 1, durationSec: [586, 584, 589, 590, 580][lap - 1], paceSecPerKm: [586, 584, 589, 590, 580][lap - 1], avgHr: [137, 145, 150, 158, 162][lap - 1] })),
    stream: [137, 142, 146, 151, 156, 161, 166, 172].map((heartRate, index) => ({ distanceKm: Number((index * 0.7).toFixed(1)), paceSecPerKm: 600 - index * 5, heartRate })),
    note: "Felt calm and steady.", rpe: 5, shoeId: "shoe-1",
  },
  {
    id: "a-2", personId: "partner", date: "2026-09-14", startedAt: "2026-09-14T06:32:00+07:00", type: "easy", title: "Park loop", source: "COROS PACE 4", distanceKm: 5.2, durationSec: 2184, paceSecPerKm: 420, avgHr: 145, maxHr: 161, avgCadence: 171, elevationGainM: 18, calories: 362,
    laps: [1, 2, 3, 4, 5].map((lap) => ({ lap, distanceKm: 1, durationSec: 420 + lap * 3, paceSecPerKm: 420 + lap * 3, avgHr: 139 + lap * 2 })),
    stream: [136, 141, 146, 145, 149, 152, 155, 158].map((heartRate, index) => ({ distanceKm: Number((index * 0.7).toFixed(1)), paceSecPerKm: 435 - index * 3, heartRate })),
    note: "A little warm, but nice.", rpe: 4, shoeId: "shoe-2",
  },
  {
    id: "a-3", personId: "me", date: "2026-09-18", startedAt: "2026-09-18T18:04:00+07:00", type: "tempo", title: "Friday tempo", source: "Suunto Race S", distanceKm: 6.1, durationSec: 2262, paceSecPerKm: 371, avgHr: 158, maxHr: 174, avgCadence: 168, elevationGainM: 22, calories: 514,
    laps: [1, 2, 3, 4, 5, 6].map((lap) => ({ lap, distanceKm: 1, durationSec: 371 + (lap % 2) * 5, paceSecPerKm: 371 + (lap % 2) * 5, avgHr: 151 + lap })),
    stream: [150, 154, 157, 160, 163, 166, 169, 172].map((heartRate, index) => ({ distanceKm: Number((index * 0.8).toFixed(1)), paceSecPerKm: 390 - index * 6, heartRate })),
    note: "Strong finish.", rpe: 7, shoeId: "shoe-1",
  },
];

export const shoes: Shoe[] = [
  { id: "shoe-1", personId: "me", name: "Daily Trainer", brand: "ASICS", model: "Novablast", maxDistanceKm: 800 },
  { id: "shoe-2", personId: "partner", name: "Park Shoes", brand: "Hoka", model: "Clifton", maxDistanceKm: 700 },
];

export const monthlyGoals: MonthlyGoal[] = [
  { id: "goal-2026-09-me", personId: "me", month: "2026-09", targetDistanceKm: 80, targetSessions: 12 },
  { id: "goal-2026-09-partner", personId: "partner", month: "2026-09", targetDistanceKm: 60, targetSessions: 10 },
];

export const initialState: LocalState = { selectedPerson: "me", workouts: planned, activities, shoes, monthlyGoals };
