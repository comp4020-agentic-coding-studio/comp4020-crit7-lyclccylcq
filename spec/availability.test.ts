import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// db.ts opens DATABASE_PATH at import time, so point it at a throwaway file first.
process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), "availability-db-")), "test.db");
const { cancelBooking, createRoom, createBooking, findAvailableRooms, isRoomAvailable, listBookings } =
  await import("../src/lib/bookings");

const at = (hhmm: string) => `2026-10-01T${hhmm}`;
const newRoom = () => createRoom({ name: "Test room", library: "Test library", capacity: 4 });

const rejectionOf = (attempt: () => unknown): unknown => {
  try {
    attempt();
  } catch (error) {
    return error;
  }
  throw new Error("expected the booking to be rejected, but it was created");
};

describe("an existing booking affects availability", () => {
  it("a room booked 14:00–15:00 is no longer available for 14:00–15:00", () => {
    const room = newRoom();
    const slot = { startTime: at("14:00"), endTime: at("15:00") };

    expect(isRoomAvailable(room.id, slot)).toBe(true);
    createBooking({ roomId: room.id, ...slot });
    expect(isRoomAvailable(room.id, slot)).toBe(false);
  });

  it.each([
    ["13:00", "14:00", true],
    ["15:00", "16:00", true],
    ["14:00", "15:00", false],
    ["14:30", "15:30", false],
    ["13:30", "14:30", false],
    ["13:30", "15:30", false],
  ])("with 14:00–15:00 booked, %s–%s available: %s", (start, end, available) => {
    const room = newRoom();
    createBooking({ roomId: room.id, startTime: at("14:00"), endTime: at("15:00") });

    expect(isRoomAvailable(room.id, { startTime: at(start), endTime: at(end) })).toBe(available);
  });
});

describe("createBooking enforces its own invariants", () => {
  it.each([
    ["14:00", "14:00"],
    ["15:00", "14:00"],
  ])("rejects %s–%s: start must be before end", (start, end) => {
    const room = newRoom();

    expect(
      rejectionOf(() => createBooking({ roomId: room.id, startTime: at(start), endTime: at(end) })),
    ).toMatchObject({ reason: "invalid-interval" });
  });

  it("rejects a booking for a room that does not exist", () => {
    expect(
      rejectionOf(() => createBooking({ roomId: 999_999, startTime: at("14:00"), endTime: at("15:00") })),
    ).toMatchObject({ reason: "no-such-room" });
  });

  it("rejects a booking that overlaps an existing one, and leaves the room's other times free", () => {
    const room = newRoom();
    createBooking({ roomId: room.id, startTime: at("14:00"), endTime: at("15:00") });

    expect(
      rejectionOf(() => createBooking({ roomId: room.id, startTime: at("14:30"), endTime: at("15:30") })),
    ).toMatchObject({ reason: "conflict" });
    expect(isRoomAvailable(room.id, { startTime: at("15:00"), endTime: at("16:00") })).toBe(true);
  });

  it("accepts back-to-back bookings: 13:00–14:00 then 14:00–15:00", () => {
    const room = newRoom();

    createBooking({ roomId: room.id, startTime: at("13:00"), endTime: at("14:00") });
    expect(() =>
      createBooking({ roomId: room.id, startTime: at("14:00"), endTime: at("15:00") }),
    ).not.toThrow();
  });
});

describe("facility filters combine with AND and ignore unverified values", () => {
  it("Power + Accessible needs both verified true", () => {
    const library = "Filter Test Library";
    const make = (name: string, hasPower: boolean | null, isAccessible: boolean | null) =>
      createRoom({ name, library, capacity: 2, hasPower, isAccessible });
    make("Both", true, true);
    make("Power only", true, null);
    make("Accessible only", null, true);
    make("Power, not accessible", true, false);

    const found = findAvailableRooms({
      startTime: at("09:00"),
      endTime: at("10:00"),
      people: 1,
      library,
      facilities: ["power", "accessible"],
    });

    expect(found.map((room) => room.name)).toEqual(["Both"]);
  });
});

describe("booking state comes from its end time, against a pinned now", () => {
  const now = "2026-09-27T21:00"; // Canberra wall-clock, as canberraStamp would give it
  const day = (hhmm: string) => `2026-09-27T${hhmm}`;

  it("splits active (ends after now) from past (ends at or before now)", () => {
    const room = newRoom();
    const ended = createBooking({ roomId: room.id, startTime: day("19:00"), endTime: day("20:00") });
    const endsNow = createBooking({ roomId: room.id, startTime: day("20:00"), endTime: day("21:00") });
    const ongoing = createBooking({ roomId: room.id, startTime: day("21:00"), endTime: day("22:00") });
    const { active, past } = listBookings(now);
    const ids = (list: { id: number }[]) => list.map((booking) => booking.id);

    expect(ids(active)).toContain(ongoing.id);
    expect(ids(past)).toEqual(expect.arrayContaining([ended.id, endsNow.id]));
    expect(ids(active)).not.toContain(endsNow.id);
    expect(ids(past).indexOf(endsNow.id)).toBeLessThan(ids(past).indexOf(ended.id));
  });

  it("orders active bookings newest-created first", () => {
    const room = newRoom();
    const earlier = createBooking({ roomId: room.id, startTime: "2030-01-02T09:00", endTime: "2030-01-02T10:00" });
    const later = createBooking({ roomId: room.id, startTime: "2030-01-01T09:00", endTime: "2030-01-01T10:00" });
    const ids = listBookings(now).active.map((booking) => booking.id);

    expect(ids.indexOf(later.id)).toBeLessThan(ids.indexOf(earlier.id));
  });

  it("cancels an active booking but keeps an ended one", () => {
    const room = newRoom();
    const ended = createBooking({ roomId: room.id, startTime: day("18:00"), endTime: day("19:00") });
    const upcoming = createBooking({ roomId: room.id, startTime: day("22:00"), endTime: day("23:00") });

    expect(cancelBooking(ended.id, now)).toBe("ended");
    expect(isRoomAvailable(room.id, { startTime: day("18:00"), endTime: day("19:00") })).toBe(false);
    expect(cancelBooking(upcoming.id, now)).toBe("cancelled");
    expect(isRoomAvailable(room.id, { startTime: day("22:00"), endTime: day("23:00") })).toBe(true);
    expect(cancelBooking(999_999, now)).toBe("not-found");
  });
});
