import { expect, test } from '@playwright/test';
import { seedAuth } from './helpers/auth.js';
import { stubApi } from './helpers/api.js';
import { EMPTY_FRIENDS, TRIP } from './fixtures/data.js';

test.beforeEach(async ({ page }) => {
  await seedAuth(page);
  await stubApi(page);
});

const cardFor = (page, name) =>
  page.locator('div.rounded-card', { has: page.getByText(name, { exact: true }) }).first();

test.describe('friends', () => {
  test('renders a card per person who shares a group', async ({ page }) => {
    await page.goto('/friends');
    for (const name of ['Rohan', 'Priya', 'Dev']) {
      await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
    }
  });

  test('shows the email and the number of shared groups', async ({ page }) => {
    await page.goto('/friends');
    await expect(page.getByText('rohan@example.com')).toBeVisible();
    // The shared-group count is the one the mock got wrong: it counted only
    // the groups with a balance, so this would have read "1 group in common".
    await expect(page.getByText('2 groups in common')).toBeVisible();
  });

  test('breaks the total down per group', async ({ page }) => {
    await page.goto('/friends');
    const card = cardFor(page, 'Rohan');
    await expect(card).toContainText('Coorg Trip');
    await expect(card).toContainText('you are owed');
    await expect(card).toContainText('₹60.00');
  });

  test('each per-group row settles inside that group', async ({ page }) => {
    await page.goto('/friends');
    const card = cardFor(page, 'Rohan');
    const settle = card.getByRole('link', { name: 'Settle' });
    await expect(settle).toHaveAttribute('href', `/groups/${TRIP}/balances`);
  });

  test('a person you are square with shows no per-group rows', async ({ page }) => {
    await page.goto('/friends');
    const card = cardFor(page, 'Dev');
    await expect(card).toContainText('₹0.00');
    await expect(card.getByRole('link', { name: 'Settle' })).toHaveCount(0);
  });

  test('never shows yourself as your own friend', async ({ page }) => {
    await page.goto('/friends');
    // Scoped to <main>: the rail footer legitimately shows the signed-in
    // user's name, so a page-wide assertion would fail for the wrong reason.
    // Ananya is in all three fixture groups, so a missing self-filter would
    // put her in the list.
    await expect(
      page.getByRole('main').getByText('Ananya', { exact: true }),
    ).toHaveCount(0);
  });

  test('the summary is the sum of the friend totals', async ({ page }) => {
    await page.goto('/friends');
    // 60 + 180 + 0
    await expect(page.getByText('+₹240.00').filter({ visible: true }).first()).toBeVisible();
  });

  test('shows an empty state with no friends', async ({ page }) => {
    await stubApi(page, { simple: { 'GET settlements/friends/': () => EMPTY_FRIENDS } });
    await page.goto('/friends');
    await expect(page.getByRole('heading', { name: 'No friends yet' })).toBeVisible();
  });

});
