import type { Interval } from "./bookings";

export const DURATIONS = [30, 60, 90, 120];
export const PARTY_SIZES = [1, 2, 3, 4];
export const LIBRARIES = [
  { value: "chifley", name: "Chifley Library" },
  { value: "hancock", name: "Hancock Library" },
  { value: "law", name: "Law Library" },
];

export const SPACE_TYPES = [
  { value: "study_room", label: "Study room", noun: ["study room", "study rooms"] },
  { value: "computer_desk", label: "Computer desk", noun: ["computer desk", "computer desks"] },
] as const;
export const FACILITY_FILTERS = [
  { value: "power", label: "Power" },
  { value: "display", label: "Display" },
  { value: "accessible", label: "Accessible" },
  { value: "whiteboard", label: "Whiteboard" },
] as const;
export const DEVICE_FILTERS = [
  { value: "mac", label: "Mac" },
  { value: "windows", label: "Windows" },
  { value: "monitor", label: "External monitor" },
  { value: "none", label: "No equipment" },
] as const;

export type SpaceType = (typeof SPACE_TYPES)[number]["value"];
export type Facility = (typeof FACILITY_FILTERS)[number]["value"];
export type Device = (typeof DEVICE_FILTERS)[number]["value"];

export type Slot = Interval & { date: string; start: string; duration: number };
// library and type are null for "Any library" and "Any space".
export type SearchQuery = Slot & {
  people: number;
  library: string | null;
  type: SpaceType | null;
  facilities: Facility[];
  devices: Device[];
};

const SEARCH_FIELDS = ["date", "start", "duration", "people", "library", "type", "facility", "device"];

// Carries a search forward (to the review page, and back to the results),
// repeated facility/device values included.
export function searchParamsFrom(fields: { getAll(name: string): unknown[] }): URLSearchParams {
  const search = new URLSearchParams();
  for (const name of SEARCH_FIELDS) {
    for (const value of fields.getAll(name)) {
      if (typeof value === "string" && value) search.append(name, value);
    }
  }
  return search;
}

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
export function pastError(slot: Slot, now = new Date()): string | null {
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

  const typeValue = params.get("type") ?? "any";
  const type = SPACE_TYPES.find((option) => option.value === typeValue)?.value ?? null;
  if (typeValue !== "any" && !type) return { error: "Choose a space type." };

  const facilities = params.getAll("facility");
  const devices = params.getAll("device");
  const isFacility = (value: string): value is Facility => FACILITY_FILTERS.some((option) => option.value === value);
  const isDevice = (value: string): value is Device => DEVICE_FILTERS.some((option) => option.value === value);
  if (!facilities.every(isFacility) || !devices.every(isDevice)) return { error: "Choose filters from the list." };

  return {
    query: { ...parsed.slot, people, library: library?.name ?? null, type, facilities, devices },
  };
}
