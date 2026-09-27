import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// db.ts opens DATABASE_PATH at import time, so point it at a throwaway file first.
process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), "availability-db-")), "test.db");
const { createRoom, createBooking, isRoomAvailable } = await import("../src/lib/bookings");

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
