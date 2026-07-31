/**
 * The API stub.
 *
 * `stubApi` intercepts everything under the API base path and answers from the
 * fixtures. Nothing needs to be listening on :8000, which is what keeps this
 * suite hermetic: no postgres, no Django process, no seeding, and it behaves
 * the same on any machine.
 *
 * `overrides` lets a single test swap one endpoint without a bespoke router —
 * that is how the empty states are covered.
 *
 * Anything not matched fails loudly rather than falling through to a real
 * request. A silently unmocked endpoint produces a confusing "cannot read
 * property of undefined" in the component under test instead of a clear
 * message here.
 */
import {
  BILLS,
  DEBTS,
  FRIENDS,
  GROUPS,
  MEMBERS,
  SETTLEMENTS,
} from '../fixtures/data.js';

const API_PATTERN = '**/api/v1/**';

const strip = (url) => {
  const path = new URL(url).pathname.replace(/^\/api\/v1\//, '');
  return { path, query: new URL(url).searchParams };
};

const defaultRoutes = () => ({
  'GET groups/': () => GROUPS,
  'GET settlements/friends/': () => FRIENDS,
});

/**
 * Group-scoped endpoints are matched by path plus `?group=`, because the bills
 * and settlements list routes are the same path as their detail siblings.
 */
const groupScoped = (data) => ({ query }) => {
  const group = query.get('group');
  return data[group] ?? [];
};

const buildRouter = (overrides) => {
  const simple = { ...defaultRoutes(), ...(overrides.simple ?? {}) };

  /**
   * A handler may return `{ __status, __body }` to answer with something other
   * than 200. Without this the stub can only ever succeed, so a test could not
   * cover the paths that matter most here: a delete that fails, a members query
   * that fails. Those are exactly the states that were broken.
   */
  const unwrap = (value) => {
    if (value && typeof value === 'object' && '__status' in value) {
      return { status: value.__status, body: value.__body ?? null };
    }
    return { status: 200, body: value ?? null };
  };

  return (url, method) => {
    const { path, query } = strip(url);
    const group = query.get('group');

    /* Overrides are consulted first so any endpoint can be replaced,
       including the group-scoped ones. Otherwise `groups/<id>/members/` was
       answered from fixtures with no way to make it fail, which is the case
       the settle dialog was silently broken for. */
    for (const [key, handler] of Object.entries(simple)) {
      const [verb, route] = key.split(' ');
      if (verb === method && route === path) {
        return unwrap(typeof handler === 'function' ? handler({ path, query }) : handler);
      }
    }

    // Detail routes before the list routes: `groups/x/` starts with `groups/`.
    const detail = path.match(/^groups\/([^/]+)\/$/);
    if (detail) {
      const group_ = GROUPS.find((g) => g.id === detail[1]);
      if (method === 'GET' && group_) return unwrap(group_);
    }

    const members = path.match(/^groups\/([^/]+)\/members\/$/);
    if (members && method === 'GET') return unwrap(MEMBERS[members[1]] ?? []);

    const bill = path.match(/^bills\/([^/]+)\/$/);
    if (bill && method === 'GET') {
      for (const rows of Object.values(BILLS)) {
        const found = rows.find((b) => b.id === bill[1]);
        if (found) return unwrap(found);
      }
    }

    if (path === 'bills/' && method === 'GET') return unwrap(groupScoped(BILLS)({ path, query }));
    if (path === 'settlements/' && method === 'GET') {
      return unwrap(groupScoped(SETTLEMENTS)({ path, query }));
    }
    if (path === 'settlements/debts/' && method === 'GET') {
      return unwrap(groupScoped(DEBTS)({ path, query }));
    }

    /* Any DELETE succeeds by default. A mutation still has to send the right
       URL to get here at all, so this cannot mask a malformed request -- it
       turns out that is exactly what it caught. Deleting a bill from the bills
       tab was passing the whole object, producing `bills/[object Object]/`,
       and no test covered the happy path, so nothing noticed. Tests that need
       a failure override the specific path. */
    if (method === 'DELETE') return unwrap({ ok: true });

    /* Any POST or PUT succeeds by default, for the same reason: the tests that
       care about a failure override the specific path. Without this a form
       save had no stub at all, so the PUT threw "No E2E stub" and the test was
       really asserting the stub's error handling. */
    if (method === 'POST' || method === 'PUT') return unwrap({ id: 'created' });

    throw new Error(`No E2E stub for ${method} ${path}${group ? `?group=${group}` : ''}`);
  };
};

/**
 * @param overrides.simple  keyed "GET groups/" -> value, ({path,query}) => value,
 *   or `{ __status: 500, __body: ... }` to answer with a failure
 * @param overrides.unmatched what to do with an unmocked call: 'throw' (default) or 'empty'
 */
export const stubApi = async (page, overrides = {}) => {
  const route = buildRouter(overrides);
  await page.route(API_PATTERN, async (r) => {
    try {
      const result = route(r.request().url(), r.request().method());
      await r.fulfill({
        status: result.status,
        contentType: 'application/json',
        body: JSON.stringify(result.body),
      });
    } catch (error) {
      if (overrides.unmatched === 'empty') {
        await r.fulfill({
          status: 200,
          contentType: 'application/json',
          body: '[]',
        });
        return;
      }
      throw error;
    }
  });
};
