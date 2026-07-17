import { io } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getBaseUrl } from './api';

class SocketService {
  constructor() {
    this.socket = null;
    this.listeners = new Map();
  }

  async connect() {
    if (this.socket?.connected) return this.socket;

    const token = await AsyncStorage.getItem('token');
    if (!token) return null;

    // Lấy URL từ api.js, bỏ phần /api ở cuối nếu có
    const baseUrl = getBaseUrl().replace(/\/api$/, '');

    this.socket = io(baseUrl, {
      auth: { token },
      transports: ['websocket'], // Đảm bảo dùng websocket cho React Native
    });

    this.socket.on('connect', () => {
      console.log('Socket connected to:', baseUrl);
    });

    this.socket.on('disconnect', () => {
      console.log('Socket disconnected');
    });

    this.socket.on('error', (error) => {
      console.error('Socket error:', error);
    });

    // Re-attach all existing listeners if any (e.g. after reconnection)
    this.listeners.forEach((callback, event) => {
      this.socket.on(event, callback);
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  emit(event, data) {
    if (this.socket) {
      this.socket.emit(event, data);
    }
  }

  on(event, callback) {
    this.listeners.set(event, callback);
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  off(event) {
    this.listeners.delete(event);
    if (this.socket) {
      this.socket.off(event);
    }
  }

  getSocket() {
    return this.socket;
  }
}

const socketService = new SocketService();
export default socketService;
