import { createSlice } from '@reduxjs/toolkit';

const loadUser = () => {
    try {
        const raw = localStorage.getItem('user');
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
};

const authSlice = createSlice({
    name: 'auth',
    initialState: {
        user: loadUser(),
        token: localStorage.getItem('token'),
        refreshToken: localStorage.getItem('refresh_token'),
    },
    reducers: {
        setCredentials: (state, action) => {
            const { user, token, access, refresh } = action.payload;
            state.user = user;
            state.token = token || access;
            state.refreshToken = refresh || null;
            // Each key is written or removed, never left stale. Previously
            // clearing the token in state left the old value in localStorage,
            // which then came back on reload.
            if (state.token) {
                localStorage.setItem('token', state.token);
            } else {
                localStorage.removeItem('token');
            }
            if (refresh) {
                localStorage.setItem('refresh_token', refresh);
            } else {
                localStorage.removeItem('refresh_token');
            }
            if (user) {
                localStorage.setItem('user', JSON.stringify(user));
            } else {
                localStorage.removeItem('user');
            }
        },
        logout: (state) => {
            state.user = null;
            state.token = null;
            state.refreshToken = null;
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            localStorage.removeItem('refresh_token');
        },
    },
});

export const { setCredentials, logout } = authSlice.actions;
export default authSlice.reducer;
