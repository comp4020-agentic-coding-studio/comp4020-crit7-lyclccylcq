import type { Interval } from "./bookings";

export const DURATIONS = [30, 60, 90, 120];

export type SearchQuery = Interval & { date: string; start: string; duration: number; people: number };

// Returns null when the form hasn't been submitted, and an error when it has
// but a field is missing or malformed.
export function parseSearch(params: URLSearchParams): { query: SearchQuery } | { error: string } | null {
  const date = params.get("date") ?? "";
  const start = params.get("start") ?? "";
  const duration = Number(params.get("duration"));
  const people = Number(params.get("people"));
  if (![date, start, params.get("duration"), params.get("people")].some(Boolean)) return null;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Choose a date." };
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(start)) return { error: "Choose a start time." };
  if (!DURATIONS.includes(duration)) return { error: "Choose a duration." };
  if (!Number.isInteger(people) || people < 1) return { error: "Enter how many people are coming." };

  const [hours, minutes] = start.split(":").map(Number);
  const endMinutes = hours * 60 + minutes + duration;
  if (endMinutes > 24 * 60) return { error: "The booking has to finish by midnight." };
  const end = `${String(Math.floor(endMinutes / 60)).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}`;

  return {
    query: { date, start, duration, people, startTime: `${date}T${start}`, endTime: `${date}T${end}` },
  };
}
