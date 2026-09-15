// src/config/api.js - API client service
// Vite proxies this path during development and Express serves it in production.
// An explicit VITE_API_BASE_URL remains available for a separately hosted API.
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');

const parseResponseBody = async (response) => {
    const text = await response.text();

    if (!text) return null;

    try {
        return JSON.parse(text);
    } catch {
        // Proxies and hosting providers sometimes return an HTML/plain-text
        // error page. Preserve it for an error message instead of throwing a
        // misleading JSON parsing exception.
        return text;
    }
};

const getErrorMessage = (response, data) => {
    const status = `HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ''}`;
    const payloadMessage = typeof data === 'string'
        ? data.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
        : data?.message ||
          (data?.error && typeof data.error === 'object' ? data.error.message : data?.error);

    if (payloadMessage) {
        return `${status}: ${String(payloadMessage).slice(0, 300)}`;
    }

    if (response.status >= 500) {
        return `${status}: The API server is unavailable or returned an empty response.`;
    }

    return status;
};

const createHttpError = (response, data) => {
    const error = new Error(getErrorMessage(response, data));
    error.name = 'ApiError';
    error.status = response.status;
    error.data = data;
    return error;
};

const createNetworkError = (error, url) => {
    if (error?.name === 'ApiError') return error;

    const networkError = new Error(
        `Network error while reaching ${url}. Check that the backend API is running and reachable.`
    );
    networkError.name = 'NetworkError';
    networkError.cause = error;
    return networkError;
};

const handleUnauthorized = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    // Dispatch a custom event to notify App to redirect to login.
    window.dispatchEvent(new Event('auth-unauthorized'));
};

const API = {
    request: async (endpoint, options = {}) => {
        const url = `${API_BASE_URL}${endpoint}`;
        const token = localStorage.getItem('token');
        
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        try {
            const response = await fetch(url, {
                credentials: 'include',
                ...options,
                headers
            });

            const data = await parseResponseBody(response);

            if (!response.ok) {
                if (response.status === 401 && token && !['/auth/login', '/auth/google-login', '/auth/change-password'].includes(endpoint)) {
                    handleUnauthorized();
                }
                throw createHttpError(response, data);
            }

            return data;
        } catch (error) {
            const requestError = createNetworkError(error, url);
            console.error(`API Error [${endpoint}]:`, requestError);
            throw requestError;
        }
    },

    get: (endpoint) => API.request(endpoint, { method: 'GET' }),
    
    post: (endpoint, body) => API.request(endpoint, {
        method: 'POST',
        body: JSON.stringify(body)
    }),

    put: (endpoint, body) => API.request(endpoint, {
        method: 'PUT',
        body: JSON.stringify(body)
    }),

    patch: (endpoint, body) => API.request(endpoint, { method: 'PATCH', body: JSON.stringify(body) }),

    delete: (endpoint) => API.request(endpoint, { method: 'DELETE' }),

    upload: async (endpoint, formData, method = 'POST') => {
        const token = localStorage.getItem('token');
        const headers = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        try {
            const url = `${API_BASE_URL}${endpoint}`;
            const response = await fetch(url, {
                credentials: 'include',
                method,
                headers,
                body: formData
            });

            const data = await parseResponseBody(response);
            if (!response.ok) {
                if (response.status === 401) handleUnauthorized();
                throw createHttpError(response, data);
            }
            return data;
        } catch (error) {
            const uploadError = createNetworkError(error, `${API_BASE_URL}${endpoint}`);
            console.error(`Upload Error [${endpoint}]:`, uploadError);
            throw uploadError;
        }
    }
};

export default API;
