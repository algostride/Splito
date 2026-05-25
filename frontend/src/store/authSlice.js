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
            if (state.token) {
                localStorage.setItem('token', state.token);
            }
            if (refresh) {
                localStorage.setItem('refresh_token', refresh);
            }
            if (user) {
                localStorage.setItem('user', JSON.stringify(user));
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
