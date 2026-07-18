import { api } from './api';

export const settlementsApi = api.injectEndpoints({
    endpoints: (builder) => ({
        getUserDebts: builder.query({
            query: (groupId) => `settlements/debts/?group=${groupId}`,
            providesTags: ['Settlement'],
        }),
        getSettlements: builder.query({
            query: (groupId) => `settlements/?group=${groupId}`,
            providesTags: ['Settlement'],
        }),
        createSettlement: builder.mutation({
            query: (settlementData) => ({
                url: 'settlements/',
                method: 'POST',
                body: settlementData,
            }),
            invalidatesTags: ['Settlement'],
        }),
        deleteSettlement: builder.mutation({
            query: (id) => ({
                url: `settlements/${id}/`,
                method: 'DELETE',
            }),
            invalidatesTags: ['Settlement'],
            // Same reasoning as deleteBill: removing a row from a list needs no
            // server arithmetic, so the optimistic version cannot be wrong.
            // Settlements *created* are not optimistic, because that changes
            // the pairwise balance matrix.
            async onQueryStarted(id, { dispatch, queryFulfilled }) {
                // Same shape as deleteBill: the entry is the array itself.
                const patches = dispatch(
                    api.util.updateQueryData('getSettlements', (draft) =>
                        Array.isArray(draft) ? draft.filter((s) => s.id !== id) : draft,
                    ),
                );
                try {
                    await queryFulfilled;
                } catch {
                    dispatch(api.util.patchQueryData('getSettlements', patches));
                }
            },
        }),
    }),
});

export const {
    useGetUserDebtsQuery,
    useGetSettlementsQuery,
    useCreateSettlementMutation,
    useDeleteSettlementMutation,
} = settlementsApi;
