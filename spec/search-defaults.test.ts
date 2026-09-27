import { describe, expect, it } from "vitest";
import { searchDefaults } from "../src/lib/search";

// Fixed instants in UTC, as the Fly.io server sees them; the defaults must be
// Canberra wall-clock time, rounded up to the form's half-hour step.
describe("search form defaults", () => {
  it.each([
    ["2026-09-27T10:47:00Z", "2026-09-27", "21:00", "AEST, rounds up"],
    ["2026-09-27T10:30:00Z", "2026-09-27", "20:30", "already on the half hour"],
    ["2026-10-05T03:10:00Z", "2026-10-05", "14:30", "AEDT after daylight saving starts"],
    ["2026-09-27T14:05:00Z", "2026-09-28", "00:30", "UTC is still the 27th, Canberra is the 28th"],
    ["2026-09-27T13:50:00Z", "2026-09-28", "00:00", "rounding past midnight rolls to tomorrow"],
  ])("at %s the default is %s %s (%s)", (instant, date, start) => {
    expect(searchDefaults(new Date(instant))).toEqual({ date, start });
  });
});
