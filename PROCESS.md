# Process overview

## What I built

An availability-first replacement for the ANU Library study-room booking
interface: say when, how long and how many, and see only rooms you can book.
`README.md` has the argument.

## How I got here

I chose this system because I use it, and its horizontally scrolling timetable
is poor at answering "what can I book at this time?". I kept the model to Room
and Booking, and directed the agent to design before building:

> Do not implement anything yet.

Bookings are half-open intervals `[start, end)`, so back-to-back bookings are
valid, pinned by a red-green cycle:
[`51d4714...dccf6fb`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-lyclccylcq/compare/51d4714...dccf6fb).
I then moved validation into the domain:

> Please make createBooking responsible for validating a booking rather than
> relying on the caller to remember to call isRoomAvailable first.

([`356ec47...b5994ff`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-lyclccylcq/compare/356ec47...b5994ff))

Search filters by capacity and overlap, tested before any booking UI existed
([`8b610e5...5a43f3b`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-lyclccylcq/compare/8b610e5...5a43f3b)),
then Search → Book → My Bookings → reload
([`d7791f0...5b7e18f`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-lyclccylcq/compare/d7791f0...5b7e18f)).
Authentication is deliberately out of scope. On Fly.io, a real booking survived
a reload and disappeared from overlapping searches.

The redesign
([`42e2c3d`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-lyclccylcq/commit/42e2c3d))
leads with "When do you need a room?", blocks past times and ranks best fit
first
([`70a9d19`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-lyclccylcq/commit/70a9d19)).
I grounded the data in LibCal: Chifley first
([`d0947d9`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-lyclccylcq/commit/d0947d9)),
then Hancock, Law and facilities from my LibCal screenshots, with unverified
facilities stored as unknown rather than guessed
([`b1f1bcf`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-lyclccylcq/commit/b1f1bcf)).

Correcting meant reading failures rather than patching them. One red run
failed on a missing module, so we stubbed it until it failed on the rule. When
searches crashed locally after the schema change, I had the agent reproduce it
before fixing: the dev server had kept a Drizzle object built against the old
schema. The fix was a restart and a `CLAUDE.md` rule, not a code change.
