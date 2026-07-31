/**
 * E2E fixtures.
 *
 * The shapes are pinned by api-shapes.json at the repo root, which the backend
 * suite also reads. That file is what stops these payloads from quietly
 * becoming fiction: if a serializer field is renamed, `manage.py test apps`
 * fails and points here.
 *
 * Every value is fixed, so a test can assert an exact figure rather than
 * "something is not empty".
 */

const ME = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'ananya@example.com',
  name: 'Ananya',
  created_at: '2026-01-04T09:00:00Z',
};

const ROHAN = {
  id: '22222222-2222-4222-8222-222222222222',
  email: 'rohan@example.com',
  name: 'Rohan',
  created_at: '2026-01-05T09:00:00Z',
};

const PRIYA = {
  id: '33333333-3333-4333-8333-333333333333',
  email: 'priya@example.com',
  name: 'Priya',
  created_at: '2026-01-06T09:00:00Z',
};

const DEV = {
  id: '44444444-4444-4444-8444-444444444444',
  email: 'dev@example.com',
  name: 'Dev',
  created_at: '2026-01-07T09:00:00Z',
};

export const FLAT = 'aaaaaaaa-0000-4000-8000-000000000001';
export const TRIP = 'aaaaaaaa-0000-4000-8000-000000000002';
export const SOLO = 'aaaaaaaa-0000-4000-8000-000000000003';

export const CURRENT_USER = ME;
export const FRIEND_IDS = { ROHAN, PRIYA, DEV };

const money = (n) => Number(n).toFixed(2);

const user = ({ id, email, name }) => ({ id, email, name });

export const GROUPS = [
  {
    id: FLAT,
    name: 'Flat 302, Indiranagar',
    created_by: user(ME),
    created_at: '2026-01-04T09:00:00Z',
    member_count: 4,
    total_spend: '1240.00',
    your_net: '-180.00',
  },
  {
    id: TRIP,
    name: 'Coorg Trip',
    created_by: user(ROHAN),
    created_at: '2026-02-11T09:00:00Z',
    member_count: 2,
    total_spend: '860.50',
    your_net: '240.00',
  },
  {
    // Square with everyone. Exercises the zero-net path on Friends.
    id: SOLO,
    name: 'Weekend Trip',
    created_by: user(ME),
    created_at: '2026-03-02T09:00:00Z',
    member_count: 2,
    total_spend: '0.00',
    your_net: '0.00',
  },
];

export const EMPTY_GROUPS = [];

export const MEMBERS = {
  [FLAT]: [
    { id: 'm1', user: user(ME), joined_at: '2026-01-04T09:00:00Z' },
    { id: 'm2', user: user(ROHAN), joined_at: '2026-01-04T09:05:00Z' },
    { id: 'm3', user: user(PRIYA), joined_at: '2026-01-04T09:06:00Z' },
    // Malformed on purpose: both name and email empty. The backend cannot
    // produce this today, because `User.email` is non-blank. It is here so the
    // split grid is proven not to throw on it, since that grid maps every
    // member and one bad row would take down the whole editor. The previous
    // `(name || email)[0].toUpperCase()` raised a TypeError on exactly this.
    {
      id: 'm4',
      user: { id: '55555555-5555-4555-8555-555555555555', email: '', name: '' },
      joined_at: '2026-01-04T09:07:00Z',
    },
  ],
  [TRIP]: [
    { id: 'm4', user: user(ROHAN), joined_at: '2026-02-11T09:00:00Z' },
    { id: 'm5', user: user(ME), joined_at: '2026-02-11T09:07:00Z' },
  ],
  [SOLO]: [
    { id: 'm6', user: user(ME), joined_at: '2026-03-02T09:00:00Z' },
    { id: 'm7', user: user(DEV), joined_at: '2026-03-02T09:02:00Z' },
  ],
};

const leg = (u, amount) => ({
  user_id: u.id,
  user_name: u.name,
  amount: money(amount),
});

export const DEBTS = {
  [FLAT]: [
    {
      user_id: ME.id,
      user_name: ME.name,
      net_balance: '-180.00',
      owes: [leg(PRIYA, 180.0)],
      gets_from: [],
    },
    {
      user_id: ROHAN.id,
      user_name: ROHAN.name,
      net_balance: '90.00',
      owes: [],
      gets_from: [leg(PRIYA, 90.0)],
    },
    {
      user_id: PRIYA.id,
      user_name: PRIYA.name,
      net_balance: '90.00',
      owes: [leg(ROHAN, 90.0)],
      gets_from: [leg(ME, 180.0)],
    },
  ],
  [TRIP]: [
    {
      user_id: ME.id,
      user_name: ME.name,
      net_balance: '240.00',
      owes: [],
      gets_from: [leg(ROHAN, 240.0)],
    },
    {
      user_id: ROHAN.id,
      user_name: ROHAN.name,
      net_balance: '-240.00',
      owes: [leg(ME, 240.0)],
      gets_from: [],
    },
  ],
  [SOLO]: [
    {
      user_id: ME.id,
      user_name: ME.name,
      net_balance: '0.00',
      owes: [],
      gets_from: [],
    },
    {
      user_id: DEV.id,
      user_name: DEV.name,
      net_balance: '0.00',
      owes: [],
      gets_from: [],
    },
  ],
};

const assignment = (id, u, share) => ({
  id,
  user_id: u.id,
  user: { id: u.id, email: u.email, name: u.name },
  share_amount: money(share),
  split_value: money(share),
});

export const BILLS = {
  [FLAT]: [
    {
      id: 'b1',
      group: FLAT,
      title: 'Groceries',
      total_amount: '1240.00',
      currency: 'INR',
      bill_type: 'simple',
      created_by: user(ME),
      paid_by: PRIYA.id,
      paid_by_detail: { ...user(PRIYA), created_at: PRIYA.created_at },
      created_at: '2026-02-01T10:00:00Z',
      items: [
        {
          id: 'i1',
          name: 'Groceries',
          amount: '1240.00',
          split_mode: 'percent',
          assignments: [
            assignment('a1', ME, 180.0),
            assignment('a2', ROHAN, 90.0),
            assignment('a3', PRIYA, 90.0),
          ],
        },
      ],
    },
    {
      id: 'b2',
      group: FLAT,
      title: 'Electricity',
      total_amount: '760.00',
      currency: 'INR',
      bill_type: 'simple',
      created_by: user(ME),
      paid_by: ME.id,
      paid_by_detail: { ...user(ME), created_at: ME.created_at },
      created_at: '2026-01-20T08:15:00Z',
      items: [
        {
          id: 'i2',
          name: 'Electricity',
          amount: '760.00',
          split_mode: 'shares',
          assignments: [assignment('a4', ME, 1), assignment('a5', ROHAN, 1), assignment('a6', PRIYA, 1)],
        },
      ],
    },
    // Deliberately excludes ME from every item while someone else paid, which is
    // the only way the signed-in user ends up "not involved" in a bill. Without
    // this the status line would never render its third state, and neither the
    // E2E suite nor the seeded dev database could exercise it. Dated March so the
    // Bills tab spans three calendar months.
    {
      id: 'b4',
      group: FLAT,
      title: 'Saree Dry Clean',
      total_amount: '450.00',
      currency: 'INR',
      bill_type: 'simple',
      created_by: user(ROHAN),
      paid_by: ROHAN.id,
      paid_by_detail: { ...user(ROHAN), created_at: ROHAN.created_at },
      created_at: '2026-03-05T11:30:00Z',
      items: [
        {
          id: 'i5',
          name: 'Saree Dry Clean',
          amount: '450.00',
          split_mode: 'shares',
          assignments: [assignment('a11', ROHAN, 1), assignment('a12', PRIYA, 1)],
        },
      ],
    },
  ],
  [TRIP]: [
    {
      id: 'b3',
      group: TRIP,
      title: 'Cottage',
      total_amount: '860.50',
      currency: 'INR',
      bill_type: 'compound',
      created_by: user(ROHAN),
      paid_by: ROHAN.id,
      paid_by_detail: { ...user(ROHAN), created_at: ROHAN.created_at },
      created_at: '2026-02-12T12:00:00Z',
      items: [
        {
          id: 'i3',
          name: 'Stay',
          amount: '700.00',
          split_mode: 'shares',
          assignments: [assignment('a7', ME, 1), assignment('a8', ROHAN, 1)],
        },
        {
          id: 'i4',
          name: 'Fuel',
          amount: '160.50',
          split_mode: 'shares',
          assignments: [assignment('a9', ME, 1), assignment('a10', ROHAN, 1)],
        },
      ],
    },
  ],
  [SOLO]: [],
};

export const SETTLEMENTS = {
  [FLAT]: [
    {
      id: 's1',
      group: FLAT,
      payer: PRIYA.id,
      payee: ME.id,
      amount: '180.00',
      settled_at: '2026-02-02T18:30:00Z',
    },
  ],
  // Deliberately empty, so the Settlements tab's empty state is reachable.
  [TRIP]: [],
  [SOLO]: [],
};

export const FRIENDS = [
  {
    user_id: ROHAN.id,
    name: ROHAN.name,
    email: ROHAN.email,
    // Two shared groups but only one has a balance, which is the case the
    // mockup got wrong: it reported "1 group in common" here.
    shared_groups: [
      { id: TRIP, name: 'Coorg Trip' },
      { id: FLAT, name: 'Flat 302, Indiranagar' },
    ],
    shared_group_count: 2,
    total: '60.00',
    per_group: [{ group_id: TRIP, group_name: 'Coorg Trip', net: '60.00' }],
  },
  {
    user_id: PRIYA.id,
    name: PRIYA.name,
    email: PRIYA.email,
    shared_groups: [{ id: FLAT, name: 'Flat 302, Indiranagar' }],
    shared_group_count: 1,
    total: '180.00',
    per_group: [{ group_id: FLAT, group_name: 'Flat 302, Indiranagar', net: '180.00' }],
  },
  {
    // Square: shows 0.00 and no per-group rows, but still counts as a friend.
    user_id: DEV.id,
    name: DEV.name,
    email: DEV.email,
    shared_groups: [{ id: SOLO, name: 'Weekend Trip' }],
    shared_group_count: 1,
    total: '0.00',
    per_group: [],
  },
];

export const EMPTY_FRIENDS = [];
