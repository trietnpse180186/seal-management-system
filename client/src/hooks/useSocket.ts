import { useEffect, useState } from 'react';
import { Socket } from 'socket.io-client';
import { getSocket, disconnectSocket } from '../config/socket';
export { disconnectSocket };

export function useSocket(): Socket | null {
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    const s = getSocket();
    setSocket(s);

    return () => {
      // Optional cleanup on unmount if needed
    };
  }, []);

  return socket;
}
