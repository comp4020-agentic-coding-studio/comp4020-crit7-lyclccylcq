import { and, eq } from "drizzle-orm";
import { JSDOM } from "jsdom";
import { beforeAll, describe, expect, inject, it } from "vitest";

// The smallest complete flow, through the running app: search, press Book on
// a result, see it in My Bookings, reload, and have the server refuse a
// second overlapping booking even when the search page is bypassed.
const baseUrl = inject("baseUrl");
const room = "Study Room 3.05";
const date = "2030-06-05";

const page = async (path: string) => {
  const res = await fetch(new URL(path, baseUrl));
  expect(res.status).toBe(200);
  return new JSDOM(await res.text()).window;
};

// Astro refuses form POSTs without a same-origin Origin header (CSRF); a
// browser sends one, a bare fetch doesn't.
const post = (path: string, body: URLSearchParams) =>
  fetch(new URL(path, baseUrl), { method: "POST", headers: { origin: baseUrl }, body, redirect: "manual" });

let bookingsFor: (roomName: string, startTime: string) => { id: number }[];
let roomIdOf: (roomName: string) => number | undefined;

beforeAll(async () => {
  process.env.DATABASE_PATH = inject("databasePath");
  const { db } = await import("../src/lib/db");
  const { bookings, rooms } = await import("../src/lib/schema");
  bookingsFor = (roomName, startTime) =>
    db
      .select({ id: bookings.id })
      .from(bookings)
      .innerJoin(rooms, eq(bookings.roomId, rooms.id))
      .where(and(eq(rooms.name, roomName), eq(bookings.startTime, startTime)))
      .all();
  roomIdOf = (roomName) => db.select().from(rooms).where(eq(rooms.name, roomName)).get()?.id;
});

describe("booking flow", () => {
  let bookingForm: URLSearchParams;

  it("gives each search result a Book action that leads to a Confirm booking form", async () => {
    const fields = (window: JSDOM["window"], form: Element) =>
      new URLSearchParams([...new window.FormData(form as HTMLFormElement).entries()] as [string, string][]);
    const named = (window: JSDOM["window"], ...parts: string[]) =>
      [...window.document.querySelectorAll("button")].find((candidate) => {
        const name = candidate.getAttribute("aria-label") ?? candidate.textContent ?? "";
        return parts.every((part) => name.includes(part));
      });

    const results = await page(`/?${new URLSearchParams({ date, start: "10:00", duration: "60", people: "2" })}`);
    const bookForm = named(results, "Book", room)?.closest("form");
    expect(bookForm, `a Book button for ${room} inside a form`).toBeTruthy();

    const review = await page(`${bookForm?.getAttribute("action")}?${fields(results, bookForm as Element)}`);
    const confirmForm = named(review, "Confirm booking")?.closest("form");
    expect(confirmForm?.getAttribute("method")?.toLowerCase()).toBe("post");
    expect(confirmForm?.getAttribute("action")).toBe("/bookings");
    bookingForm = fields(review, confirmForm as Element);
  });

  it("creates the booking in SQLite when that form is submitted", async () => {
    const res = await post("/bookings", bookingForm);

    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toMatch(/^\/bookings\?booked=\d+$/);
    expect(bookingsFor(room, `${date}T10:00`)).toHaveLength(1);
  });

  it("shows the booking in My Bookings: room, date, start and end", async () => {
    const text = (await page("/bookings")).document.body.textContent ?? "";

    for (const detail of [room, "5 June", "10:00", "11:00"]) expect(text).toContain(detail);
  });

  it("still shows the booking after a reload", async () => {
    await page("/bookings");
    const text = (await page("/bookings")).document.body.textContent ?? "";

    expect(text).toContain(room);
    expect(text).toContain("10:00");
  });

  it("rejects an overlapping booking for the same room, even bypassing search", async () => {
    const res = await post(
      "/bookings",
      new URLSearchParams({ roomId: String(roomIdOf(room)), date, start: "10:30", duration: "60" }),
    );

    expect(res.status).toBe(409);
    expect(bookingsFor(room, `${date}T10:30`)).toHaveLength(0);
    expect(bookingsFor(room, `${date}T10:00`)).toHaveLength(1);
  });
});
