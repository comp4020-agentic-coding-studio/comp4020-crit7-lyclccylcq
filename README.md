# Find a study space

An availability-first redesign of ANU Library study-space booking, for study
rooms and computer desks. You say when you need a space, for how long and for
how many people, and it shows only the spaces you can actually book, rather
than a timetable to scan.

This is a single-user Crit 7 prototype. It doesn't use ANU sign-in or connect
to LibCal: bookings made here live only in this app.

## The problem

The current booking interface is a timetable: rooms down one side, times across
the top. To answer "what can I book at 2pm for an hour?" you scroll the grid
horizontally and scan row by row for a free cell, room after room. The visual
hierarchy doesn't help. The question you arrive with is about a time, but the
interface is organised around rooms.

## The flow

1. Choose a date, a start time, a duration (30, 60, 90 or 120 minutes) and how
   many people are coming. Optionally narrow by space type, library, verified
   facilities or computer equipment under **More filters**.
2. See only the spaces that seat that many people and have no booking
   overlapping that time, best fit first.
3. **Book space** opens a review page. Nothing is booked yet; **Confirm
   booking** books it, and the server checks again that the space is still
   free. If someone got there first, you're told and sent back to your search.
4. It appears in **My bookings**, and it's still there after a reload.
5. **Cancel booking** frees the space straight away.

## My bookings

Bookings are split by time, using Canberra's clock:

- **Active** bookings haven't ended yet. The newest booking you made comes
  first, and each can be cancelled.
- **Past** bookings have ended. They stay as completed history, most recently
  ended first, and can't be cancelled: the server refuses, even if the request
  bypasses the page.

A cancelled booking is deleted, so it leaves no history; a completed one
stays.

## The data

30 real study rooms across Chifley, Hancock and Law libraries, and 21 Chifley
Level 2 computer desks. Names, capacities, levels and desk equipment (Mac,
Windows PC, external monitor or none) come from the current ANU LibCal booking
interface. The desks are a demo subset, the ones visible in one LibCal view,
not the full inventory.

Each card shows only facilities that are verified:

- **Power and wheelchair access** for every room. For Chifley this is LibCal's
  public statement that all rooms have both (the Hancock Basement study room,
  not included here, is the exception). For Hancock and Law it's the icons
  LibCal shows on each room.
- **Display and whiteboard** aren't verified for any room yet, so they're
  stored as unknown and not shown. Unknown is never displayed as "no".
- **Computer desks' power and access** aren't shown in LibCal, so they're
  unknown and a facility filter never matches them.
- **Law rooms have no level**, because LibCal doesn't show one.

Facility filters combine with AND and count only verified facilities; ticking
several equipment types matches any of them.

## What good looks like here

- **Only bookable spaces are shown.** Search filters by capacity and by
  existing bookings, so there is nothing left to scan.
- **Bookings can't collide.** Bookings are half-open intervals `[start, end)`:
  a 13:00–14:00 booking followed by 14:00–15:00 is fine, and any real overlap
  is refused by the server (409), even if someone bypasses the search page.
- **It persists.** Bookings live in SQLite on the Fly.io volume, so they
  survive reloads, restarts and redeploys.

The tests in `spec/` enforce those three. The visual design is a judgement
call: one question at the top, the search in a single panel, and each result a
card with only what you need to choose.

## Deliberately not built

- **Authentication.** This is a single-user prototype: there is no sign-in,
  and My bookings lists every booking. Leaving it out keeps the focus on the
  booking interaction.
- **Menzies and other branches**, maps, and a live connection to LibCal.
- Editing bookings (cancel and book again), recurring bookings, check-in,
  reminders, admin screens, quotas and opening hours.

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
seed) run automatically when the server first touches the database.

Every push to `main` runs the checks and, if they pass, deploys to Fly.io. To
deploy by hand, run `flyctl deploy --remote-only --ha=false -a
comp4020-crit7-lyclccylcq` with the course's Fly token in the gitignored
`mise.local.toml`.
