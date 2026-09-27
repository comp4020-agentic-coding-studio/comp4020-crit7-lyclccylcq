# Find a study room

An availability-first redesign of the ANU Library study-room booking
experience. You say when you need a room, for how long and for how many
people, and it shows only the rooms you can actually book.

## The problem

The current booking interface is a timetable: rooms down one side, times across
the top. To answer "what can I book at 2pm for an hour?" you scroll the grid
horizontally and scan row by row for a free cell, room after room. The visual
hierarchy doesn't help. The question you arrive with is about a time, but the
interface is organised around rooms.

## The flow

1. Choose a date, a start time, a duration (30, 60, 90 or 120 minutes) and how
   many people are coming.
2. See only the rooms that seat that many people and have no booking
   overlapping that time.
3. Press **Book** on one.
4. It appears in **My bookings**, and it's still there after a reload.

The rooms are the real Chifley Library study rooms, with the capacities shown in
the current booking interface.

## What good looks like here

- **Only bookable rooms are shown.** Search filters by capacity and by
  existing bookings, so there is nothing left to scan.
- **Bookings can't collide.** Bookings are half-open intervals `[start, end)`:
  a 13:00–14:00 booking followed by 14:00–15:00 is fine, and any real overlap
  is refused by the server (409), even if someone bypasses the search page.
- **It persists.** Bookings live in SQLite on the Fly.io volume, so they
  survive reloads, restarts and redeploys.

The tests in `spec/` enforce those three. The visual design is still a
judgement call, and is still being improved.

## Deliberately not built

- **Authentication.** This is a single-user prototype: there is no sign-in,
  and My bookings lists every booking. Leaving it out keeps the focus on the
  booking interaction.
- **A library filter.** Every room in the prototype is in Chifley.
- Cancelling or editing bookings, recurring bookings, check-in, reminders,
  admin screens, quotas and opening hours.

## Running it

Needs [mise](https://mise.jdx.dev/), which installs the pinned Node and pnpm.

```sh
mise install
pnpm install
pnpm dev          # http://localhost:4321, database in .data/app.db
pnpm check        # typecheck, build, and run the tests in spec/
```

Schema changes go through Drizzle: edit `src/lib/schema.ts`, run
`pnpm db:generate`, and commit the migration. Migrations (including the room
seed) run automatically when the server starts.

Deploy with `flyctl deploy --remote-only --ha=false -a comp4020-crit7-lyclccylcq`,
with the course's Fly token in the gitignored `mise.local.toml`.
