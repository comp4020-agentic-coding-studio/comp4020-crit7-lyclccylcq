# Crit 7 reflection

## What was the breakthrough that moved the work forward?

Putting data correctness before screens. The poor interface motivated this project, but in a full-stack system, UI work should follow reliable data operations.

I asked the agent to define the schema, overlap rule and a failing test first. Half-open intervals allow 13:00–14:00 followed by 14:00–15:00, while rejecting real overlap. Moving validation into `createBooking` meant correctness no longer depended on the UI remembering to check.

That foundation survived the redesign, review step and computer desks. Database failures reinforced the lesson: an apparent data problem could actually be a stale object or transaction contention. I needed to understand the cause, not just remove the error.

## What did this work change about who I want to be as a software developer?

Harness engineering does not mean every decision should be autonomous or flexible. In systems where correctness matters, important invariants should be fixed in code. I mean enforcing business rules, not hard-coding arbitrary data. Any potential efficiency benefit is secondary; what mattered here was a clear safety boundary.

I used to doubt TDD's efficiency, especially for a solo developer writing business software. Building many tests upfront felt costly. AI-assisted development changes that balance: generating and running tests is easier, while their constraints become more valuable.

Alongside the harness's instructions and context, tests provide executable safeguards. An agent's implementation must satisfy explicit checks, not merely appear to follow a prompt. I still have to choose meaningful rules and check that failures test those rules.

I want to be a developer who decides what must remain true and makes the system enforce it, rather than someone who only directs an agent to produce interfaces quickly.
