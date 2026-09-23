const BANGKOK_TIME_ZONE = "Asia/Bangkok";

const bangkokDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: BANGKOK_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function dateFromKey(dateKey: string) {
  return new Date(`${dateKey}T12:00:00Z`);
}

function addDays(dateKey: string, days: number) {
  const date = dateFromKey(dateKey);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function shiftBangkokDateKey(dateKey: string, days: number) {
  return addDays(dateKey, days);
}

export function getBangkokDateKey(now = new Date()) {
  return bangkokDateFormatter.format(now);
}

export function getBangkokWeekDates(nowOrDateKey: Date | string = new Date()) {
  const dateKey = typeof nowOrDateKey === "string" ? nowOrDateKey : getBangkokDateKey(nowOrDateKey);
  const day = dateFromKey(dateKey).getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = addDays(dateKey, mondayOffset);
  return Array.from({ length: 7 }, (_, index) => addDays(monday, index));
}

export const BANGKOK_TIME_ZONE_NAME = BANGKOK_TIME_ZONE;
