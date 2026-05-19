/**
 * DYD-Cloths API Service
 * Handles all backend communications with token management and error handling.
 */

const API_BASE_URL = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')
    ? 'http://localhost:5000/api'
    : `${window.location.origin}/api`;

const API = {
    /**
     * Base fetch wrapper
     */
    request: async (endpoint, options = {}) => {
        const url = `${API_BASE_URL}${endpoint}`;
        
        // Add auth header if token exists
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
                ...options,
                headers
            });

            const data = await response.json();

            if (!response.ok) {
                // Handle unauthorized (expired token)
                if (response.status === 401) {
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    if (!window.location.pathname.includes('login.html') && 
                        !window.location.pathname.includes('register.html')) {
                        window.location.href = 'login.html';
                    }
                }
                throw new Error(data.message || data.error || 'Something went wrong');
            }

            return data;
        } catch (error) {
            console.error(`API Error [${endpoint}]:`, error);
            throw error;
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

    delete: (endpoint) => API.request(endpoint, { method: 'DELETE' }),

    /**
     * File upload wrapper
     */
    upload: async (endpoint, formData) => {
        const token = localStorage.getItem('token');
        const headers = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        try {
            const response = await fetch(`${API_BASE_URL}${endpoint}`, {
                method: 'POST',
                headers,
                body: formData
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.message || data.error || 'Upload failed');
            return data;
        } catch (error) {
            console.error(`Upload Error [${endpoint}]:`, error);
            throw error;
        }
    },

    /**
     * PUT with file upload
     */
    uploadPut: async (endpoint, formData) => {
        const token = localStorage.getItem('token');
        const headers = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        try {
            const response = await fetch(`${API_BASE_URL}${endpoint}`, {
                method: 'PUT',
                headers,
                body: formData
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.message || data.error || 'Upload failed');
            return data;
        } catch (error) {
            console.error(`Upload Error [${endpoint}]:`, error);
            throw error;
        }
    }
};

// Export to window
window.API = API;
window.API_BASE_URL = API_BASE_URL;
