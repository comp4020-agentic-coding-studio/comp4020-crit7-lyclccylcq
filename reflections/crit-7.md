# Crit 7 reflection

## What was the breakthrough that moved the work forward?

Deciding the rules before the screens. I told the agent not to implement
anything until we had a schema, an overlap rule and a failing test. That forced
the decision everything else hangs on: bookings are half-open intervals, so
13:00–14:00 then 14:00–15:00 is fine and any real overlap isn't. Once that rule
was in a test, I could direct the rest in small steps I could check.

The step that mattered most was moving validation into `createBooking` instead
of trusting the UI to check availability first. After that, a bug in the search
page or the booking route couldn't create a double booking. I also asked for
search to be tested against an existing booking before the booking UI existed,
so the main promise was protected from the start.

My grounding was my own use of the system: scanning a horizontally scrolling
timetable is what annoyed me, and the room names and capacities come from the
real interface. Correcting mostly meant reading the red runs, not just seeing
red. When one test failed on a missing module instead of the rule, we stubbed
the function until it failed for the right reason.

## What did this work change about who I want to be as a software developer?

I want to decide what must always be true and make the system enforce it,
rather than hope every caller remembers. Working with an agent makes that
matter more: it builds whatever I describe quickly, so my job is to describe
the right thing and prove it holds. The visual redesign isn't finished yet, but
because the behaviour is settled first, I can change the design without
breaking it.
