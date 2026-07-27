import { configureStore } from '@reduxjs/toolkit';
import { api } from './api';
import authReducer, { logout } from './authSlice';
import toastReducer from './toastSlice';

export const store = configureStore({
    reducer: {
        auth: authReducer,
        toast: toastReducer,
        [api.reducerPath]: api.reducer,
    },
    middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware().concat(api.middleware),
});

export const logoutAndReset = () => (dispatch) => {
    dispatch(api.util.resetApiState());
    dispatch(logout());
};
