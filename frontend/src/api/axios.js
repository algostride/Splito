import axios from 'axios';
import { store } from '../store';
import { logout, setCredentials } from '../store/authSlice';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1/';

const axiosInstance = axios.create({
    baseURL: API_URL,
});

axiosInstance.interceptors.request.use((config) => {
    const token = store.getState().auth.token;
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

axiosInstance.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;
            try {
                const refresh_token = store.getState().auth.refreshToken;
                if (!refresh_token) throw new Error('No refresh token');

                const response = await axios.post(`${API_URL}accounts/token/refresh/`, { refresh: refresh_token });
                const { access, refresh } = response.data;

                store.dispatch(setCredentials({
                    user: store.getState().auth.user,
                    token: access,
                    refresh: refresh || refresh_token,
                }));
                originalRequest.headers.Authorization = `Bearer ${access}`;

                return axiosInstance(originalRequest);
            } catch (err) {
                store.dispatch(logout());
                return Promise.reject(err);
            }
        }
        return Promise.reject(error);
    }
);

export default axiosInstance;
