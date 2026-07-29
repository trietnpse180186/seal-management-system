import { io, Socket } from 'socket.io-client';
import { API_BASE_URL } from './api.config';

let socket: Socket | null = null;

export const getSocket = (): Socket => {
  if (!socket) {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    socket = io(API_BASE_URL, {
      auth: { token },
      autoConnect: true,
      transports: ['websocket', 'polling'],
    });
  }
  return socket;
};

export const disconnectSocket = (): void => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
