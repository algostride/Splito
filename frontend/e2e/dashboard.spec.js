import { expect, test } from '@playwright/test';
import { seedAuth } from './helpers/auth.js';
import { stubApi } from './helpers/api.js';
import { EMPTY_GROUPS } from './fixtures/data.js';

test.beforeEach(async ({ page }) => {
  await seedAuth(page);
  await stubApi(page);
});

/**
 * The grid is named so this can be scoped to it. The rail also links every
 * group, so an unscoped `a[href^="/groups/"]` would match the nav as well as
 * the cards. The rail's own group list is a plain div of NavItems rather than a
 * ul, so "Groups" as an accessible name is unique on this page.
 */
const grid = (page) => page.getByRole('list', { name: 'Groups' });
const cards = (page) => grid(page).locator('> li');

/**
 * How many cards share the topmost row, read from the rendered geometry.
 *
 * Asserting a Tailwind breakpoint class would only prove the class is on the
 * element; this measures what the browser actually laid out, so it catches a
 * token change that silently alters the column count.
 */
const columnsAt = async (page) => {
  const tops = await cards(page).evaluateAll((els) =>
    els.map((el) => Math.round(el.getBoundingClientRect().top)),
  );
  if (tops.length === 0) return 0;
  return tops.filter((top) => top === tops[0]).length;
};

test.describe('dashboard', () => {
  test('renders one card per group, at every width', async ({ page }) => {
    await page.goto('/');
    await expect(grid(page)).toBeVisible();
    await expect(cards(page)).toHaveCount(3);
    for (const name of ['Flat 302, Indiranagar', 'Coorg Trip', 'Weekend Trip']) {
      await expect(grid(page).getByText(name)).toBeVisible();
    }
  });

  test('lays out 1 / 2 / 3 columns as the viewport grows', async ({ page }) => {
    await page.goto('/');
    // Widths chosen either side of every breakpoint the grid switches on, plus
    // the two viewport projects run at. The rail is 68px from md and 248px from
    // lg, and Screen caps its column at 1360px, so the card is 306px at md and
    // 307px at xl; three-up is only readable from xl.
    const expectations = [
      { width: 375, columns: 1, why: 'phone' },
      { width: 767, columns: 1, why: 'just under md' },
      { width: 768, columns: 2, why: 'md, icon rail' },
      { width: 1023, columns: 2, why: 'just under lg' },
      { width: 1024, columns: 2, why: 'lg, full rail' },
      { width: 1279, columns: 2, why: 'just under xl' },
      { width: 1280, columns: 3, why: 'xl' },
      { width: 1440, columns: 3, why: 'desktop project' },
    ];
    for (const { width, columns, why } of expectations) {
      await page.setViewportSize({ width, height: 900 });
      expect(await columnsAt(page), `${columns} column(s) at ${width}px (${why})`).toBe(
        columns,
      );
    }
  });

  test('cards stay readable at the widest three-up width', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');
    // The narrowest three-up layout is at xl, so that is where a long name has
    // least room. It must wrap rather than overflow its card.
    const card = cards(page).first();
    const cardBox = await card.boundingBox();
    const linkBox = await card.getByRole('link').boundingBox();
    expect(linkBox.width).toBeLessThanOrEqual(cardBox.width);
    expect(await card.getByText('Flat 302, Indiranagar').isVisible()).toBe(true);
  });

  test('shows the fixture figures, not placeholders', async ({ page }) => {
    await page.goto('/');
    const card = cards(page).first();
    await expect(card).toContainText('Flat 302, Indiranagar');
    await expect(card).toContainText('4 members');
    await expect(card).toContainText('−₹180.00');
    await expect(card).toContainText('you owe');
    // Group spend only lived in the table, so the card has to carry it or the
    // grid migration would have dropped a column.
    await expect(card).toContainText('₹1,240.00');
    await expect(card).toContainText('group spend');
  });

  test('signs the net rather than relying on colour alone', async ({ page }) => {
    await page.goto('/');
    // A negative balance carries a minus and a positive one a plus, so the
    // meaning survives without relying on the red/green tone.
    await expect(
      page.getByText('−₹180.00').filter({ visible: true }).first(),
    ).toBeVisible();
    await expect(
      page.getByText('+₹240.00').filter({ visible: true }).first(),
    ).toBeVisible();
  });

  test('each card is padded by the card token, not flush to its edge', async ({ page }) => {
    await page.goto('/');
    // The table's wrapper owned a 24px inset and its outermost cells dropped
    // their own padding. The grid inverts that: each card owns `p-card`, and
    // the space between cards is the gap token.
    const padding = await cards(page)
      .first()
      .locator('> div')
      .evaluate((el) => getComputedStyle(el).paddingLeft);
    expect(padding).toBe('24px');
  });

  test('cards are separated by the gap token', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    const gap = await grid(page).evaluate((el) => getComputedStyle(el).gap);
    expect(gap).toBe('24px');
  });

  test('every card is a link to its group', async ({ page }) => {
    await page.goto('/');
    const link = cards(page).first().getByRole('link');
    // The whole card is the hit target, not just the name.
    await expect(link).toHaveAttribute('href', /^\/groups\/[0-9a-f-]{36}$/);
  });

  test('shows an empty state when there are no groups', async ({ page }) => {
    await stubApi(page, { simple: { 'GET groups/': () => EMPTY_GROUPS } });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'No groups yet' })).toBeVisible();
    await expect(grid(page)).toHaveCount(0);
  });
});
