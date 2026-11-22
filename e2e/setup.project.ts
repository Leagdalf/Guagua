import { expect, test } from "@playwright/test";
import { BASE_URL } from "./support/server";

test("der Vorschau-Server liefert die App unter /Guagua/", async ({ request }) => {
  const response = await request.get(BASE_URL);
  expect(response.ok()).toBe(true);
  expect(await response.text()).toContain('<div id="root">');
});
