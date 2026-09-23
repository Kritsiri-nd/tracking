export type PersonId = "me" | "partner";

export type WorkoutType =
  | "easy"
  | "long"
  | "tempo"
  | "interval"
  | "recovery"
  | "race"
  | "rest";

export type WorkoutStatus = "planned" | "completed" | "partial" | "exceeded" | "missed";

export type Person = {
  id: PersonId;
  name: string;
  nickname: string;
  initials: string;
  device: string;
  color: "clay" | "sage";
};

export type Shoe = {
  id: string;
  personId: PersonId;
  name: string;
  brand?: string;
  model?: string;
  maxDistanceKm: number;
  retired?: boolean;
  imagePath?: string;
  imageUrl?: string;
};

export type MonthlyGoal = {
  id: string;
  personId: PersonId;
  month: string;
  targetDistanceKm?: number;
  targetSessions?: number;
};

export type PlannedWorkout = {
  id: string;
  personId: PersonId;
  date: string;
  type: WorkoutType;
  title: string;
  distanceKm?: number;
  durationMin?: number;
  paceMin?: number;
  paceMax?: number;
  note?: string;
  status: WorkoutStatus;
  activityId?: string;
  postponedFrom?: string;
};

export type Activity = {
  id: string;
  personId: PersonId;
  date: string;
  startedAt: string;
  type: WorkoutType;
  title: string;
  source: "Suunto Race S" | "COROS PACE 4" | "manual";
  distanceKm: number;
  durationSec: number;
  paceSecPerKm: number;
  avgHr?: number;
  maxHr?: number;
  avgCadence?: number;
  elevationGainM?: number;
  calories?: number;
  laps: ActivityLap[];
  stream: ActivityPoint[];
  track?: ActivityTrackPoint[];
  importedFileName?: string;
  shoeId?: string;
  rpe?: number;
  note?: string;
};

export type ActivityLap = {
  lap: number;
  distanceKm: number;
  durationSec: number;
  paceSecPerKm?: number;
  avgHr?: number;
  avgCadence?: number;
};

export type ActivityPoint = {
  distanceKm: number;
  paceSecPerKm?: number;
  heartRate?: number;
  latitude?: number;
  longitude?: number;
  elevationM?: number;
  cadence?: number;
  temperatureC?: number;
  timestamp?: string;
};

export type ActivityTrackPoint = {
  distanceKm?: number;
  latitude: number;
  longitude: number;
  elevationM?: number;
  timestamp?: string;
};

export type LocalState = {
  selectedPerson: PersonId;
  workouts: PlannedWorkout[];
  activities: Activity[];
  shoes: Shoe[];
  monthlyGoals: MonthlyGoal[];
};

/** Account-level runner settings used across activities and profile views. */
export type RunnerProfile = {
  id: string;
  email: string;
  username: string;
  displayName: string;
  maxHr: number;
  restingHr?: number;
  birthDate?: string;
  heightCm?: number;
  weightKg?: number;
  runningGoal?: string;
};
