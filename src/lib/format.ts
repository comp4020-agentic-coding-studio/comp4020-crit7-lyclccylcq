// Display-only formatting. Stored times stay 'YYYY-MM-DDTHH:MM' strings.

const clock = (hhmm: string) => {
  const [hours, minutes] = hhmm.split(":").map(Number);
  const period = hours % 24 < 12 ? "AM" : "PM";
  return { text: `${hours % 12 || 12}:${String(minutes).padStart(2, "0")}`, period };
};

// "14:00", "15:00" → "2:00–3:00 PM"; "11:30", "12:30" → "11:30 AM–12:30 PM"
export function timeRange(start: string, end: string): string {
  const from = clock(start);
  const to = clock(end);
  return from.period === to.period
    ? `${from.text}–${to.text} ${to.period}`
    : `${from.text} ${from.period}–${to.text} ${to.period}`;
}

// "2026-10-01" → "Thu 1 Oct". Built in UTC so the server's timezone can't shift the day.
export function shortDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

// Chifley room names carry the floor: "Study Room 4.02" is on floor 4.
export function floorOf(roomName: string): string | null {
  return roomName.match(/(\d+)\.\d/)?.[1] ?? null;
}

export function durationLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = minutes / 60;
  return `${hours} ${hours === 1 ? "hour" : "hours"}`;
}
