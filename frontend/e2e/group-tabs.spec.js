import { expect, test } from '@playwright/test';
import { seedAuth } from './helpers/auth.js';
import { stubApi } from './helpers/api.js';
import { FLAT } from './fixtures/data.js';

test.beforeEach(async ({ page }) => {
  await seedAuth(page);
  await stubApi(page);
});

// A <header> nested inside <main> does NOT get the implicit `banner` role, so
// getByRole('banner') finds nothing here. The sticky wrapper is targeted by its
// class instead: it is the only sticky element on the page, and the flicker
// test needs a handle on the container that stays put.
const groupHeader = (page) => page.locator('main div.sticky').first();
const headerText = (page) => page.locator('header');
const tabNav = (page) => page.getByRole('navigation', { name: 'Section' });

test.describe('group tabs', () => {
  test('bills is the default tab and carries no path segment', async ({ page }) => {
    await page.goto(`/groups/${FLAT}`);
    await expect(page).toHaveURL(new RegExp(`/groups/${FLAT}$`));
    await expect(headerText(page)).toContainText('Flat 302, Indiranagar');
  });

  test('offers four tabs, with the active one marked for assistive tech', async ({ page }) => {
    await page.goto(`/groups/${FLAT}`);
    const tabs = tabNav(page).getByRole('link');
    await expect(tabs).toHaveCount(4);
    for (const label of ['Bills', 'Balances', 'Settlements', 'Members']) {
      await expect(tabNav(page).getByRole('link', { name: label })).toBeVisible();
    }
    await expect(
      tabNav(page).getByRole('link', { name: 'Bills', exact: true }),
    ).toHaveAttribute('aria-current', 'page');
  });

  test('bills stays inactive on a sub-tab, so only one is marked', async ({ page }) => {
    // Without `end` on the bills link, /groups/x/balances also starts with
    // /groups/x and the first tab would light up on every sub-tab.
    await page.goto(`/groups/${FLAT}/balances`);
    await expect(tabNav(page).locator('[aria-current="page"]')).toHaveCount(1);
    await expect(
      tabNav(page).getByRole('link', { name: 'Balances', exact: true }),
    ).toHaveAttribute('aria-current', 'page');
  });

  test('clicking a tab changes the URL and the body', async ({ page }) => {
    await page.goto(`/groups/${FLAT}`);
    await tabNav(page).getByRole('link', { name: 'Members' }).click();
    await expect(page).toHaveURL(new RegExp(`/groups/${FLAT}/members$`));
    // Members tab content, not the bills list.
    await expect(page.getByRole('heading', { name: 'Members' })).toBeVisible();
    await expect(page.getByText('Invite someone new')).toBeVisible();
  });

  test('a deep link survives a reload', async ({ page }) => {
    await page.goto(`/groups/${FLAT}/settlements`);
    await page.reload();
    await expect(page).toHaveURL(new RegExp(`/groups/${FLAT}/settlements$`));
    await expect(
      tabNav(page).getByRole('link', { name: 'Settlements', exact: true }),
    ).toHaveAttribute('aria-current', 'page');
  });

  test('shows a summary of the group in the header', async ({ page }) => {
    await page.goto(`/groups/${FLAT}`);
    const header = headerText(page);
    await expect(header).toContainText('4 members');
    // Priya is owed 180 in Flat 302 and owes nothing in Coorg, so 180 total.
    // Was "you are down" here, "gets back" on the balances tab, and
    // "you owe" in money.js. One wording now, from balanceSentence(), so
    // switching tabs does not change how the same balance reads.
    await expect(header).toContainText('you owe ₹180.00');
    await expect(header).not.toContainText('you are down');
  });

  test('the header does not fade out while switching tabs', async ({ page }) => {
    // The regression this guards: the entrance animation is a fade on whatever
    // Screen wraps, so if the sticky header were inside it, the header would be
    // dragged through opacity 0 on every tab switch. That was the flicker.
    // Asserted by sampling the live computed opacity across the transition
    // rather than trusting a class name.
    await page.goto(`/groups/${FLAT}`);
    const header = groupHeader(page);
    await expect(header).toBeVisible();
    await expect(headerText(page)).toHaveCSS('opacity', '1');

    const samples = await header.evaluate(async (el) => {
      const out = [];
      for (let i = 0; i < 12; i += 1) {
        out.push(Number(getComputedStyle(el).opacity));
        await new Promise((r) => setTimeout(r, 25));
      }
      return out;
    });
    // Sampled before switching, as a control: the header is at rest.
    expect(Math.min(...samples)).toBe(1);

    await tabNav(page).getByRole('link', { name: 'Balances' }).click();
    await expect(page).toHaveURL(new RegExp(`/groups/${FLAT}/balances$`));

    const during = await header.evaluate(async (el) => {
      const out = [];
      for (let i = 0; i < 12; i += 1) {
        out.push(Number(getComputedStyle(el).opacity));
        await new Promise((r) => setTimeout(r, 25));
      }
      return out;
    });
    expect(Math.min(...during)).toBe(1);
  });

  test('the header element is not recreated on a tab switch', async ({ page }) => {
    await page.goto(`/groups/${FLAT}`);
    // Wait for the header to exist before snapshotting it. page.goto resolves on
    // load, which is before React has rendered, and snapshotting then captures
    // null and makes the identity check fail for the wrong reason.
    await expect(headerText(page)).toBeVisible();
    const before = await page.evaluate(() => {
      window.__headerNode = document.querySelector('header');
      // Survives only if no full page load happened.
      window.__alive = true;
      return { headers: document.querySelectorAll('header').length };
    });
    await tabNav(page).getByRole('link', { name: 'Balances' }).click();
    await expect(page).toHaveURL(new RegExp(`/groups/${FLAT}/balances$`));
    const after = await page.evaluate(() => ({
      same: window.__headerNode === document.querySelector('header'),
      reloaded: window.__alive === undefined,
      headers: document.querySelectorAll('header').length,
    }));
    expect(after.reloaded, 'the page fully reloaded, so nothing persisted').toBe(false);
    expect(after.headers, 'header count changed').toBe(before.headers);
    expect(after.same, 'the header node was replaced').toBe(true);
  });

  test('the balances tab opens and closes the settle dialog', async ({ page }) => {
    await page.goto(`/groups/${FLAT}/balances`);
    await page.getByRole('button', { name: 'Settle up' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Record a payment');

    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
  });

  test('the balances tab shows a row per member with a signed position', async ({ page }) => {
    await page.goto(`/groups/${FLAT}/balances`);
    // Ananya is 180 down; the other two are each 90 up.
    // Two occurrences of the owed figure is the point: the sticky group header
    // and this row now describe the same balance in the same words, where
    // before the header said "you are down" and the row said "owes".
    await expect(page.getByText('you owe ₹180.00')).toHaveCount(2);
    await expect(page.getByText('you are owed ₹90.00').first()).toBeVisible();
    // The old phrasings are pinned as absent, so a fourth variant
    // cannot creep back in unnoticed.
    await expect(page.getByText(/gets back/)).toHaveCount(0);
  });

  test('the bills tab lists the fixture bills', async ({ page }) => {
    await page.goto(`/groups/${FLAT}`);
    await expect(page.getByText('Groceries')).toBeVisible();
    await expect(page.getByText('Electricity')).toBeVisible();
  });

  test('an unknown sub-path 404s rather than rendering an empty outlet', async ({ page }) => {
    await page.goto(`/groups/${FLAT}/nonsense`);
    await expect(page.getByRole('heading', { name: '404' })).toBeVisible();
  });

  test('a bill sub-route renders without the group chrome', async ({ page }) => {
    await page.goto(`/groups/${FLAT}/bills/b1`);
    // The layout route must not wrap the bill detail: no group tab bar.
    await expect(page.getByRole('heading', { name: 'Groceries' }).first()).toBeVisible();
    await expect(tabNav(page)).toHaveCount(0);
  });
});

test.describe('malformed member data', () => {
  // The fixture includes a member with both name and email empty, which the
  // backend cannot produce (User.email is non-blank) but which a stub can. The
  // split grid maps every member, so indexing an empty string used to raise a
  // TypeError and take down the whole editor.
  test('the split grid renders a nameless member instead of throwing', async ({ page }) => {
    // The grid lives inside the simple bill form, so this is the add-bill page
    // rather than the Bills tab, which is only a list.
    await page.goto(`/groups/${FLAT}/add-bill?type=simple`);
    // A crash would leave the form half-rendered, so assert the parts either
    // side of the grid are all present.
    await expect(page.getByRole('textbox', { name: /title/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /save bill/i })).toBeVisible();
    // The fallback initial, from initials() returning '?' for an empty name.
    await expect(page.getByText('?').first()).toBeVisible();
  });

  test('a member with no name is still listed on the members tab', async ({ page }) => {
    await page.goto(`/groups/${FLAT}/members`);
    await expect(page.getByText('4 members')).toBeVisible();
    await expect(page.getByText('?', { exact: true }).first()).toBeVisible();
  });
});

test.describe('bills list', () => {
  // FLAT's fixture bills are dated 2026-01-20, 2026-02-01 and 2026-03-05, so
  // they land in three separate calendar months. Month grouping is chosen over
  // relative buckets precisely because these dates are fixed: relative labels
  // would drift with the wall clock and the assertions would rot.
  test('groups bills under calendar month headings, newest month first', async ({ page }) => {
    await page.goto(`/groups/${FLAT}`);
    const headings = page.getByRole('heading', { level: 3 });
    // Exact strings, so the bill count cannot leak into the name and turn these
    // into "March 20261".
    await expect(headings).toHaveText(['March 2026', 'February 2026', 'January 2026']);
  });

  test('each month heading counts its own bills', async ({ page }) => {
    await page.goto(`/groups/${FLAT}`);
    const march = page.getByRole('region', { name: 'March 2026' });
    await expect(march).toBeVisible();
    await expect(march.getByRole('listitem')).toHaveCount(1);
    await expect(march.getByText('Saree Dry Clean')).toBeVisible();
  });

  test('a month is a labelled region, not a styled div', async ({ page }) => {
    await page.goto(`/groups/${FLAT}`);
    // The heading is wired to the section via aria-labelledby, so the month is
    // reachable as a landmark rather than only being styled like one.
    for (const label of ['March 2026', 'February 2026', 'January 2026']) {
      await expect(page.getByRole('region', { name: label })).toBeVisible();
    }
  });

  test('stamps each row with its day and month', async ({ page }) => {
    await page.goto(`/groups/${FLAT}`);
    const row = page.getByRole('listitem').filter({ hasText: 'Saree Dry Clean' });
    const stamp = row.locator('time');
    // 2026-03-05, stacked as day over month. The day is "5", not "05" -- this
    // used to assert "05" and pass, but only because the paid-by line still
    // carried the raw ISO string. It was matching the wrong element.
    await expect(stamp).toContainText('5 March 2026');
    await expect(stamp).toContainText('Mar');
    await expect(stamp).toHaveAttribute('datetime', '2026-03-05');
  });

  test('the paid-by line does not repeat the date', async ({ page }) => {
    await page.goto(`/groups/${FLAT}`);
    const row = page.getByRole('listitem').filter({ hasText: 'Saree Dry Clean' });
    await expect(row).toContainText('Paid by Rohan');
    // The stamp at the end of the row already carries it, and a raw ISO string
    // was never a good thing to show a person anyway.
    await expect(row).not.toContainText('2026-03-05');
  });

  test('the date is still exposed once to assistive tech', async ({ page }) => {
    await page.goto(`/groups/${FLAT}`);
    const row = page.getByRole('listitem').filter({ hasText: 'Saree Dry Clean' });
    // The compact stamp is hidden from screen readers, so without a readable
    // fallback the date would exist only visually. Exactly one copy, or it
    // would be announced twice.
    await expect(row.getByText('5 March 2026', { exact: true })).toHaveCount(1);
  });

  test('the status sits outside the link, beside the total', async ({ page }) => {
    await page.goto(`/groups/${FLAT}`);
    const row = page.getByRole('listitem').filter({ hasText: 'Saree Dry Clean' });
    // It used to sit inside the <a>, under the title, competing with the name
    // on the same axis.
    await expect(row.locator('a').getByText('not involved')).toHaveCount(0);
    await expect(row.getByText('not involved', { exact: true })).toHaveCount(1);
  });

  test('stacks the status above the total below md, side by side from md', async ({
    page,
  }) => {
    const row = () => page.getByRole('listitem').filter({ hasText: 'Groceries' });
    const status = () => row().getByText(/you owe ₹180\.00/);
    // rupees() groups with en-IN, so the fixture's 1240 renders as ₹1,240.00.
    const total = () => row().getByText(/₹1,240\.00/);

    await page.setViewportSize({ width: 412, height: 915 });
    await page.goto(`/groups/${FLAT}`);
    let s = await status().boundingBox();
    let t = await total().boundingBox();
    // The row is 282px at this width and the title cannot share one line with
    // a status beside the total, so the cluster stacks and right-aligns.
    expect(s.y).toBeLessThan(t.y);
    expect(Math.abs(s.x + s.width - (t.x + t.width))).toBeLessThanOrEqual(2);

    await page.setViewportSize({ width: 1440, height: 900 });
    s = await status().boundingBox();
    t = await total().boundingBox();
    // From md they sit on one line, the status to the left of the total.
    expect(Math.abs(s.y - t.y)).toBeLessThanOrEqual(4);
    expect(s.x + s.width).toBeLessThanOrEqual(t.x + 1);
  });

  test('hides the receipt icon below md and shows it from md', async ({ page }) => {
    const icon = () =>
      page
        .getByRole('listitem')
        .filter({ hasText: 'Saree Dry Clean' })
        .locator('a > span')
        .first();
    await page.setViewportSize({ width: 412, height: 915 });
    await page.goto(`/groups/${FLAT}`);
    // The same glyph on every row, so it carries no distinguishing information.
    // It was costing the title 52px on a phone.
    await expect(icon()).toBeHidden();
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(icon()).toBeVisible();
  });

  test('the mobile title is not squeezed to a few characters', async ({ page }) => {
    await page.setViewportSize({ width: 412, height: 915 });
    await page.goto(`/groups/${FLAT}`);
    const title = page.getByText('Saree Dry Clean', { exact: true }).first();
    const box = await title.boundingBox();
    // Measured 49px before the icon was hidden, which fitted about six
    // characters. Pins the budget so a future row change cannot quietly
    // squeeze it back.
    expect(box.width).toBeGreaterThanOrEqual(70);
  });

  test('says who owes what, per bill', async ({ page }) => {
    await page.goto(`/groups/${FLAT}`);
    // Paid by Priya, split 180 to the signed-in user.
    await expect(page.getByText(/you owe ₹180\.00/)).toBeVisible();
    // Paid by the signed-in user across a three-way shares split, so the other
    // two members owe them.
    await expect(page.getByText(/you are owed/)).toBeVisible();
  });

  test('marks a bill the user had no part in as not involved', async ({ page }) => {
    await page.goto(`/groups/${FLAT}`);
    // Rohan paid, and the signed-in user is not in the item's assignments at
    // all. "you are owed ₹0.00" would be wrong, so this is its own state.
    const row = page.getByRole('listitem').filter({ hasText: 'Saree Dry Clean' });
    await expect(row).toContainText('not involved');
    await expect(row).not.toContainText('you owe');
    await expect(row).not.toContainText('you are owed');
  });

  test('the status reads as text, not colour alone', async ({ page }) => {
    await page.goto(`/groups/${FLAT}`);
    // Both directions carry a word, so the meaning survives with the tones
    // stripped, in greyscale, or to a screen reader.
    // toHaveCount rather than count(), which does not retry and would race the
    // bill load.
    await expect(
      page.getByRole('listitem').filter({ hasText: /you owe|you are owed|not involved/ }),
    ).toHaveCount(3);
  });
});
