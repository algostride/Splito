import { api } from './api';

/**
 * Friends are derived from co-membership: anyone who shares a group with you.
 * There is nothing to add or revoke, so this is read-only.
 *
 * The tag is what keeps it honest. A friend's total is computed from the same
 * pairwise ledger as the group balances, so creating a bill, editing one,
 * deleting one, recording or removing a settlement, or accepting an invite all
 * change what belongs in this response. Without 'Friend' on those mutations the
 * page would show numbers that contradict the group pages.
 */
export const friendsApi = api.injectEndpoints({
    endpoints: (builder) => ({
        getFriends: builder.query({
            query: () => 'settlements/friends/',
            providesTags: ['Friend'],
        }),
    }),
    overrideExisting: false,
});

export const { useGetFriendsQuery } = friendsApi;
