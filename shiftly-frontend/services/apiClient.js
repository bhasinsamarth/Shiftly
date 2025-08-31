// shiftly-frontend/services/apiClient.js
import { supabase } from '../supabaseClient.js';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

class ApiClient {
  constructor() {
    this.baseURL = API_BASE_URL;
  }

  async getAuthToken() {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const token = await this.getAuthToken();

    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...options.headers,
      },
      ...options,
    };

    if (config.body && typeof config.body === 'object') {
      config.body = JSON.stringify(config.body);
    }

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      return data;
    } catch (error) {
      console.error(`API request failed: ${config.method || 'GET'} ${url}`, error);
      throw error;
    }
  }

  // HTTP methods
  async get(endpoint, params = {}) {
    const url = new URL(`${this.baseURL}${endpoint}`);
    Object.keys(params).forEach(key => {
      if (params[key] !== undefined && params[key] !== null) {
        url.searchParams.append(key, params[key]);
      }
    });

    return this.request(url.pathname + url.search, { method: 'GET' });
  }

  async post(endpoint, data = {}) {
    return this.request(endpoint, {
      method: 'POST',
      body: data,
    });
  }

  async put(endpoint, data = {}) {
    return this.request(endpoint, {
      method: 'PUT',
      body: data,
    });
  }

  async delete(endpoint) {
    return this.request(endpoint, {
      method: 'DELETE',
    });
  }
}

export const apiClient = new ApiClient();

// Service classes for different domains
export class AuthService {
  static async login(employeeId, password) {
    return apiClient.post('/auth/login', { employeeId, password });
  }

  static async getProfile() {
    return apiClient.get('/auth/profile');
  }

  static async logout() {
    return apiClient.post('/auth/logout');
  }

  static async forgotPassword(employeeId) {
    return apiClient.post('/auth/forgot-password', { employeeId });
  }
}

export class EmployeeService {
  static async getEmployees(params = {}) {
    return apiClient.get('/employees', params);
  }

  static async getEmployee(employeeId) {
    return apiClient.get(`/employees/${employeeId}`);
  }

  static async createEmployee(employeeData) {
    return apiClient.post('/employees', employeeData);
  }

  static async updateEmployee(employeeId, updates) {
    return apiClient.put(`/employees/${employeeId}`, updates);
  }

  static async deleteEmployee(employeeId) {
    return apiClient.delete(`/employees/${employeeId}`);
  }
}

export class DropdownService {
  static async getOptions(table, params = {}) {
    return apiClient.get(`/dropdown/${table}`, params);
  }

  static async getRoles() {
    return apiClient.get('/dropdown/roles/all');
  }

  static async getStores() {
    return apiClient.get('/dropdown/stores/all');
  }
}

export class ScheduleService {
  static async getSchedule(params = {}) {
    return apiClient.get('/schedule', params);
  }

  static async createScheduleEntries(entries) {
    return apiClient.post('/schedule', { entries });
  }

  static async updateScheduleEntry(scheduleId, updates) {
    return apiClient.put(`/schedule/${scheduleId}`, updates);
  }

  static async deleteScheduleEntry(scheduleId) {
    return apiClient.delete(`/schedule/${scheduleId}`);
  }

  static async getTimecard(params = {}) {
    return apiClient.get('/schedule/timecard', params);
  }
}

export class ChatService {
  static async getRooms(params = {}) {
    return apiClient.get('/chat/rooms', params);
  }

  static async createRoom(participants, name, type = 'group') {
    return apiClient.post('/chat/rooms', { participants, name, type });
  }

  static async getMessages(roomId, params = {}) {
    return apiClient.get(`/chat/rooms/${roomId}/messages`, params);
  }

  static async sendMessage(roomId, content) {
    return apiClient.post(`/chat/rooms/${roomId}/messages`, { content });
  }

  static async updateRoom(roomId, name) {
    return apiClient.put(`/chat/rooms/${roomId}`, { name });
  }

  static async leaveRoom(roomId) {
    return apiClient.delete(`/chat/rooms/${roomId}`);
  }
}

