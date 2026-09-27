import { JSDOM } from "jsdom";
import { describe, expect, inject, it } from "vitest";

// Drives the running app over HTTP against the seeded Chifley rooms:
// 1.01 seats 4, 4.02 seats 2.
const baseUrl = inject("baseUrl");

const page = async (path: string) => {
  const res = await fetch(new URL(path, baseUrl));
  expect(res.status).toBe(200);
  return new JSDOM(await res.text()).window.document;
};

const search = (params: Record<string, string>) =>
  page(`/?${new URLSearchParams({ date: "2030-06-03", start: "14:00", duration: "60", ...params })}`);

describe("search page", () => {
  it("offers a search form with date, start time, duration and party size", async () => {
    const doc = await page("/");
    const form = doc.querySelector('form[method="get" i]');

    expect(form).not.toBeNull();
    for (const field of ["date", "start", "duration", "people"]) {
      expect(form?.querySelector(`[name="${field}"]`), `field "${field}"`).not.toBeNull();
    }
  });

  it("lists rooms big enough for the party, and leaves out ones that are too small", async () => {
    const text = (await search({ people: "3" })).body.textContent ?? "";

    expect(text).toContain("Study Room 1.01");
    expect(text).not.toContain("Study Room 4.02");
  });

  it("includes two-person rooms for a party of two", async () => {
    const text = (await search({ people: "2" })).body.textContent ?? "";

    expect(text).toContain("Study Room 4.02");
    expect(text).toContain("Study Room 1.01");
  });
});
