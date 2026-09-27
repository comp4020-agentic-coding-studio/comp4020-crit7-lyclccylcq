# Process overview

## What I built

An availability-first alternative to ANU Library study-space booking: enter when, how long and how many people; see only bookable rooms and desks. `README.md` explains the design.

## How I got here

I chose a system I use, but whose interface I find poorly designed. Users visually scan a large, horizontally scrolling grid to find rooms and times. I wanted the system to do that filtering.

I used test-driven development (TDD), directing the agent:

> Do not implement anything yet.

We defined the schema and half-open booking intervals, then made tests fail on the rule before implementing it ([`51d4714...dccf6fb`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-lyclccylcq/compare/51d4714...dccf6fb)). A missing-module failure needed a stub first: red was useful only for the right reason.

I then made `createBooking` validate bookings itself, rather than trusting callers to check availability ([`356ec47...b5994ff`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-lyclccylcq/compare/356ec47...b5994ff)). Search was tested against an existing booking before the booking UI existed ([`8b610e5...5a43f3b`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-lyclccylcq/compare/8b610e5...5a43f3b)), followed by Search → Book → My Bookings → reload ([`d7791f0...5b7e18f`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-lyclccylcq/compare/d7791f0...5b7e18f)).

The redesign and review step followed ([`42e2c3d`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-lyclccylcq/commit/42e2c3d), [`c6b3a62`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-lyclccylcq/commit/c6b3a62)). For completed bookings, I insisted:

> Do not rely only on hiding the Cancel button.

The server enforces that rule ([`e5d8825`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-lyclccylcq/commit/e5d8825)).

LibCal and my screenshots grounded the room and desk data; unverified facilities stayed unknown, not guessed ([`d0947d9`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-lyclccylcq/commit/d0947d9), [`b1f1bcf`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-lyclccylcq/commit/b1f1bcf), [`ecccf86`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-lyclccylcq/commit/ecccf86)). Authentication remained out of scope.

Database failures taught me to investigate deeper logic, not assume bad data. After a schema change, searches crashed because the development server retained an outdated Drizzle object; restarting it and documenting the rule in `CLAUDE.md` fixed this. Later, intermittent "database is locked" failures came from transaction contention between connections. Taking the write lock at the start fixed that failure ([`7560b1b`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-lyclccylcq/commit/7560b1b)). Both cases required understanding lifecycle or transaction behaviour before changing anything.
