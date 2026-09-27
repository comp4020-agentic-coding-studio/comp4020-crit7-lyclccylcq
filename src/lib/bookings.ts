import { and, eq, gt, lt } from "drizzle-orm";
import { db } from "./db";
import { type Booking, bookings, type Room, rooms } from "./schema";

export type Interval = { startTime: string; endTime: string };

export function createRoom(room: Omit<Room, "id">): Room {
  return db.insert(rooms).values(room).returning().get();
}

export function createBooking(booking: { roomId: number } & Interval): Booking {
  return db.insert(bookings).values(booking).returning().get();
}

// Bookings are half-open [start, end): back-to-back bookings don't overlap.
export function isRoomAvailable(roomId: number, request: Interval): boolean {
  const conflict = db
    .select({ id: bookings.id })
    .from(bookings)
    .where(
      and(
        eq(bookings.roomId, roomId),
        lt(bookings.startTime, request.endTime),
        gt(bookings.endTime, request.startTime),
      ),
    )
    .get();
  return conflict === undefined;
}
