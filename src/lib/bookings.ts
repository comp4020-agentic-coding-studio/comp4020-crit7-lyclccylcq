import { and, asc, desc, eq, gt, gte, inArray, lt, lte, notExists, type SQL } from "drizzle-orm";
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

  // The check and the insert share one transaction, so no booking can slip in
  // between them. It is IMMEDIATE because another connection may be writing
  // to the same file (the spec's seeding connections do): a deferred
  // transaction that reads first can't upgrade to a write once someone else
  // has committed, and fails with "database is locked" instead of waiting.
  // Taking the write lock up front makes other writers wait (busy timeout).
  return db.transaction(
    (tx) => {
      const room = tx.select({ id: rooms.id }).from(rooms).where(eq(rooms.id, booking.roomId)).get();
      if (!room) throw new BookingError("no-such-room");
      if (!isRoomAvailable(booking.roomId, booking)) throw new BookingError("conflict");
      return tx.insert(bookings).values(booking).returning().get();
    },
    { behavior: "immediate" },
  );
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

export type BookingWithRoom = Interval & { id: number; createdAt: string; room: Room };

// State comes from the end time: active while it ends after `now`, past once it
// has ended. `now` is Canberra wall-clock ('YYYY-MM-DDTHH:MM'), passed in so
// callers share one clock and tests can pin it.
export function listBookings(now: string): { active: BookingWithRoom[]; past: BookingWithRoom[] } {
  const query = (state: SQL, ...order: SQL[]) =>
    db
      .select()
      .from(bookings)
      .innerJoin(rooms, eq(bookings.roomId, rooms.id))
      .where(state)
      .orderBy(...order)
      .all()
      .map((row) => ({
        id: row.bookings.id,
        startTime: row.bookings.startTime,
        endTime: row.bookings.endTime,
        createdAt: row.bookings.createdAt,
        room: row.rooms,
      }));

  return {
    // createdAt has one-second resolution, so the id breaks ties in creation order.
    active: query(gt(bookings.endTime, now), desc(bookings.createdAt), desc(bookings.id)),
    past: query(lte(bookings.endTime, now), desc(bookings.endTime), desc(bookings.id)),
  };
}

export function getRoom(id: number): Room | undefined {
  return db.select().from(rooms).where(eq(rooms.id, id)).get();
}

// Cancelling deletes the row, but only while the booking hasn't ended.
export function cancelBooking(id: number, now: string): "cancelled" | "not-found" | "ended" {
  const booking = db.select().from(bookings).where(eq(bookings.id, id)).get();
  if (!booking) return "not-found";
  if (booking.endTime <= now) return "ended";
  db.delete(bookings).where(eq(bookings.id, id)).run();
  return "cancelled";
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
