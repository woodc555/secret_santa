const API = {
    token: localStorage.getItem('token'),

    async request(path, options = {}) {
        const headers = {
            'Content-Type': 'application/json',
            ...(options.headers || {}),
        };

        if (this.token) {
            headers.Authorization = `Bearer ${this.token}`;
        }

        const response = await fetch(path, { ...options, headers });
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            const error = new Error(data.error || 'Request failed');
            error.status = response.status;
            throw error;
        }

        return data;
    },

    async login(pin) {
        const data = await this.request('/api/login', {
            method: 'POST',
            body: JSON.stringify({ pin }),
        });
        this.token = data.token;
        localStorage.setItem('token', data.token);
        return data.user;
    },

    logout() {
        this.token = null;
        localStorage.removeItem('token');
    },

    me() {
        return this.request('/api/me');
    },

    assignment() {
        return this.request('/api/assignment');
    },

    saveWishlist(wishlist) {
        return this.request('/api/wishlist', {
            method: 'PUT',
            body: JSON.stringify({ wishlist }),
        });
    },

    match() {
        return this.request('/api/match', { method: 'POST' });
    },

    adminParticipants() {
        return this.request('/api/admin/participants');
    },

    updateParticipant(id, payload) {
        return this.request(`/api/admin/participants/${id}`, {
            method: 'PUT',
            body: JSON.stringify(payload),
        });
    },

    resetPairings() {
        return this.request('/api/admin/reset-pairings', {
            method: 'POST',
        });
    },
};
