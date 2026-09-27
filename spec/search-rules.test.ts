import { describe, expect, it } from "vitest";
import { parseSearch, searchDefaults } from "../src/lib/search";

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

describe("search rejects times that have already passed", () => {
  // 11:08 UTC is 21:08 in Canberra on 2026-09-27.
  const now = new Date("2026-09-27T11:08:00Z");
  const searchAt = (date: string, start: string) =>
    parseSearch(new URLSearchParams({ date, start, duration: "60", people: "2" }), now);

  it.each([
    ["2026-09-26", "22:00", "a date before today"],
    ["2026-09-27", "21:00", "earlier today"],
  ])("rejects %s %s (%s)", (date, start) => {
    expect(searchAt(date, start)).toHaveProperty("error");
  });

  it.each([
    ["2026-09-27", "21:08", "the current minute"],
    ["2026-09-27", "21:30", "later today"],
    ["2026-09-28", "01:00", "early tomorrow, before today's clock time"],
  ])("accepts %s %s (%s)", (date, start) => {
    expect(searchAt(date, start)).toHaveProperty("query");
  });
});

describe("search accepts only the party sizes the rooms offer", () => {
  it.each(["0", "5", "2.5", "many"])("rejects people=%s", (people) => {
    const params = new URLSearchParams({ date: "2030-06-03", start: "10:00", duration: "60", people });
    expect(parseSearch(params)).toHaveProperty("error");
  });
});
