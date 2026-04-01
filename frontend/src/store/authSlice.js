import { createSlice } from '@reduxjs/toolkit';

const authSlice = createSlice({
    name: 'auth',
    initialState: {
        user: null,
        token: localStorage.getItem('token'),
    },
    reducers: {
        setCredentials: (state, action) => {
            const { user, token, access } = action.payload;
            state.user = user;
            state.token = token || access;
            if (state.token) {
                localStorage.setItem('token', state.token);
            }
        },
        logout: (state) => {
            state.user = null;
            state.token = null;
            localStorage.removeItem('token');
        },
    },
});

export const { setCredentials, logout } = authSlice.actions;
export default authSlice.reducer;
