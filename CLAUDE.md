# Harness

An availability-first study-room booking prototype (Astro, Drizzle, SQLite on
Fly.io). Read `README.md` for what it is; these are the rules for changing it.

## Domain rules

- Bookings are half-open intervals `[start, end)`. Two bookings overlap exactly
  when `existing.start < request.end AND existing.end > request.start`.
  Back-to-back bookings are valid.
- Times are fixed-width `'YYYY-MM-DDTHH:MM'` Canberra wall-clock strings,
  compared as text. Never convert them to `Date`: the server runs in UTC.
- `createBooking` in `src/lib/bookings.ts` is the only way a booking is
  written. It rejects bad intervals, missing rooms and conflicts itself,
  inside one transaction.
- UI and routes must not bypass `createBooking` or re-implement the overlap
  rule. Search uses `findAvailableRooms`, which shares the same condition.
- Room facilities are nullable: true = verified present, false = verified
  absent, null = not verified. Only show true. Never infer a facility; room
  data comes from ANU LibCal and goes in through a migration.
- Single-user prototype: no authentication. Don't add sign-in without being
  asked.

## Working here

- Red first: write or extend a test in `spec/`, run it and see it fail for the
  right reason, then implement. Red and green are committed separately.
- Test contracts through the running app (HTTP) where possible, not
  implementation details.
- Schema changes only through `src/lib/schema.ts` + `pnpm db:generate`, with
  the migration and its snapshot committed. Never edit the database by hand.
- After any Drizzle schema or migration change, restart the dev server
  (`pnpm exec astro dev stop`, then `pnpm dev`) before testing it by hand. Hot
  reload can keep a Drizzle `db` built against the previous schema, and
  migrations only run when the server starts.
- Add every new page to `spec/routes.ts` so the invariants cover it.
- Keep `/api/events`: the CI deploy job probes it.
- Don't create bookings on the live site unless asked. There is no cancel, so
  they stay.
