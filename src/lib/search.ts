import type { Interval } from "./bookings";

export const DURATIONS = [30, 60, 90, 120];
export const PARTY_SIZES = [1, 2, 3, 4];
export const LIBRARIES = [
  { value: "chifley", name: "Chifley Library" },
  { value: "hancock", name: "Hancock Library" },
  { value: "law", name: "Law Library" },
];

export type Slot = Interval & { date: string; start: string; duration: number };
// library is null for "Any library".
export type SearchQuery = Slot & { people: number; library: string | null };

type Fields = { get(name: string): unknown };

const hhmm = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

// Turns date + start + duration into a same-day interval, or an error message.
export function parseSlot(fields: Fields): { slot: Slot } | { error: string } {
  const date = String(fields.get("date") ?? "");
  const start = String(fields.get("start") ?? "");
  const duration = Number(fields.get("duration"));

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Choose a date." };
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(start)) return { error: "Choose a start time." };
  if (!DURATIONS.includes(duration)) return { error: "Choose a duration." };

  const [hours, minutes] = start.split(":").map(Number);
  const endMinutes = hours * 60 + minutes + duration;
  if (endMinutes > 24 * 60) return { error: "The booking has to finish by midnight." };

  return { slot: { date, start, duration, startTime: `${date}T${start}`, endTime: `${date}T${hhmm(endMinutes)}` } };
}

// Canberra's current date and minute of the day. Canberra observes Sydney's
// timezone, and the server itself runs in UTC.
export function canberraNow(now = new Date()): { date: string; minutes: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Australia/Sydney",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map((part) => [part.type, part.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

// The form's starting values: now in Canberra, rounded up to the start
// field's half-hour step.
export function searchDefaults(now = new Date()): { date: string; start: string } {
  const today = canberraNow(now);
  const minutes = Math.ceil(today.minutes / 30) * 30;
  const day = new Date(`${today.date}T00:00:00Z`);
  if (minutes === 24 * 60) day.setUTCDate(day.getUTCDate() + 1);
  return { date: day.toISOString().slice(0, 10), start: hhmm(minutes % (24 * 60)) };
}

// Separate from the overlap rule: a search can't start before now in Canberra.
function pastError(slot: Slot, now: Date): string | null {
  const today = canberraNow(now);
  if (slot.date < today.date) return "Choose today or a later date.";
  if (slot.date === today.date && slot.start < hhmm(today.minutes)) {
    return "That start time has already passed. Choose a later time.";
  }
  return null;
}

// Returns null when the form hasn't been submitted, and an error when it has
// but a field is missing, malformed or in the past.
export function parseSearch(
  params: URLSearchParams,
  now = new Date(),
): { query: SearchQuery } | { error: string } | null {
  if (!["date", "start", "duration", "people"].some((name) => params.get(name))) return null;

  const parsed = parseSlot(params);
  if ("error" in parsed) return parsed;
  const past = pastError(parsed.slot, now);
  if (past) return { error: past };
  const people = Number(params.get("people"));
  if (!PARTY_SIZES.includes(people)) return { error: "Choose how many people are coming." };
  const libraryValue = params.get("library") ?? "any";
  const library = LIBRARIES.find((option) => option.value === libraryValue);
  if (libraryValue !== "any" && !library) return { error: "Choose a library." };

  return { query: { ...parsed.slot, people, library: library?.name ?? null } };
}
