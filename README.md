# Splito - Splitwise Alternative MVP

Splito is a modern, responsive web application for creating groups, logging shared bills, and determining who owes who through pairwise balance computation.

## Tech Stack
- **Backend**: Django 5.2, Django REST Framework, PostgreSQL, SimpleJWT
- **Frontend**: React 19, React Router 7, Vite, Redux Toolkit (RTK Query), Tailwind CSS v4

## Feature Set
1. **Secure Authentication**: JWT token management with refresh and rotation, registration via API.
2. **Groups & Memberships**: Create isolated groups for friends, events, or trips.
3. **Invites**: One-click ticket URLs to invite members; a logged-out invitee is returned to the invite after signing in.
4. **Simple & Compound Bills**: Split a single amount, or add multiple items with a per-item split in shares or percent.
5. **Settlement Engine**: Pairwise debts computed on the server, with settlements paying them down.

## Money handling

Amounts are conserved end to end, and this is the rule worth knowing before changing anything:

- `bills_itemassignment.share_amount` is the **stored money**, checked to equal its item's amount exactly on write.
- `bills_itemassignment.split_value` stores the **editing intent** (integer shares, or a percent with up to 6 decimal places) so re-saving a bill does not silently redistribute the split.
- Splitting `amount` across weights is done in whole paise with the leftover given to the largest fractional remainder, in `BillSerializer._allocate` and `allocate()` in `frontend/src/components/bills/billUtils.js`. Rounding each member independently is what used to make an even split of ₹10 across three people save as 9.99 and get rejected.
- In percent mode the weights are percentages of the item and are **not** rescaled to their own sum, so a 60/30 split stays short and reports as invalid instead of silently becoming 65/35.
- `/settlements/balances/` and `/settlements/debts/` are both derived from one pairwise ledger, so they cannot disagree, and every net balance sums to zero.

## Local Setup

### Backend
1. `cd backend`
2. `python3 -m venv myenv && source myenv/bin/activate`
3. `pip install -r requirements.txt`
4. Create a PostgreSQL database, then copy `.env.example` to `.env` and fill in the DB credentials and a real `SECRET_KEY`.
5. `python manage.py migrate`
6. `python manage.py runserver`

`CORS_ALLOWED_ORIGINS` in `config/settings.py` is hardcoded to `localhost:5173` and `127.0.0.1:5173`. If Vite picks a different port because 5173 is taken, API calls will fail CORS.

### Frontend
1. `cd frontend`
2. `npm install`
3. `npm run dev`

Navigate to `http://localhost:5173`.

### Demo data

To look at the UI with something on screen, seed the database:

```
cd backend
python manage.py seed_demo
```

This creates 7 users, 6 groups, 19 bills, 25 items and 3 settlements, then prints
the login, a per-group summary and a direct link to each screen. Sign in as
`aarav@demo.splito.test` / `Splito#2026`.

**It destroys all existing data.** A `dumpdata` backup is written to
`backend/seed-backups/` first, with the `loaddata` command to restore it printed
alongside. Pass `--no-backup` to skip that.

```
python manage.py seed_demo --seed 42     # different dates and payers
python manage.py seed_demo --no-backup
```

The shape of the data is fixed; only dates and payers vary with `--seed`. That is
deliberate — random data would make screenshots unreproducible and would sometimes
leave a screen empty. The fixed set covers every screen plus its empty state: a
settled group, a group with no bills, a solo group, a long group name, and one
user who shares no group with you (so the friends page can be checked against
co-membership rather than a friend list).

Two other flags worth knowing: nothing relational is created with `objects.create()`.
The seeder drives the real API via `APIClient`, so the paise-conserving allocation
and the membership validations are what produce the data. It reconciles the result
before exiting — item totals, share totals, zero-sum balances and cross-endpoint
`your_net` — and exits non-zero if anything fails, so broken seed data cannot be
mistaken for a UI bug.

## Tests

```
cd backend  && python manage.py test apps    # 88 tests
cd frontend && npm run lint
cd frontend && npm run build
cd frontend && npx playwright install chromium   # once, ~150MB
cd frontend && npm run test:e2e                # 223 tests, ~100s
```

The backend suite covers auth, invites, group isolation, both bill types, share/percent splits, the money-conservation rules above, the `0004` backfill, balances/debts, and the friends endpoint.

### Frontend E2E

Playwright drives real Chromium at two viewports (1440x900 and Pixel 7). The API is
stubbed, so the suite needs no database and no Django process — `npm run test:e2e`
starts only the Vite dev server.

Two details are load-bearing:

- The dev server is pinned to port 5173 with `--strictPort`. CORS is hardcoded to
  `localhost:5173` in `backend/config/settings.py`, so letting Vite drift to 5174
  makes every request fail and buries the real error.
- `api-shapes.json` at the repo root is the contract between the two languages.
  The fixtures in `frontend/e2e/fixtures/data.js` are built from it, and
  `ApiShapeContractTests` in the backend suite asserts the real DRF responses
  against it. Rename a serializer field and the backend suite fails, so a stub
  cannot drift away from reality unnoticed.

Run `npm run test:e2e:ui` for the Playwright inspector.

## Notes

- `schema.txt` is the entity diagram and is kept in sync with the Django models.
- `templates.html` and exported mermaid diagrams are local mockups and are gitignored.
