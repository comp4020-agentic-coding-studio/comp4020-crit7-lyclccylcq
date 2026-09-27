import { and, eq } from "drizzle-orm";
import { JSDOM } from "jsdom";
import { beforeAll, describe, expect, inject, it } from "vitest";

// Search → Review → Confirm → My Bookings → Cancel, through the running app.
// Its own date, so no other spec's bookings get in the way.
const baseUrl = inject("baseUrl");
const date = "2030-06-10"; // a Monday

const load = async (path: string, status = 200) => {
  const res = await fetch(new URL(path, baseUrl));
  expect(res.status).toBe(status);
  return new JSDOM(await res.text()).window;
};

const post = (path: string, body: URLSearchParams) =>
  fetch(new URL(path, baseUrl), { method: "POST", headers: { origin: baseUrl }, body, redirect: "manual" });

const fieldsOf = (window: JSDOM["window"], form: Element) =>
  new URLSearchParams([...new window.FormData(form as HTMLFormElement).entries()] as [string, string][]);

const buttonNamed = (doc: Document, ...parts: string[]) =>
  [...doc.querySelectorAll("button")].find((button) => {
    const name = button.getAttribute("aria-label") ?? button.textContent ?? "";
    return parts.every((part) => name.includes(part));
  });

// Search, press Book room on `room`, and return the review page it leads to.
const review = async (room: string, start: string) => {
  const search = new URLSearchParams({ date, start, duration: "60", people: "2", library: "hancock" });
  const results = await load(`/?${search}`);
  const form = buttonNamed(results.document, "Book", room)?.closest("form");
  expect(form, `a Book room form for ${room}`).toBeTruthy();
  expect(form?.getAttribute("method")?.toLowerCase()).toBe("get");
  expect(form?.getAttribute("action")).toBe("/bookings/confirm");
  const path = `/bookings/confirm?${fieldsOf(results, form as Element)}`;
  return { path, window: await load(path) };
};

const confirmFormOf = (window: JSDOM["window"]) => {
  const form = buttonNamed(window.document, "Confirm booking")?.closest("form");
  expect(form?.getAttribute("method")?.toLowerCase()).toBe("post");
  expect(form?.getAttribute("action")).toBe("/bookings");
  return fieldsOf(window, form as Element);
};

let bookingsAt: (roomName: string, startTime: string) => number;
let bookDirectly: (roomName: string, startTime: string, endTime: string) => void;

beforeAll(async () => {
  process.env.DATABASE_PATH = inject("databasePath");
  const { db } = await import("../src/lib/db");
  const { bookings, rooms } = await import("../src/lib/schema");
  const { createBooking } = await import("../src/lib/bookings");
  const roomId = (name: string) => db.select().from(rooms).where(eq(rooms.name, name)).get()?.id ?? 0;
  bookingsAt = (roomName, startTime) =>
    db
      .select({ id: bookings.id })
      .from(bookings)
      .where(and(eq(bookings.roomId, roomId(roomName)), eq(bookings.startTime, startTime)))
      .all().length;
  bookDirectly = (roomName, startTime, endTime) => createBooking({ roomId: roomId(roomName), startTime, endTime });
});

describe("review before booking", () => {
  it("Book room leads to a review page and creates nothing", async () => {
    await review("Study Room 3.27", "10:00");

    expect(bookingsAt("Study Room 3.27", `${date}T10:00`)).toBe(0);
  });

  it("shows the room, library, level, date, times, capacity and verified facilities", async () => {
    const { window } = await review("Study Room 3.27", "10:00");
    const text = window.document.body.textContent ?? "";

    for (const detail of ["Study Room 3.27", "Hancock Library", "Level 3", "Monday", "10 June", "10:00 AM", "11:00 AM"]) {
      expect(text).toContain(detail);
    }
    expect(text).toContain("Up to 4 people");
    const facilities = window.document.querySelector('[aria-label="Facilities"]')?.textContent ?? "";
    expect(facilities).toContain("Power");
    expect(facilities).toContain("Accessible");
    expect(facilities).not.toMatch(/Display|Whiteboard/);
  });

  it("creates nothing when the review page is loaded again", async () => {
    const { path } = await review("Study Room 3.27", "10:00");
    await load(path);
    await load(path);

    expect(bookingsAt("Study Room 3.27", `${date}T10:00`)).toBe(0);
  });

  it("links back to the original search", async () => {
    const { window } = await review("Study Room 3.27", "10:00");
    const back = [...window.document.querySelectorAll("a")].find((a) => a.textContent?.includes("Back to results"));
    const target = new URL(back?.getAttribute("href") ?? "", baseUrl);

    expect(target.pathname).toBe("/");
    expect(Object.fromEntries(target.searchParams)).toEqual({
      date,
      start: "10:00",
      duration: "60",
      people: "2",
      library: "hancock",
    });
  });

  it("Confirm booking creates exactly one booking and goes to My Bookings", async () => {
    const { window } = await review("Study Room 3.27", "10:00");
    const res = await post("/bookings", confirmFormOf(window));

    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/bookings");
    expect(bookingsAt("Study Room 3.27", `${date}T10:00`)).toBe(1);
  });

  it("refuses the booking if the room was taken after the review page loaded", async () => {
    const { window } = await review("Study Room 3.28", "14:00");
    const confirmation = confirmFormOf(window);
    bookDirectly("Study Room 3.28", `${date}T14:30`, `${date}T15:30`);

    const res = await post("/bookings", confirmation);
    const doc = new JSDOM(await res.text()).window.document;
    const back = [...doc.querySelectorAll("a")].find((a) => a.textContent?.includes("Back to search"));

    expect(res.status).toBe(409);
    expect(doc.body.textContent).toMatch(/no longer available/i);
    expect(back?.getAttribute("href")).toContain(`date=${date}`);
    expect(bookingsAt("Study Room 3.28", `${date}T14:00`)).toBe(0);
  });
});

describe("navigation", () => {
  it.each(["/bookings", "/readme/", "/bookings/confirm?roomId=1&date=2030-06-01&start=10:00&duration=60"])(
    "%s links to Find a room, My bookings and About, and the brand goes home",
    async (path) => {
      const doc = (await load(path)).document;
      const nav = doc.querySelector('nav[aria-label="site"]');
      const hrefs = [...(nav?.querySelectorAll("a") ?? [])].map((a) => a.getAttribute("href"));

      expect(hrefs).toEqual(["/", "/bookings", "/readme/"]);
      expect(doc.querySelector("header a.brand")?.getAttribute("href")).toBe("/");
      for (const href of hrefs) expect((await fetch(new URL(href ?? "", baseUrl))).status).toBe(200);
    },
  );
});

describe("cancelling a booking", () => {
  const cancelFormFor = (doc: Document, room: string) =>
    buttonNamed(doc, "Cancel", room, "10 June")?.closest("form");

  it("removes it from My Bookings and says so", async () => {
    const { window } = await review("Study Room 3.29", "16:00");
    await post("/bookings", confirmFormOf(window));
    const before = await load("/bookings");
    const form = cancelFormFor(before.document, "Study Room 3.29");

    expect(form?.getAttribute("method")?.toLowerCase()).toBe("post");
    expect(form?.getAttribute("action")).toBe("/bookings/cancel");
    const res = await post("/bookings/cancel", fieldsOf(before, form as Element));

    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/bookings?cancelled=1");
    const after = (await load("/bookings?cancelled=1")).document;
    expect(after.body.textContent).toContain("Booking cancelled");
    expect(cancelFormFor(after, "Study Room 3.29")).toBeFalsy();
    expect(bookingsAt("Study Room 3.29", `${date}T16:00`)).toBe(0);
  });

  it("makes the room available again for an overlapping search", async () => {
    const search = new URLSearchParams({ date, start: "16:30", duration: "60", people: "2", library: "hancock" });
    const results = (await load(`/?${search}`)).document;

    expect(buttonNamed(results, "Book", "Study Room 3.29")).toBeTruthy();
  });

  it("answers 404 for a booking that doesn't exist", async () => {
    const res = await post("/bookings/cancel", new URLSearchParams({ bookingId: "999999" }));

    expect(res.status).toBe(404);
  });
});
