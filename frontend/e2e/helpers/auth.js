/**
 * Signs the browser in without going through /login.
 *
 * authSlice reads `token`, `refresh_token` and `user` from localStorage when
 * the store is created, so seeding them before the app's first script runs is
 * enough. addInitScript runs on every navigation, which is what we want: the
 * values have to be there again after a client-side route change reloads
 * nothing, and after any full navigation the test triggers.
 */
import { CURRENT_USER } from '../fixtures/data.js';

export const seedAuth = async (page, { user = CURRENT_USER } = {}) => {
  await page.addInitScript(
    ([token, refresh, usr]) => {
      window.localStorage.setItem('token', token);
      window.localStorage.setItem('refresh_token', refresh);
      window.localStorage.setItem('user', usr);
    },
    ['e2e-access-token', 'e2e-refresh-token', JSON.stringify(user)],
  );
};

/** Signs out, for the one redirect assertion in the shell spec. */
export const clearAuth = async (page) => {
  await page.addInitScript(() => window.localStorage.clear());
};
