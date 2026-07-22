import { api } from './api';

export const groupsApi = api.injectEndpoints({
    endpoints: (builder) => ({
        getGroups: builder.query({
            query: () => 'groups/',
            providesTags: ['Group'],
        }),
        createGroup: builder.mutation({
            query: (groupData) => ({
                url: 'groups/',
                method: 'POST',
                body: groupData,
            }),
            invalidatesTags: ['Group'],
        }),
        getGroupDetail: builder.query({
            query: (id) => `groups/${id}/`,
            providesTags: (result, error, id) => [{ type: 'Group', id }],
        }),
        getGroupMembers: builder.query({
            query: (id) => `groups/${id}/members/`,
            providesTags: (result, error, id) => [{ type: 'Member', id }],
        }),
        inviteMember: builder.mutation({
            query: ({ id, email }) => ({
                url: `groups/${id}/invite/`,
                method: 'POST',
                body: { email },
            }),
            invalidatesTags: ['Member'],
        }),
        acceptInvite: builder.mutation({
            query: (token) => ({
                url: `groups/accept-invite/${token}/`,
                method: 'POST',
            }),
            // Re-fetch groups and members after an invite is accepted
            invalidatesTags: ['Group', 'Member', 'Friend'],
        }),
    }),
});

export const {
    useGetGroupsQuery,
    useCreateGroupMutation,
    useGetGroupDetailQuery,
    useGetGroupMembersQuery,
    useInviteMemberMutation,
    useAcceptInviteMutation,
} = groupsApi;
