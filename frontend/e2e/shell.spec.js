import { expect, test } from '@playwright/test';
import { clearAuth, seedAuth } from './helpers/auth.js';
import { stubApi } from './helpers/api.js';
import { GROUPS } from './fixtures/data.js';

/**
 * The app shell: rail, drawer, theme.
 *
 * These assert computed styles rather than merely that an element exists. A
 * presence check would pass with a broken margin, a missing token class or a
 * dark mode that never applied, and those were the actual failures during the
 * token migration.
 */

test.beforeEach(async ({ page }) => {
  await seedAuth(page);
  await stubApi(page);
});

/**
 * A group name too long for the rail.
 *
 * The regression: the label span carried `sr-only lg:not-sr-only truncate` on
 * one element. `not-sr-only` is a full reset that sets `white-space: normal` and
 * `overflow: visible`, and because both selectors are a single class, the
 * responsive one being emitted later silently won. The name then wrapped
 * inside a fixed 40px row and spilled into the rows above and below.
 *
 * Asserted as geometry and computed style, not class names, so a future utility
 * clash of the same shape is caught rather than assumed away.
 */
const LONG_NAME =
  'A Deliberately Long Group Name Used To Check Header Truncation And Wrapping Behaviour In The UI';

/** The rail's own 248px minus its p-3 padding, the width a label can occupy. */
const withLongGroup = (page) =>
  stubApi(page, {
    simple: {
      'GET groups/': () => [...GROUPS, { ...GROUPS[0], id: 'long-group', name: LONG_NAME }],
    },
  });

/** The long group as it appears in the rail, and nowhere else. */
const railLink = (page) =>
  page.getByRole('complementary').getByRole('link', { name: LONG_NAME });

test.describe('a group name too long for the rail', () => {
  test('truncates to one line instead of wrapping', async ({ page }) => {
    test.skip(page.viewportSize().width < 1024, 'the rail only shows labels from lg');
    await withLongGroup(page);
    await page.goto('/');

    // Scoped to the rail: the same group also renders as a dashboard card and
    // in the below-md card list, so an unscoped locator matches three.
    const link = railLink(page);
    await expect(link).toBeVisible();

    // The inner span is the one carrying `truncate`; the outer carries the
    // sr-only reset. `span.block` picks the inner uniquely.
    const label = link.locator('span.block');
    const style = await label.evaluate((el) => {
      const s = getComputedStyle(el);
      return { whiteSpace: s.whiteSpace, overflow: s.overflow, scrollWidth: el.scrollWidth, clientWidth: el.clientWidth };
    });

    // The direct guard on the regression: these were `normal` and `visible`.
    expect(style.whiteSpace).toBe('nowrap');
    expect(style.overflow).toBe('hidden');
    // And truncation is genuinely engaged rather than merely styled.
    expect(style.scrollWidth).toBeGreaterThan(style.clientWidth);

    // It does not spill outside its own row.
    const labelBox = await label.boundingBox();
    const linkBox = await link.boundingBox();
    expect(labelBox.x + labelBox.width).toBeLessThanOrEqual(linkBox.x + linkBox.width + 1);
  });

  test('the label is one line tall, like a short name is', async ({ page }) => {
    test.skip(page.viewportSize().width < 1024, 'the rail only shows labels from lg');
    await withLongGroup(page);
    await page.goto('/');
    const link = railLink(page);
    await expect(link).toBeVisible();

    /* Measured against a short name rather than a hardcoded pixel height, so it
       does not depend on the font metrics or on `h-control`.

       The first version of this test asserted the *row* was 40px and it passed
       even with the bug in place: `h-control` is a fixed height, so a wrapped
       label overflowed the box instead of growing it. The box could never
       report the wrap. The label's own height is what changes. */
    const longLabel = link.locator('span.block');
    const shortLabel = page
      .getByRole('complementary')
      .getByRole('link', { name: 'Coorg Trip' })
      .locator('span.block');
    await expect(shortLabel).toBeVisible();

    const longH = (await longLabel.boundingBox()).height;
    const shortH = (await shortLabel.boundingBox()).height;
    // One line each. A wrap would put this at roughly double.
    expect(longH).toBeLessThanOrEqual(shortH + 1);

    // And it does not spill outside the row it sits in.
    const rowBox = await link.boundingBox();
    const labelBox = await longLabel.boundingBox();
    expect(labelBox.y).toBeGreaterThanOrEqual(rowBox.y - 1);
    expect(labelBox.y + labelBox.height).toBeLessThanOrEqual(rowBox.y + rowBox.height + 1);
  });

  test('the full name is still the accessible name', async ({ page }) => {
    test.skip(page.viewportSize().width < 1024, 'the rail only shows labels from lg');
    await withLongGroup(page);
    await page.goto('/');
    // text-overflow: ellipsis is visual only, so the DOM text is complete. If
    // this ever matched a clipped substring, the fix would be truncating the
    // name itself.
    const label = railLink(page).locator('span.block');
    await expect(label).toHaveText(LONG_NAME);
  });

  test('the icon-only rail still names the link for assistive tech', async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 900 });
    await withLongGroup(page);
    await page.goto('/');
    // Between md and lg there is no room to show the text, so it is sr-only
    // rather than absent -- the reason the outer span exists at all.
    await expect(railLink(page)).toHaveCount(1);
    const visibleLabel = railLink(page).locator('span.block');
    // Not rendered, but present and named.
    expect(await visibleLabel.count()).toBe(1);
  });
});

test.describe('rail', () => {
  test('shows the groups from the API', async ({ page }) => {
    test.skip(page.viewportSize().width < 768, 'no rail on mobile');
    await page.goto('/');
    const rail = page.getByRole('complementary');
    await expect(rail.getByRole('link', { name: 'Flat 302, Indiranagar' })).toBeVisible();
    await expect(rail.getByRole('link', { name: 'Coorg Trip' })).toBeVisible();
  });

  test('is hidden below md, where the drawer replaces it', async ({ page }) => {
    test.skip(
      page.viewportSize().width >= 768,
      'the rail is meant to be visible above md',
    );
    await page.goto('/');
    await expect(page.getByRole('complementary')).toBeHidden();
  });

  test('carries the navigation the app actually has', async ({ page }) => {
    test.skip(page.viewportSize().width < 768, 'no rail on mobile');
    await page.goto('/');
    const rail = page.getByRole('complementary');
    await expect(rail.getByRole('link', { name: 'Dashboard' })).toBeVisible();
    await expect(rail.getByRole('link', { name: 'Friends' })).toBeVisible();
  });
});

test.describe('drawer', () => {
  test.skip(({ viewport }) => viewport.width >= 768, 'drawer only exists below md');

  // The drawer's open state is published as data-drawer-open on the overlay,
  // which is the single thing the CSS keys off. Asserting that rather than the
  // panel's visibility, because a closed panel is translated off-screen rather
  // than removed: it keeps a non-empty bounding box, so toBeHidden() cannot
  // tell "closed" from "open".
  const drawer = (page) => page.locator('[data-drawer-open]');

  // Asserts the panel's real geometry, not just the flag. An earlier version
  // checked only data-drawer-open, which passed while the drawer was visibly
  // shut: the flag was on the wrapper but the translate-x-0 and opacity-100
  // classes were on its children, and Tailwind's arbitrary data variant only
  // matches the element that carries the attribute.
  const panelLeft = (page) =>
    page.locator('.drawer-panel').evaluate((el) => el.getBoundingClientRect().left);
  const scrimEvents = (page) =>
    page
      .locator('.drawer-scrim')
      .evaluate((el) => getComputedStyle(el).pointerEvents);

  test('opens, and closes on Escape', async ({ page }) => {
    await page.goto('/');
    await expect(drawer(page)).toHaveAttribute('data-drawer-open', 'false');
    // Shut: parked off-screen to the left, and not intercepting anything.
    expect(await panelLeft(page)).toBeLessThan(0);
    expect(await scrimEvents(page)).toBe('none');

    await page.getByRole('button', { name: 'Open menu' }).click();
    await expect(drawer(page)).toHaveAttribute('data-drawer-open', 'true');
    // Open: on screen at the left edge, and clickable.
    await expect.poll(() => panelLeft(page)).toBe(0);
    await expect.poll(() => scrimEvents(page)).toBe('auto');
    await expect(page.getByRole('link', { name: 'Friends' })).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(drawer(page)).toHaveAttribute('data-drawer-open', 'false');
    await expect.poll(() => panelLeft(page)).toBeLessThan(0);
  });

  test('closes when the scrim is tapped', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Open menu' }).click();
    await expect(drawer(page)).toHaveAttribute('data-drawer-open', 'true');

    // The panel is w-rail (248px) from the left edge; this lands well clear of
    // it, on the scrim.
    await page.mouse.click(page.viewportSize().width - 20, 500);
    await expect(drawer(page)).toHaveAttribute('data-drawer-open', 'false');
  });

  test('a closed drawer does not swallow taps on the top bar', async ({ page }) => {
    // Regression guard. The overlay is fixed inset-0 at z-40, above the top
    // bar at z-30, so without pointer-events-none on the wrapper the entire
    // page is unclickable on a phone while the drawer is shut.
    await page.goto('/');
    await page.getByRole('button', { name: 'Open menu' }).click({ timeout: 5000 });
    await page.keyboard.press('Escape');
    await expect(drawer(page)).toHaveAttribute('data-drawer-open', 'false');
    await page.getByRole('button', { name: 'Open menu' }).click({ timeout: 5000 });
    await expect(drawer(page)).toHaveAttribute('data-drawer-open', 'true');
  });
});

test.describe('theme', () => {
  test('toggles data-mode on the html element and remembers it', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-mode', 'light');

    await page.getByRole('button', { name: 'Switch to dark mode' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-mode', 'dark');

    // The canvas token is redefined per mode, so the resolved colour is the
    // real proof that the dark palette took effect, not just the attribute.
    const dark = await page.evaluate(
      () => getComputedStyle(document.body).backgroundColor,
    );

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-mode', 'dark');
    const afterReload = await page.evaluate(
      () => getComputedStyle(document.body).backgroundColor,
    );
    expect(afterReload).toBe(dark);
  });

  test('the page background differs between modes', async ({ page }) => {
    await page.goto('/');
    const light = await page.evaluate(
      () => getComputedStyle(document.body).backgroundColor,
    );
    await page.getByRole('button', { name: 'Switch to dark mode' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-mode', 'dark');
    const dark = await page.evaluate(
      () => getComputedStyle(document.body).backgroundColor,
    );
    expect(light).not.toBe(dark);
  });
});

test.describe('layout', () => {
  test('the screen gutter is the 32px token, not a hardcoded px-4', async ({ page }) => {
    await page.goto('/');
    const h1 = page.getByRole('heading', { level: 1, name: 'Your groups' });
    // Walk up to whichever ancestor provides the gutter. The heading sits
    // inside a flex row with no padding of its own, so looking only at the
    // immediate parent reads 0px and would pass for the wrong reason.
    const padding = await h1.evaluate((el) => {
      let node = el;
      while (node) {
        const value = getComputedStyle(node).paddingLeft;
        if (value && value !== '0px') return value;
        node = node.parentElement;
      }
      return null;
    });
    expect(padding).toBe('32px');
  });

  test('the rail is a fixed width and the main column takes the rest', async ({
    page,
  }) => {
    test.skip(page.viewportSize().width < 768, 'no rail on mobile');
    await page.goto('/');
    const railWidth = await page
      .getByRole('complementary')
      .evaluate((el) => el.getBoundingClientRect().width);
    expect(railWidth).toBe(248);
  });
});

test.describe('auth gate', () => {
  test('sends a signed-out visitor to login', async ({ page }) => {
    await clearAuth(page);
    await page.goto('/');
    await expect(page).toHaveURL(/\/login/);
  });
});
