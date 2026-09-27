import { eq } from "drizzle-orm";
import { JSDOM } from "jsdom";
import { beforeAll, describe, expect, inject, it } from "vitest";

// Active vs past bookings on My Bookings. Bookings are seeded straight into
// the test server's database: 2020 is always past and 2030 always ahead, so
// the real clock can't change which section they land in.
const baseUrl = inject("baseUrl");

const myBookings = async () => {
  const res = await fetch(new URL("/bookings", baseUrl));
  expect(res.status).toBe(200);
  return new JSDOM(await res.text()).window.document;
};
const post = (path: string, body: URLSearchParams) =>
  fetch(new URL(path, baseUrl), { method: "POST", headers: { origin: baseUrl }, body, redirect: "manual" });

const section = (doc: Document, title: string) =>
  [...doc.querySelectorAll("main h2")].find((h) => h.textContent?.trim() === title)?.closest("section") ?? null;
const cardsIn = (area: Element | null) =>
  [...(area?.querySelectorAll("li") ?? [])].map((li) => ({ text: li.textContent ?? "", li }));
const cardFor = (area: Element | null, room: string, day: string) =>
  cardsIn(area).find((card) => card.text.includes(room) && card.text.includes(day));

let book: (room: string, startTime: string, endTime: string) => number;
let exists: (id: number) => boolean;

beforeAll(async () => {
  process.env.DATABASE_PATH = inject("databasePath");
  const { db } = await import("../src/lib/db");
  const { bookings, rooms } = await import("../src/lib/schema");
  const { createBooking } = await import("../src/lib/bookings");
  book = (room, startTime, endTime) => {
    const roomId = db.select().from(rooms).where(eq(rooms.name, room)).get()?.id ?? 0;
    return createBooking({ roomId, startTime, endTime }).id;
  };
  exists = (id) => db.select().from(bookings).where(eq(bookings.id, id)).get() !== undefined;
});

describe("active and past bookings", () => {
  it("shows a future booking under Active bookings, with Cancel", async () => {
    book("Study Room 2", "2030-06-14T09:00", "2030-06-14T10:00");
    const card = cardFor(section(await myBookings(), "Active bookings"), "Study Room 2", "14 June");

    expect(card).toBeTruthy();
    expect(card?.li.querySelector("button")?.textContent).toContain("Cancel booking");
  });

  it("shows an ended booking under Past bookings, marked Completed, with no Cancel", async () => {
    book("Study Room 4", "2020-03-02T10:00", "2020-03-02T11:00");
    const doc = await myBookings();
    const card = cardFor(section(doc, "Past bookings"), "Study Room 4", "2 March");

    expect(card?.text).toContain("Completed");
    expect(card?.li.querySelector("button, form")).toBeNull();
    expect(cardFor(section(doc, "Active bookings"), "Study Room 4", "2 March")).toBeUndefined();
  });

  it("refuses to cancel an ended booking, with a 409 and a way back", async () => {
    const id = book("Study Room 4", "2020-04-06T10:00", "2020-04-06T11:00");
    const res = await post("/bookings/cancel", new URLSearchParams({ bookingId: String(id) }));
    const doc = new JSDOM(await res.text()).window.document;

    expect(res.status).toBe(409);
    expect(doc.querySelector("h1")?.textContent).toBe("Booking already ended");
    expect(doc.querySelector("main")?.textContent).toContain(
      "This booking has already ended and can no longer be cancelled.",
    );
    expect([...doc.querySelectorAll("main a")].some((a) => a.getAttribute("href") === "/bookings")).toBe(true);
    expect(exists(id)).toBe(true);
  });

  it("lists the booking created later first among active bookings", async () => {
    book("Study Room 3", "2030-06-15T09:00", "2030-06-15T10:00");
    book("Study Room 1", "2030-06-16T09:00", "2030-06-16T10:00"); // later date, but created second
    const active = cardsIn(section(await myBookings(), "Active bookings"));
    const first = active.findIndex((card) => card.text.includes("Study Room 3") && card.text.includes("15 June"));
    const second = active.findIndex((card) => card.text.includes("Study Room 1") && card.text.includes("16 June"));

    expect(first).toBeGreaterThanOrEqual(0);
    expect(second).toBeGreaterThanOrEqual(0);
    expect(second).toBeLessThan(first);
  });

  it("lists past bookings with the most recently ended first", async () => {
    book("Study Room 3", "2020-02-03T10:00", "2020-02-03T11:00");
    book("Study Room 3", "2020-01-06T10:00", "2020-01-06T11:00");
    const past = cardsIn(section(await myBookings(), "Past bookings"));
    const february = past.findIndex((card) => card.text.includes("Study Room 3") && card.text.includes("3 February"));
    const january = past.findIndex((card) => card.text.includes("Study Room 3") && card.text.includes("6 January"));

    expect(february).toBeGreaterThanOrEqual(0);
    expect(february).toBeLessThan(january);
  });
});
