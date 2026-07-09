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

const AUTH_ENDPOINTS = ['login', 'register'];

const baseQueryWithRefresh = async (args, api, extraOptions) => {
    let result = await baseQuery(args, api, extraOptions);

    // A wrong password or a duplicate account 401s too. Trying to refresh on
    // those would rotate the refresh token, and if that refresh failed it
    // logged the user out of a session they never asked to end.
    const isAuthEndpoint = AUTH_ENDPOINTS.includes(extraOptions?.endpointName);
    if (result.error && result.error.status === 401 && !isAuthEndpoint) {
        const refreshToken = api.getState().auth.refreshToken;
        if (!refreshToken) {
            api.dispatch(api.util.resetApiState());
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
            // The cache still holds the previous user's groups, bills and
            // balances, and the next login reads the same cache keys. Clearing
            // it here is what stops one user seeing another's data.
            api.dispatch(api.util.resetApiState());
            api.dispatch(logout());
        }
    }

    return result;
};

export const api = createApi({
    reducerPath: 'api',
    baseQuery: baseQueryWithRefresh,
    tagTypes: ['Group', 'Member', 'Bill', 'Settlement', 'Friend'],
    endpoints: () => ({}),
});
