import { JSDOM } from "jsdom";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, inject, it } from "vitest";

// Drives the running app over HTTP against the seeded Chifley rooms:
// 1.01 seats 4, 4.02 seats 2.
const baseUrl = inject("baseUrl");

const page = async (path: string) => {
  const res = await fetch(new URL(path, baseUrl));
  expect(res.status).toBe(200);
  return new JSDOM(await res.text()).window.document;
};

const search = (params: Record<string, string>) =>
  page(`/?${new URLSearchParams({ date: "2030-06-03", start: "14:00", duration: "60", ...params })}`);

describe("search page", () => {
  it("offers a search form with date, start time, duration and party size", async () => {
    const doc = await page("/");
    const form = doc.querySelector('form[method="get" i]');

    expect(form).not.toBeNull();
    for (const field of ["date", "start", "duration", "people"]) {
      expect(form?.querySelector(`[name="${field}"]`), `field "${field}"`).not.toBeNull();
    }
  });

  it("defaults the date to today in Canberra and the start to a half-hour time", async () => {
    const doc = await page("/");
    const canberraDay = (offsetDays: number) =>
      new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Sydney" }).format(
        new Date(Date.now() + offsetDays * 86_400_000),
      );

    // tomorrow only when "now" rounds up past midnight
    expect([canberraDay(0), canberraDay(1)]).toContain(doc.querySelector<HTMLInputElement>("#date")?.value);
    expect(doc.querySelector<HTMLInputElement>("#start")?.value).toMatch(/^([01]\d|2[0-3]):(00|30)$/);
  });

  it("keeps date and start from the URL exactly, instead of the defaults", async () => {
    const doc = await page("/?date=2030-06-03&start=09:45");

    expect(doc.querySelector<HTMLInputElement>("#date")?.value).toBe("2030-06-03");
    expect(doc.querySelector<HTMLInputElement>("#start")?.value).toBe("09:45");
  });

  it("lists rooms big enough for the party, and leaves out ones that are too small", async () => {
    const text = (await search({ people: "3" })).body.textContent ?? "";

    expect(text).toContain("Study Room 1.01");
    expect(text).not.toContain("Study Room 4.02");
  });

  it("includes two-person rooms for a party of two", async () => {
    const text = (await search({ people: "2" })).body.textContent ?? "";

    expect(text).toContain("Study Room 4.02");
    expect(text).toContain("Study Room 1.01");
  });
});

describe("search results respect existing bookings", () => {
  // Study Room 1.01 is booked 14:00–15:00 on this date, straight into the
  // server's database, since there's no booking UI to create it through yet.
  const date = "2030-06-04";

  beforeAll(async () => {
    process.env.DATABASE_PATH = inject("databasePath");
    const { db } = await import("../src/lib/db");
    const { rooms } = await import("../src/lib/schema");
    const { createBooking } = await import("../src/lib/bookings");
    const room = db.select().from(rooms).where(eq(rooms.name, "Study Room 1.01")).get();
    if (!room) throw new Error("seeded room Study Room 1.01 not found");
    createBooking({ roomId: room.id, startTime: `${date}T14:00`, endTime: `${date}T15:00` });
  });

  it.each([
    ["13:00", "60", true],
    ["14:00", "60", false],
    ["14:30", "60", false],
    ["15:00", "60", true],
  ])("with 14:00–15:00 booked, searching from %s for %s minutes lists it: %s", async (start, duration, listed) => {
    const text = (await search({ date, start, duration, people: "4" })).body.textContent ?? "";

    if (listed) expect(text).toContain("Study Room 1.01");
    else expect(text).not.toContain("Study Room 1.01");
    expect(text).toContain("Study Room 1.02");
  });
});
