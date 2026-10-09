const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export interface UserSession {
  user: {
    id: string;
    email: string;
    role: 'donor' | 'patient' | 'hospital_staff' | 'admin';
    fullName: string;
    phone: string;
  };
  token: string;
  hospital?: any;
  donor?: any;
}

class ApiClient {
  private token: string | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('bloodlink_token');
    }
  }

  setToken(token: string | null) {
    this.token = token;
    if (typeof window !== 'undefined') {
      if (token) localStorage.setItem('bloodlink_token', token);
      else localStorage.removeItem('bloodlink_token');
    }
  }

  getToken() {
    return this.token;
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>)
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (err: any) {
      console.warn(`[API] Error on ${endpoint}:`, err.message);
      throw err;
    }
  }

  // Auth
  async login(email: string, password?: string) {
    const res = await this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password: password || 'BloodLink2026!' })
    });
    this.setToken(res.token);
    return res;
  }

  async getMe() {
    return this.request('/api/auth/me');
  }

  async getDemoAccounts() {
    return this.request('/api/auth/demo-accounts');
  }

  async switchDemo(userId: string) {
    const res = await this.request('/api/auth/switch-demo', {
      method: 'POST',
      body: JSON.stringify({ userId })
    });
    this.setToken(res.token);
    return res;
  }

  // Inventory
  async getInventory(filters?: { hospitalId?: string; bloodGroup?: string; component?: string; status?: string }) {
    const params = new URLSearchParams();
    if (filters?.hospitalId) params.append('hospitalId', filters.hospitalId);
    if (filters?.bloodGroup) params.append('bloodGroup', filters.bloodGroup);
    if (filters?.component) params.append('component', filters.component);
    if (filters?.status) params.append('status', filters.status);
    return this.request(`/api/inventory?${params.toString()}`);
  }

  async adjustInventory(params: {
    inventoryId: string;
    action: string;
    units: number;
    reason: string;
    referenceRequestId?: string;
  }) {
    return this.request('/api/inventory/adjust', {
      method: 'POST',
      body: JSON.stringify(params)
    });
  }

  async addInventoryBatch(batch: any) {
    return this.request('/api/inventory', {
      method: 'POST',
      body: JSON.stringify(batch)
    });
  }

  async getInventoryMovements() {
    return this.request('/api/inventory/movements');
  }

  // Requests
  async getRequests(filters?: { status?: string; hospitalId?: string; urgency?: string }) {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.hospitalId) params.append('hospitalId', filters.hospitalId);
    if (filters?.urgency) params.append('urgency', filters.urgency);
    return this.request(`/api/requests?${params.toString()}`);
  }

  async getRequestById(id: string) {
    return this.request(`/api/requests/${id}`);
  }

  async createRequest(data: any) {
    return this.request('/api/requests', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async verifyRequest(id: string) {
    return this.request(`/api/requests/${id}/verify`, { method: 'POST' });
  }

  async reserveRequest(id: string, inventoryId: string, units: number) {
    return this.request(`/api/requests/${id}/reserve`, {
      method: 'POST',
      body: JSON.stringify({ inventoryId, units })
    });
  }

  async triggerDonorOutreach(id: string) {
    return this.request(`/api/requests/${id}/donor-outreach`, { method: 'POST' });
  }

  async fulfillRequest(id: string) {
    return this.request(`/api/requests/${id}/fulfill`, { method: 'POST' });
  }

  async cancelRequest(id: string) {
    return this.request(`/api/requests/${id}/cancel`, { method: 'POST' });
  }

  // Donors
  async getDonorProfile() {
    return this.request('/api/donors/profile');
  }

  async updateDonorPreferences(data: any) {
    return this.request('/api/donors/availability', {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  }

  async getDonorMatchingRequests() {
    return this.request('/api/donors/matching-requests');
  }

  async respondToDonorMatch(matchId: string, response: 'accepted' | 'declined', notes?: string) {
    return this.request('/api/donors/respond', {
      method: 'POST',
      body: JSON.stringify({ matchId, response, notes })
    });
  }

  async getDonorHistory() {
    return this.request('/api/donors/history');
  }

  // Facilities & Hospitals
  async getHospitals() {
    return this.request('/api/hospitals');
  }

  async verifyHospital(id: string) {
    return this.request(`/api/hospitals/${id}/verify`, { method: 'POST' });
  }

  // Notifications & Audit
  async getNotifications() {
    return this.request('/api/notifications');
  }

  async sendTestNotification(phone: string, message: string) {
    return this.request('/api/notifications/test', {
      method: 'POST',
      body: JSON.stringify({ phone, message })
    });
  }

  async getAuditLogs() {
    return this.request('/api/audit-logs');
  }

  async getAnalyticsSummary() {
    return this.request('/api/analytics/summary');
  }
}

export const api = new ApiClient();
