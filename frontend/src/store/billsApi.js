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
    }),
});

export const {
    useGetBillsQuery,
    useCreateBillMutation,
    useGetBillDetailQuery,
} = billsApi;
