import { and, asc, eq, gt, gte, inArray, lt, notExists } from "drizzle-orm";
import { db } from "./db";
import { type Booking, bookings, type Room, rooms } from "./schema";
import type { Device, Facility, SpaceType } from "./search";

export type Interval = { startTime: string; endTime: string };

export function createRoom(room: typeof rooms.$inferInsert): Room {
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

export type BookingWithRoom = Interval & { id: number; room: Room };

export function listBookings(): BookingWithRoom[] {
  return db
    .select()
    .from(bookings)
    .innerJoin(rooms, eq(bookings.roomId, rooms.id))
    .orderBy(asc(bookings.startTime), asc(rooms.name))
    .all()
    .map((row) => ({ id: row.bookings.id, startTime: row.bookings.startTime, endTime: row.bookings.endTime, room: row.rooms }));
}

export function getRoom(id: number): Room | undefined {
  return db.select().from(rooms).where(eq(rooms.id, id)).get();
}

// Cancelling deletes the row; returns false when there was no such booking.
export function cancelBooking(id: number): boolean {
  return db.delete(bookings).where(eq(bookings.id, id)).run().changes > 0;
}

const FACILITY_COLUMNS = {
  power: rooms.hasPower,
  display: rooms.hasDisplay,
  accessible: rooms.isAccessible,
  whiteboard: rooms.hasWhiteboard,
};

export type SpaceSearch = Interval & {
  people: number;
  library: string | null; // null searches every library
  type?: SpaceType | null; // null searches every kind of space
  facilities?: Facility[]; // each must be verified true (AND); null never matches
  devices?: Device[]; // any of these (OR); study rooms have none
};

export function findAvailableRooms(request: SpaceSearch): Room[] {
  const { facilities = [], devices = [], type = null } = request;
  return db
    .select()
    .from(rooms)
    .where(
      and(
        gte(rooms.capacity, request.people),
        request.library === null ? undefined : eq(rooms.library, request.library),
        type === null ? undefined : eq(rooms.type, type),
        ...facilities.map((facility) => eq(FACILITY_COLUMNS[facility], true)),
        devices.length === 0 ? undefined : inArray(rooms.deviceType, devices),
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
    // Every result seats the party, so the smallest capacity is the best fit.
    .orderBy(asc(rooms.capacity), asc(rooms.name))
    .all();
}
