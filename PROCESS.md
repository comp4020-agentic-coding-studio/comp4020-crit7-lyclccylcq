# Process overview

## What I built

An availability-first replacement for ANU Library study-space booking: say
when, how long and how many, and see only the rooms and desks you can book.
`README.md` has the argument.

## How I got here

I chose this system because I use it, and its horizontally scrolling timetable
is poor at answering "what can I book at this time?". I directed the agent to
design before building:

> Do not implement anything yet.

Bookings are half-open intervals, so back-to-back bookings are valid, pinned by
a red-green cycle
([`51d4714...dccf6fb`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-lyclccylcq/compare/51d4714...dccf6fb)).
I then moved validation into the domain:

> Please make createBooking responsible for validating a booking rather than
> relying on the caller to remember to call isRoomAvailable first.

([`356ec47...b5994ff`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-lyclccylcq/compare/356ec47...b5994ff))

Search was tested against an existing booking before any booking UI existed
([`8b610e5...5a43f3b`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-lyclccylcq/compare/8b610e5...5a43f3b)),
then Search → Book → My Bookings → reload
([`d7791f0...5b7e18f`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-lyclccylcq/compare/d7791f0...5b7e18f)).
The redesign leads with one question
([`42e2c3d`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-lyclccylcq/commit/42e2c3d));
booking gained a review step, with `createBooking` still deciding at confirm
([`c6b3a62`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-lyclccylcq/commit/c6b3a62)).
For completed bookings I kept the rule on the server:

> Do not rely only on hiding the Cancel button.

([`e5d8825`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-lyclccylcq/commit/e5d8825))

Room data comes from LibCal: Chifley first
([`d0947d9`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-lyclccylcq/commit/d0947d9)),
then Hancock, Law and desks from my screenshots, with unverified facilities
stored as unknown rather than guessed
([`b1f1bcf`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-lyclccylcq/commit/b1f1bcf),
[`ecccf86`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-lyclccylcq/commit/ecccf86)).
Authentication stayed out of scope.

Correcting meant reading failures rather than patching them. One red run
failed on a missing module, so we stubbed it until it failed on the rule. When
searches crashed locally after a schema change, I had the agent reproduce it
before fixing: the dev server had kept a Drizzle object built against the old
schema. The fix was a restart and a `CLAUDE.md` rule, not a code change.
