// story-011 regression: dossier clue numbers must read in ascending order, the hint must name
// the same number the dossier shows, and interaction must never renumber a row.
const { chromium } = require("playwright");
const assert = require("node:assert/strict");

const TEST_URL = process.env.TEST_URL || "http://localhost:8000";

async function readRows(page) {
  return page.$$eval("#clues .clue", (nodes) =>
    nodes.map((node) => ({
      number: (node.querySelector(".clue-number")?.textContent || "").trim(),
      pressed: node.getAttribute("aria-pressed") === "true",
      text: (node.querySelector(".clue-text, span:last-of-type")?.textContent || "")
        .replace(/\s+/g, " ")
        .trim(),
    })),
  );
}

async function ensureCase(page, size) {
  await page.setViewportSize({ width: 1440, height: 1100 });
  const hasGame = () =>
    page.evaluate(() => typeof game !== "undefined" && !!game && !loading);
  if (!(await hasGame())) {
    const start = page.locator("#start");
    if (await start.count()) await start.click({ force: true });
    await page.waitForFunction(
      () => typeof game !== "undefined" && !!game && !loading,
      null,
      { timeout: 25000 },
    );
  }
  const current = await page.evaluate(() => game.size);
  if (current !== size) {
    await page.locator(`[data-size="${size}"]`).click();
    if (await page.evaluate(() => typeof modalKind !== "undefined" && modalKind === "size"))
      await page.locator("#modal-primary").click();
  } else {
    await page.locator("#new").click();
  }
  await page.waitForFunction(
    (n) => typeof game !== "undefined" && game && game.size === n && !loading,
    size,
  );
  await page.waitForSelector("#clues .clue", { timeout: 20000 });
}

function assertAscending(rows, label) {
  assert.ok(rows.length > 0, `${label}: no clues rendered`);
  const width = Math.max(2, String(rows.length).length);
  rows.forEach((row, position) => {
    assert.match(row.number, /^\d+$/, `${label}: row ${position} has a non-numeric number "${row.number}"`);
    assert.equal(
      row.number.length,
      width,
      `${label}: row ${position} number "${row.number}" does not match width ${width}`,
    );
    assert.equal(
      Number(row.number),
      position + 1,
      `${label}: row ${position} prints "${row.number}", expected ${position + 1}`,
    );
  });
}

(async () => {
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROME_BIN ? { executablePath: process.env.CHROME_BIN } : {}),
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(TEST_URL);
    await page.locator("#language").selectOption("it");

    // AC-1 and AC-2: ascending, exactly 1..N, across sizes and cases.
    for (const size of [5, 6, 7]) {
      await ensureCase(page, size);
      for (let k = 0; k < 10; k += 1) {
        assertAscending(await readRows(page), `${size}x${size} case ${k}`);
        await page.locator("#new").click();
        await page.waitForTimeout(80);
      }
    }
    console.log("AC-1/AC-2 ascending 1..N: PASS");

    // AC-4: the hint names the number the dossier shows for the clue it highlights.
    for (const size of [5, 6, 7]) {
      await ensureCase(page, size);
      for (const language of ["it", "en", "es", "ca"]) {
        await page.locator("#language").selectOption(language);
        await page.locator("#hint").click();
        for (let step = 0; step < 3; step += 1) {
          const active = await page.$$eval("#clues .clue.hint-active", (nodes) =>
            nodes.map((node) => (node.querySelector(".clue-number")?.textContent || "").trim()),
          );
          assert.equal(active.length, 1, `${size}/${language}: expected exactly one hint-active clue`);
          const spoken = (await page.locator("#hint-clue-link").textContent()).trim();
          const banner = (await page.locator("#hint-banner").innerText()).replace(/\s+/g, " ");
          assert.ok(
            spoken.includes(active[0]) || banner.includes(active[0]),
            `${size}/${language}: hint says "${spoken}" but the highlighted clue is ${active[0]}`,
          );
          await page.keyboard.press("h");
          await page.waitForTimeout(60);
        }
        await page.keyboard.press("Escape");
      }
    }
    console.log("AC-4 hint names the dossier number: PASS");

    // AC-3 and AC-6: interaction never renumbers, and padding never changes.
    await ensureCase(page, 7);
    await page.locator("#language").selectOption("it");
    const before = (await readRows(page)).map((row) => row.number);
    await page.locator('[data-filter="room"]').click();
    const filtered = (await readRows(page)).map((row) => row.number);
    assert.ok(filtered.length > 0 && filtered.length < before.length, "filter did not narrow the list");
    assert.deepEqual(
      filtered,
      before.filter((number) => filtered.includes(number)),
      "filtering changed a displayed number",
    );
    await page.locator('[data-filter="all"]').click();
    assert.deepEqual((await readRows(page)).map((row) => row.number), before, "clearing the filter changed a number");
    await page.locator("#clues .clue").first().click();
    assert.deepEqual((await readRows(page)).map((row) => row.number), before, "marking a clue changed a number");
    await page.locator('#tray .person').nth(1).click();
    await page.locator('[data-cell="0"]').click();
    await page.locator('#tray .person').nth(2).click();
    await page.locator('[data-cell="1"]').click();
    assert.ok((await page.locator(".cell.conflict").count()) > 0, "expected a conflict to be flagged");
    assert.deepEqual((await readRows(page)).map((row) => row.number), before, "a conflict changed a number");
    await page.locator("#hint").click();
    assert.deepEqual((await readRows(page)).map((row) => row.number), before, "an active hint changed a number");
    await page.keyboard.press("Escape");
    console.log("AC-3/AC-6 stable under filter, mark, conflict, hint: PASS");

    // AC-7: the number column holds at every width, size and locale.
    for (const width of [1440, 800, 390, 360]) {
      for (const size of [5, 6, 7]) {
        await ensureCase(page, size);
        await page.setViewportSize({ width, height: 1100 });
        for (const language of ["it", "en", "es", "ca"]) {
          await page.locator("#language").selectOption(language);
          const cluesTab = page.locator("#clues-tab");
          if ((await cluesTab.isVisible()) && (await cluesTab.getAttribute("aria-pressed")) !== "true")
            await cluesTab.click();
          const measured = await page.evaluate(() =>
            [...document.querySelectorAll("#clues .clue")].map((row) => {
              const number = row.querySelector(".clue-number");
              const text = number?.nextElementSibling;
              const ro = row.getBoundingClientRect();
              const no = number.getBoundingClientRect();
              const to = text ? text.getBoundingClientRect() : null;
              return {
                numberWidth: no.width,
                numberInside: no.left >= ro.left - 0.5 && no.right <= ro.right + 0.5,
                textClipped: text ? text.scrollWidth > text.clientWidth + 1 : false,
                textInside: to ? to.right <= ro.right + 0.5 : true,
              };
            }),
          );
          assert.ok(measured.length > 0, `${width}/${size}/${language}: no clues`);
          for (const row of measured) {
            assert.ok(
              Math.abs(row.numberWidth - 24) < 1,
              `${width}/${size}/${language}: number column is ${row.numberWidth}px, expected 24px`,
            );
            assert.ok(row.numberInside, `${width}/${size}/${language}: number escapes its row`);
            assert.ok(!row.textClipped, `${width}/${size}/${language}: clue text is clipped`);
            assert.ok(row.textInside, `${width}/${size}/${language}: clue text overflows its row`);
          }
        }
      }
    }
    console.log("AC-7 number column holds at 1440/800/390/360 in four locales: PASS");

    // AC-5: the DOM identity stays on the original index.
    await ensureCase(page, 6);
    const identity = await page.$$eval("#clues .clue", (nodes) =>
      nodes.map((node) => ({
        clue: node.dataset.clue,
        number: node.querySelector(".clue-number")?.textContent.trim(),
      })),
    );
    assert.deepEqual(
      identity.map((row) => Number(row.clue)).sort((a, b) => a - b),
      identity.map((_, position) => position),
      "data-clue is not a permutation of the original indices",
    );
    assert.equal(
      new Set(identity.map((row) => row.number)).size,
      identity.length,
      "duplicate displayed numbers",
    );
    console.log("AC-5 data-clue keeps the original index: PASS");

    assert.deepEqual(errors, [], `page errors: ${errors.join(" | ")}`);
    console.log("CLUE NUMBERING: PASS");
  } finally {
    await browser.close();
  }
})();
