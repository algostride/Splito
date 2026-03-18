import { api } from './api';

export const settlementsApi = api.injectEndpoints({
    endpoints: (builder) => ({
        getBalances: builder.query({
            query: (groupId) => `settlements/${groupId}/balances/`,
            providesTags: ['Settlement', 'Bill'],
        }),
        createSettlement: builder.mutation({
            query: (settlementData) => ({
                url: 'settlements/',
                method: 'POST',
                body: settlementData,
            }),
            invalidatesTags: ['Settlement'],
        }),
    }),
});

export const {
    useGetBalancesQuery,
    useCreateSettlementMutation,
} = settlementsApi;
