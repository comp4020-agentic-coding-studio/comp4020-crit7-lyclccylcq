import { eq } from "drizzle-orm";
import { JSDOM } from "jsdom";
import { beforeAll, describe, expect, inject, it } from "vitest";

// Study rooms and computer desks through the same search, filters and booking
// flow. Its own date, so every seeded space starts free.
const baseUrl = inject("baseUrl");
const date = "2030-06-12";

const load = async (path: string, status = 200) => {
  const res = await fetch(new URL(path, baseUrl));
  expect(res.status).toBe(status);
  return new JSDOM(await res.text()).window;
};
const post = (path: string, body: URLSearchParams) =>
  fetch(new URL(path, baseUrl), { method: "POST", headers: { origin: baseUrl }, body, redirect: "manual" });
const fieldsOf = (window: JSDOM["window"], form: Element) =>
  new URLSearchParams([...new window.FormData(form as HTMLFormElement).entries()] as [string, string][]);

const search = async (params: [string, string][]) => {
  // facility and device repeat; every other parameter replaces its default
  const query = new URLSearchParams({ date, start: "10:00", duration: "60", people: "1" });
  for (const [name, value] of params) {
    if (name === "facility" || name === "device") query.append(name, value);
    else query.set(name, value);
  }
  const window = await load(`/?${query}`);
  return {
    window,
    names: [...window.document.querySelectorAll("main li h3")].map((h) => h.textContent?.trim() ?? ""),
    heading: window.document.querySelector("main h2")?.textContent?.trim() ?? "",
  };
};

const MAC = ["2.23", "2.25", "2.27", "2.30", "2.32", "2.36", "2.37", "2.39", "2.42"].map((n) => `Computer Desk ${n}`);
const WINDOWS = ["2.24", "2.26", "2.29", "2.35", "2.38"].map((n) => `Computer Desk ${n}`);
const isDesk = (name: string) => name.startsWith("Computer Desk");

let withPower: Set<string>;

beforeAll(async () => {
  process.env.DATABASE_PATH = inject("databasePath");
  const { db } = await import("../src/lib/db");
  const { rooms } = await import("../src/lib/schema");
  withPower = new Set(
    db.select({ name: rooms.name }).from(rooms).where(eq(rooms.hasPower, true)).all().map((room) => room.name),
  );
});

describe("space type", () => {
  it("offers Any space, Study room and Computer desk, defaulting to Any space", async () => {
    const select = (await load("/")).document.querySelector("select#type");

    expect([...(select?.querySelectorAll("option") ?? [])].map((o) => o.getAttribute("value"))).toEqual([
      "any",
      "study_room",
      "computer_desk",
    ]);
    expect(select?.querySelector("option:checked")?.getAttribute("value")).toBe("any");
  });

  it("Any space returns study rooms and computer desks", async () => {
    const { names, heading } = await search([["type", "any"]]);

    expect(names.filter(isDesk)).toHaveLength(21);
    expect(names.filter((name) => !isDesk(name))).toHaveLength(30);
    expect(heading).toBe("51 spaces available across 3 libraries");
  });

  it("type=study_room excludes computer desks", async () => {
    const { names, heading } = await search([["type", "study_room"]]);

    expect(names).toHaveLength(30);
    expect(names.some(isDesk)).toBe(false);
    expect(heading).toBe("30 study rooms available across 3 libraries");
  });

  it("type=computer_desk excludes study rooms", async () => {
    const { names, heading } = await search([["type", "computer_desk"]]);

    expect(names).toHaveLength(21);
    expect(names.every(isDesk)).toBe(true);
    expect(heading).toBe("21 computer desks available at Chifley Library");
  });

  it("a party of 2 excludes every computer desk", async () => {
    const { names } = await search([["people", "2"]]);

    expect(names.length).toBeGreaterThan(0);
    expect(names.some(isDesk)).toBe(false);
  });

  it("rejects a space type it doesn't know", async () => {
    const { window } = await search([["type", "booth"]]);

    expect(window.document.querySelector('[role="alert"]')?.textContent).toBeTruthy();
  });
});

describe("facility and equipment filters", () => {
  it("Power returns only spaces whose power is verified true", async () => {
    const { names } = await search([["facility", "power"]]);

    expect(names.length).toBeGreaterThan(0);
    for (const name of names) expect(withPower.has(name), name).toBe(true);
    expect(names.some(isDesk)).toBe(false); // desks' power is unverified (null)
  });

  it("an unverified facility never matches: Display finds nothing", async () => {
    const { names, heading } = await search([["facility", "display"]]);

    expect(names).toHaveLength(0);
    expect(heading).toMatch(/^No spaces available/);
  });

  it("Mac returns only the Mac desks", async () => {
    const { names } = await search([["device", "mac"]]);

    expect(names.sort()).toEqual([...MAC].sort());
  });

  it("Mac + Windows returns both, OR within the equipment group", async () => {
    const { names } = await search([
      ["device", "mac"],
      ["device", "windows"],
    ]);

    expect(names.sort()).toEqual([...MAC, ...WINDOWS].sort());
  });

  it("groups combine with AND: Chifley + Accessible + Mac finds nothing, desks' access being unverified", async () => {
    const { names } = await search([
      ["library", "chifley"],
      ["facility", "accessible"],
      ["device", "mac"],
    ]);

    expect(names).toHaveLength(0);
  });

  it("keeps the chosen filters in the form, with More filters open", async () => {
    const doc = (await search([["facility", "power"], ["device", "mac"]])).window.document;

    expect(doc.querySelector("details.more-filters")?.hasAttribute("open")).toBe(true);
    expect(doc.querySelector<HTMLInputElement>('input[name="facility"][value="power"]')?.checked).toBe(true);
    expect(doc.querySelector<HTMLInputElement>('input[name="device"][value="mac"]')?.checked).toBe(true);
    expect(doc.querySelector<HTMLInputElement>('input[name="device"][value="windows"]')?.checked).toBe(false);
  });

  it("rejects a filter value it doesn't know", async () => {
    const { window } = await search([["device", "linux"]]);

    expect(window.document.querySelector('[role="alert"]')?.textContent).toBeTruthy();
  });
});

describe("a computer desk goes through the same booking flow", () => {
  const desk = "Computer Desk 2.28";
  const monitorDesks = (start: string) =>
    search([
      ["start", start],
      ["type", "computer_desk"],
      ["device", "monitor"],
    ]);

  it("search → review shows its equipment and capacity", async () => {
    const { window } = await monitorDesks("10:00");
    const card = [...window.document.querySelectorAll("main li")].find((li) => li.querySelector("h3")?.textContent === desk);

    expect(card?.querySelector('[aria-label="Equipment"]')?.textContent).toContain("External monitor");
    expect(card?.textContent).toContain("1 person");
  });

  it("review → confirm → My Bookings → cancel, and it's free again", async () => {
    const results = (await monitorDesks("10:00")).window;
    const book = [...results.document.querySelectorAll("button")].find(
      (b) => b.getAttribute("aria-label") === `Book ${desk}`,
    );
    const review = await load(`/bookings/confirm?${fieldsOf(results, book?.closest("form") as Element)}`);
    expect(review.document.body.textContent).toContain("External monitor");

    const confirm = [...review.document.querySelectorAll("button")].find((b) => b.textContent?.includes("Confirm booking"));
    const booked = await post("/bookings", fieldsOf(review, confirm?.closest("form") as Element));
    expect(booked.status).toBe(303);
    expect((await monitorDesks("10:30")).names).not.toContain(desk);

    const mine = await load(booked.headers.get("location") ?? "");
    const cancel = [...mine.document.querySelectorAll("button")].find((b) =>
      b.getAttribute("aria-label")?.includes(desk),
    );
    const cancelled = await post("/bookings/cancel", fieldsOf(mine, cancel?.closest("form") as Element));
    expect(cancelled.status).toBe(303);
    expect((await monitorDesks("10:30")).names).toContain(desk);
  });
});
