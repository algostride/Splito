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
