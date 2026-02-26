import axios from 'axios';
import { store } from '../store';
import { logout, setCredentials } from '../store/authSlice';

const axiosInstance = axios.create({
    baseURL: 'http://localhost:8000/api/v1',
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
                const refresh_token = localStorage.getItem('refresh_token');
                if (!refresh_token) throw new Error('No refresh token');

                const response = await axios.post('http://localhost:8000/api/v1/accounts/refresh/', { refresh: refresh_token });
                const { access } = response.data;

                // update store and local storage
                store.dispatch(setCredentials({ user: store.getState().auth.user, token: access }));
                localStorage.setItem('refresh_token', refresh_token);
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
