import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { logout, setCredentials } from './authSlice';

const baseQuery = fetchBaseQuery({
    baseUrl: import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1/',
    prepareHeaders: (headers, { getState }) => {
        const token = getState().auth.token;
        if (token) {
            headers.set('authorization', `Bearer ${token}`);
        }
        return headers;
    },
});

const baseQueryWithRefresh = async (args, api, extraOptions) => {
    let result = await baseQuery(args, api, extraOptions);

    if (result.error && result.error.status === 401) {
        const refreshToken = api.getState().auth.refreshToken;
        if (!refreshToken) {
            api.dispatch(logout());
            return result;
        }

        const refreshResult = await baseQuery(
            {
                url: 'accounts/token/refresh/',
                method: 'POST',
                body: { refresh: refreshToken },
            },
            api,
            extraOptions
        );

        if (refreshResult.data) {
            const { access, refresh } = refreshResult.data;
            api.dispatch(setCredentials({
                user: api.getState().auth.user,
                token: access,
                refresh: refresh || refreshToken,
            }));

            result = await baseQuery(args, api, extraOptions);
        } else {
            api.dispatch(logout());
        }
    }

    return result;
};

export const api = createApi({
    reducerPath: 'api',
    baseQuery: baseQueryWithRefresh,
    tagTypes: ['Group', 'Member', 'Bill', 'Settlement'],
    endpoints: () => ({}),
});
