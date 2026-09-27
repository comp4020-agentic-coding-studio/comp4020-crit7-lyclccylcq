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

  it("won't offer a date before today, and limits party size to 1–4", async () => {
    const doc = await page("/");
    const canberraDay = (offsetDays: number) =>
      new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Sydney" }).format(
        new Date(Date.now() + offsetDays * 86_400_000),
      );
    const people = doc.querySelector("select#people");

    // yesterday only if the page rendered just before midnight
    expect([canberraDay(0), canberraDay(-1)]).toContain(doc.querySelector("#date")?.getAttribute("min"));
    expect([...(people?.querySelectorAll("option") ?? [])].map((option) => option.getAttribute("value"))).toEqual([
      "1",
      "2",
      "3",
      "4",
    ]);
  });

  it("rejects a search in the past on the server, even when the form is bypassed", async () => {
    const doc = await search({ date: "2020-01-01", people: "2" });

    expect(doc.querySelector('[role="alert"]')?.textContent).toBeTruthy();
    expect(doc.body.textContent).not.toContain("Study Room 1.01");
  });

  it("ranks the best-fitting rooms first across every library, for 2 people", async () => {
    const doc = await search({ date: "2030-06-06", people: "2" });
    const names = [...doc.querySelectorAll("h3")].map((heading) => heading.textContent?.trim());
    const twoPerson = ["4.02", "4.03", "4.04", "4.05", "4.06", "4.07"].map((room) => `Study Room ${room}`);

    expect(names).toHaveLength(30);
    expect(names.slice(0, 6).sort()).toEqual(twoPerson);
    expect(names[6]).toBe("Study Room 3.37"); // Hancock, seats 3
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

describe("library filter", () => {
  // A date no other spec books, so every seeded room is free.
  const date = "2030-06-07";
  const cards = (doc: Document) =>
    [...doc.querySelectorAll("h3")].map((heading) => ({
      name: heading.textContent?.trim(),
      text: heading.closest("li")?.textContent ?? "",
    }));

  it.each(["any", "chifley", "hancock", "law"])("renders a search for library=%s", async (library) => {
    const res = await fetch(
      new URL(`/?${new URLSearchParams({ date, start: "22:00", duration: "60", people: "1", library })}`, baseUrl),
    );

    expect(res.status).toBe(200);
  });

  it("offers Any library, Chifley, Hancock and Law, defaulting to Any library", async () => {
    const select = (await page("/")).querySelector("select#library");
    const options = [...(select?.querySelectorAll("option") ?? [])];

    expect(options.map((option) => option.getAttribute("value"))).toEqual(["any", "chifley", "hancock", "law"]);
    expect(select?.querySelector("option:checked")?.getAttribute("value")).toBe("any");
  });

  it("searches all three libraries for Any library, and says so", async () => {
    const doc = await search({ date, people: "4", library: "any" });
    const libraries = new Set(cards(doc).map((card) => card.text.match(/(Chifley|Hancock|Law) Library/)?.[0]));

    expect(libraries).toEqual(new Set(["Chifley Library", "Hancock Library", "Law Library"]));
    expect(doc.querySelector("h2")?.textContent).toMatch(/spaces available across 3 libraries/);
  });

  it("limits results to one library when one is chosen, and names it", async () => {
    const doc = await search({ date, people: "4", library: "hancock" });
    const found = cards(doc);

    expect(found).toHaveLength(8); // nine Hancock rooms, less 3.37 which seats 3
    for (const card of found) expect(card.text).toContain("Hancock Library");
    expect(doc.querySelector("h2")?.textContent).toMatch(/8 spaces available at Hancock Library/);
  });

  it("still puts the best fit first inside a library: Hancock 3.37 for 3 people", async () => {
    const found = cards(await search({ date, people: "3", library: "hancock" }));

    expect(found).toHaveLength(9);
    expect(found[0].name).toBe("Study Room 3.37");
  });

  it("shows only verified facilities, as text screen readers can read", async () => {
    const card = (await search({ date, people: "3", library: "hancock" })).querySelector("li:has(h3)");
    const facilities = card?.querySelector('[aria-label="Facilities"]');

    expect(facilities?.textContent).toContain("Power");
    expect(facilities?.textContent).toContain("Accessible");
    expect(facilities?.textContent).not.toMatch(/Display|Whiteboard/);
    for (const icon of facilities?.querySelectorAll("svg") ?? []) expect(icon.getAttribute("aria-hidden")).toBe("true");
  });
});
