import { api } from './api';

export const settlementsApi = api.injectEndpoints({
    endpoints: (builder) => ({
        getBalances: builder.query({
            query: (groupId) => `settlements/balances/?group=${groupId}`,
            providesTags: ['Settlement'],
        }),
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
        }),
    }),
});

export const {
    useGetBalancesQuery,
    useGetUserDebtsQuery,
    useGetSettlementsQuery,
    useCreateSettlementMutation,
    useDeleteSettlementMutation,
} = settlementsApi;
