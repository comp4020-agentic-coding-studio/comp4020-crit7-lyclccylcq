# Process overview

## What I built

An availability-first replacement for the ANU Library study-room booking
interface: say when, how long and how many, and see only rooms you can book. `README.md` has the argument.

## How I got here

I chose this system because I use it, and its horizontally scrolling timetable
is poor at answering "what can I book at this time?". I reframed the
interaction from timetable-first to availability-first, and kept the data model
to two entities, Room and Booking. I directed the agent to design before
building:

> Do not implement anything yet.

We defined bookings as half-open intervals `[start, end)`, so back-to-back
bookings are valid, and pinned that with a red-green cycle:
[`51d4714...dccf6fb`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-lyclccylcq/compare/51d4714...dccf6fb).
I then moved validation into the domain:

> Please make createBooking responsible for validating a booking rather than
> relying on the caller to remember to call isRoomAvailable first.

That cycle is
[`356ec47...b5994ff`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-lyclccylcq/compare/356ec47...b5994ff).
I grounded the data in real Chifley Library room names and capacities from the
current interface
([`d0947d9`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-lyclccylcq/commit/d0947d9)).

Search filters by capacity and by booking overlap. I had the overlap case tested
before any booking UI existed, seeding a booking straight into the test
server's database:
[`8b610e5...5a43f3b`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-lyclccylcq/compare/8b610e5...5a43f3b).
I left out a library filter (every room is in Chifley) and authentication, to
focus on the booking interaction. A final cycle drove Search → Book → My
Bookings → reload through the real app, with overlaps refused by the server:
[`d7791f0...5b7e18f`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-lyclccylcq/compare/d7791f0...5b7e18f).

I checked each red run before implementing; one failed on a missing module
rather than the rule, so we stubbed the function to get a meaningful red.

After deploying to Fly.io, I booked Study Room 1.01 for 2026-10-01, 10:00–11:00
on the live site. It survived a reload, disappeared from overlapping searches,
and reappeared for a back-to-back 11:00 search.
