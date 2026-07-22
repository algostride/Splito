import { api } from './api';

export const billsApi = api.injectEndpoints({
    endpoints: (builder) => ({
        getBills: builder.query({
            query: (groupId) => `bills/?group=${groupId}`,
            providesTags: ['Bill'],
        }),
        createBill: builder.mutation({
            query: (billData) => ({
                url: 'bills/',
                method: 'POST',
                body: billData,
            }),
            invalidatesTags: ['Bill', 'Settlement'],
        }),
        getBillDetail: builder.query({
            query: (id) => `bills/${id}/`,
            providesTags: (result, error, id) => [{ type: 'Bill', id }],
        }),
        updateBill: builder.mutation({
            query: ({ id, ...billData }) => ({
                url: `bills/${id}/`,
                method: 'PUT',
                body: billData,
            }),
            invalidatesTags: (result, error, { id }) => [
                { type: 'Bill', id },
                'Bill',
                'Settlement',
            ],
        }),
        deleteBill: builder.mutation({
            query: (id) => ({
                url: `bills/${id}/`,
                method: 'DELETE',
            }),
            invalidatesTags: ['Bill', 'Settlement'],
            /* The row leaves the list immediately and comes back on failure.

               This is the one shape of optimism that is safe here. Removing a
               row needs no server arithmetic, so there is nothing to guess.

               `createBill` and `createSettlement` are deliberately NOT
               optimistic. A bill's per-member shares come from the backend's
               paise-conserving allocator, and a settlement changes a pairwise
               balance matrix; faking either client-side would render numbers
               that do not reconcile with the next refetch, which is worse than
               a brief wait. See pending.txt. */
            async onQueryStarted(id, { dispatch, queryFulfilled }) {
                /* The cache entry for getBills(groupId) *is* the array of bills
                   for that group -- RTK keys it by the endpoint and the argument,
                   not by an object of groups. Iterating entries looking for
                   nested arrays silently matched nothing, so the "optimistic"
                   removal did nothing at all. */
                const patches = dispatch(
                    api.util.updateQueryData('getBills', (draft) =>
                        Array.isArray(draft) ? draft.filter((b) => b.id !== id) : draft,
                    ),
                );
                try {
                    await queryFulfilled;
                } catch {
                    // Put it back. The error is surfaced by the caller.
                    dispatch(api.util.patchQueryData('getBills', patches));
                }
            },
        }),
    }),
});

export const {
    useGetBillsQuery,
    useCreateBillMutation,
    useGetBillDetailQuery,
    useUpdateBillMutation,
    useDeleteBillMutation,
} = billsApi;
