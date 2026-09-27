import { and, asc, eq, gt, gte, lt, notExists } from "drizzle-orm";
import { db } from "./db";
import { type Booking, bookings, type Room, rooms } from "./schema";

export type Interval = { startTime: string; endTime: string };

export function createRoom(room: Omit<Room, "id">): Room {
  return db.insert(rooms).values(room).returning().get();
}

export type BookingRejection = "invalid-interval" | "no-such-room" | "conflict";

export class BookingError extends Error {
  constructor(readonly reason: BookingRejection) {
    super(`booking rejected: ${reason}`);
    this.name = "BookingError";
  }
}

export function createBooking(booking: { roomId: number } & Interval): Booking {
  if (booking.startTime >= booking.endTime) throw new BookingError("invalid-interval");

  // better-sqlite3 is synchronous on one connection, so the check and the
  // insert can't be interleaved with another booking.
  return db.transaction((tx) => {
    const room = tx.select({ id: rooms.id }).from(rooms).where(eq(rooms.id, booking.roomId)).get();
    if (!room) throw new BookingError("no-such-room");
    if (!isRoomAvailable(booking.roomId, booking)) throw new BookingError("conflict");
    return tx.insert(bookings).values(booking).returning().get();
  });
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

export function findAvailableRooms(request: Interval & { people: number }): Room[] {
  return db
    .select()
    .from(rooms)
    .where(
      and(
        gte(rooms.capacity, request.people),
        notExists(
          db
            .select({ id: bookings.id })
            .from(bookings)
            .where(
              and(
                eq(bookings.roomId, rooms.id),
                lt(bookings.startTime, request.endTime),
                gt(bookings.endTime, request.startTime),
              ),
            ),
        ),
      ),
    )
    .orderBy(asc(rooms.name))
    .all();
}
