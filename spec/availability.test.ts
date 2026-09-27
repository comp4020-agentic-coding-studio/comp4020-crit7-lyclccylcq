import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// db.ts opens DATABASE_PATH at import time, so point it at a throwaway file first.
process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), "availability-db-")), "test.db");
const { createRoom, createBooking, isRoomAvailable } = await import("../src/lib/bookings");

const at = (hhmm: string) => `2026-10-01T${hhmm}`;
const newRoom = () => createRoom({ name: "Test room", library: "Test library", capacity: 4 });

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
