import type { Interval } from "./bookings";

export const DURATIONS = [30, 60, 90, 120];

export type Slot = Interval & { date: string; start: string; duration: number };
export type SearchQuery = Slot & { people: number };

type Fields = { get(name: string): unknown };

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
  const end = `${String(Math.floor(endMinutes / 60)).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}`;

  return { slot: { date, start, duration, startTime: `${date}T${start}`, endTime: `${date}T${end}` } };
}

// The form's starting values: Canberra's current date and time, rounded up to
// the start field's half-hour step. Canberra observes Sydney's timezone, and
// the server itself runs in UTC.
export function searchDefaults(now = new Date()): { date: string; start: string } {
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

  const minutes = Math.ceil((Number(parts.hour) * 60 + Number(parts.minute)) / 30) * 30;
  const day = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)));
  if (minutes === 24 * 60) day.setUTCDate(day.getUTCDate() + 1);
  const rounded = minutes % (24 * 60);

  return {
    date: day.toISOString().slice(0, 10),
    start: `${String(Math.floor(rounded / 60)).padStart(2, "0")}:${String(rounded % 60).padStart(2, "0")}`,
  };
}

// Returns null when the form hasn't been submitted, and an error when it has
// but a field is missing or malformed.
export function parseSearch(params: URLSearchParams): { query: SearchQuery } | { error: string } | null {
  if (!["date", "start", "duration", "people"].some((name) => params.get(name))) return null;

  const parsed = parseSlot(params);
  if ("error" in parsed) return parsed;
  const people = Number(params.get("people"));
  if (!Number.isInteger(people) || people < 1) return { error: "Enter how many people are coming." };

  return { query: { ...parsed.slot, people } };
}
