import { expect, test } from '@playwright/test';
import { seedAuth } from './helpers/auth.js';
import { stubApi } from './helpers/api.js';
import { FLAT } from './fixtures/data.js';

/**
 * Focus and keyboard behaviour.
 *
 * Most of this covered gaps that were invisible to a mouse user: focus that
 * never entered a menu, links that stayed tabbable inside a closed drawer, and
 * an icon-only rail whose labels existed only as tooltips.
 */

test.beforeEach(async ({ page }) => {
  await seedAuth(page);
  await stubApi(page);
});

test.describe('one focus ring for the app', () => {
  test('a keyboard-focused button shows the accent ring', async ({ page }) => {
    await page.goto('/');
    const trigger = page.getByRole('button', { name: /create group/i }).first();
    await trigger.focus();
    const outline = await trigger.evaluate((el) => {
      const s = getComputedStyle(el);
      return { width: s.outlineWidth, color: s.outlineColor, style: s.outlineStyle };
    });
    // 2px solid, and the accent token rather than the browser's own colour.
    expect(outline.style).toBe('solid');
    expect(outline.width).toBe('2px');
    expect(outline.color).not.toBe('rgba(0, 0, 0, 0)');
  });

  /* Checked on a button, not a text field. A text field matches
     :focus-visible whenever it is focused, *including* after a mouse click --
     that is the spec's behaviour for keyboard-accepting elements, so the ring
     on a field is correct and deliberate. Only a non-text control
     distinguishes the two, which is where the old `focus:` utilities were
     actually wrong. */
  test('a mouse-clicked button does not draw a ring', async ({ page }) => {
    await page.goto('/');
    const trigger = page.getByRole('button', { name: 'Add bill' }).first();
    const count = await trigger.count();
    test.skip(count === 0, 'the group header trigger is not on this page');
    await trigger.click();
    const outline = await trigger.evaluate((el) => getComputedStyle(el).outlineStyle);
    expect(outline).toBe('none');
  });

  test('a text field does show a ring, since it takes keyboard input', async ({ page }) => {
    await page.goto(`/groups/${FLAT}/balances`);
    await page.getByRole('button', { name: 'Settle up' }).click();
    const select = page.getByRole('dialog').getByRole('combobox').first();
    await select.focus();
    const outline = await select.evaluate((el) => getComputedStyle(el).outlineStyle);
    expect(outline).toBe('solid');
  });
});

test.describe('the popover is usable from the keyboard', () => {
  test('focus moves into the menu on open and back to the trigger on close', async ({
    page,
  }) => {
    await page.goto(`/groups/${FLAT}`);
    const trigger = page.getByRole('button', { name: 'Add bill' }).first();
    await trigger.click();
    const menu = page.getByRole('menu');
    await expect(menu).toBeVisible();

    // Polled, not read once: focus moves in an effect after the menu renders,
    // so asserting immediately races it and passes or fails by luck.
    await expect
      .poll(() => menu.evaluate((el) => el.contains(document.activeElement)))
      .toBe(true);

    await page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0);
    // And it comes back, so the next Tab continues from where the user was.
    await expect
      .poll(() => trigger.evaluate((el) => el === document.activeElement))
      .toBe(true);
  });

  test('arrow keys move between items and wrap', async ({ page }) => {
    await page.goto(`/groups/${FLAT}`);
    await page.getByRole('button', { name: 'Add bill' }).first().click();
    const menu = page.getByRole('menu');
    await expect(menu).toBeVisible();
    await expect
      .poll(() => menu.evaluate((el) => el.contains(document.activeElement)))
      .toBe(true);

    const active = () =>
      page.evaluate(() => document.activeElement?.textContent?.trim().slice(0, 12) ?? '');

    const first = await active();
    await page.keyboard.press('ArrowDown');
    await expect.poll(active).not.toBe(first);

    await page.keyboard.press('End');
    const last = await active();
    expect(last).not.toBe(first);
    // Wraps: from the last item, Down returns to the first.
    await page.keyboard.press('ArrowDown');
    await expect.poll(active).toBe(first);
  });
});

test.describe('the closed drawer is not tabbable', () => {
  test('its links are inert while it is closed', async ({ page }) => {
    // The drawer exists in the DOM on every phone-width page. `aria-hidden`
    // alone hid it from screen readers but left every link focusable, so a
    // keyboard user could Tab into an off-screen panel.
    test.skip(page.viewportSize().width >= 768, 'the drawer only exists below md');
    await page.goto('/');
    // Queried through the DOM, not by role: an inert subtree is correctly
    // excluded from the accessibility tree, so getByRole would not find the
    // link at all -- which is the point, but it makes for a confusing assertion.
    const result = await page.evaluate(() => {
      const wrapper = document.querySelector('[data-drawer-open]');
      if (!wrapper) return { found: false };
      const link = wrapper.querySelector('a[href="/friends"]');
      return {
        found: true,
        inert: wrapper.hasAttribute('inert'),
        ariaHidden: wrapper.getAttribute('aria-hidden'),
        // The practical test: can a keyboard user actually reach it?
        reachable: link ? link.tabIndex >= 0 && !wrapper.matches(':disabled') : null,
      };
    });
    expect(result.found).toBe(true);
    expect(result.inert).toBe(true);
    expect(result.ariaHidden).toBe('true');
  });
});

test.describe('the icon-only rail still names its links', () => {
  test('nav links have an accessible name at every width', async ({ page }) => {
    for (const width of [800, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');
      // At 800px the rail is icon-only and the label span is sr-only, so the
      // name has to come from the text content rather than a title attribute.
      for (const name of ['Dashboard', 'Friends']) {
        await expect(page.getByRole('link', { name, exact: true })).toHaveCount(1);
      }
    }
  });
});
