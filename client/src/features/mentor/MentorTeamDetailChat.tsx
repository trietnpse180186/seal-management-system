import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import axios from 'axios';
import { Send, MessageCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface Message {
  _id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  content: string;
  createdAt: string;
  isRecalled?: boolean;
}

interface ChatRoom {
  _id: string;
  teamId?: any;
  type: string;
  members: any[];
}

interface Props {
  team: any;
  token: string | null;
}

export default function MentorTeamDetailChat({ team, token }: Props) {
  const [room, setRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState<Socket | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);

  // 1. Fetch or create chat room and load messages
  useEffect(() => {
    if (!team?._id || !token) return;

    const initChat = async () => {
      setLoading(true);
      try {
        // Ensure chat room exists for this team
        const roomRes = await axios.post(
          'http://localhost:5000/api/chat/rooms/team',
          { teamId: team._id },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const activeRoom = roomRes.data;
        setRoom(activeRoom);

        // Fetch messages history
        const msgRes = await axios.get(
          `http://localhost:5000/api/chat/rooms/${activeRoom._id}/messages?limit=50`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setMessages(msgRes.data.messages || []);
      } catch (err: any) {
        console.error('Failed to initialize team chat:', err);
        toast.error(err.response?.data?.message || 'Không thể tải lịch sử trò chuyện.');
      } finally {
        setLoading(false);
      }
    };

    initChat();
  }, [team?._id, token]);

  // 2. Setup socket connection once room is loaded
  useEffect(() => {
    if (!room || !token) return;

    const socketUrl = import.meta.env.VITE_API_URL || (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' ? window.location.origin : 'http://localhost:5000');
    const newSocket = io(socketUrl, {
      query: { token }
    });

    setSocket(newSocket);

    newSocket.on('connect', () => {
      setIsConnected(true);
      newSocket.emit('join_room', room._id);
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
    });

    newSocket.on('new_message', (message: Message) => {
      if (message.roomId === room._id) {
        setMessages(prev => {
          if (prev.find(m => m._id === message._id)) return prev;
          return [...prev, message];
        });
      }
    });

    newSocket.on('message_recalled', (data: { messageId: string; roomId: string; content: string }) => {
      if (data.roomId === room._id) {
        setMessages(prev => prev.map(m =>
          m._id === data.messageId ? { ...m, isRecalled: true, content: data.content } : m
        ));
      }
    });

    return () => {
      newSocket.disconnect();
    };
  }, [room, token]);

  // 3. Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !room || !socket || !isConnected) return;

    socket.emit('send_message', {
      roomId: room._id,
      content: newMessage.trim()
    });

    setNewMessage('');
  };

  if (loading) {
    return (
      <div className="py-12 text-center text-slate-400 font-mono text-xs animate-pulse">
        Đang kết nối phòng chat...
      </div>
    );
  }

  if (!room) {
    return (
      <div className="py-12 text-center text-rose-400 font-mono text-xs flex flex-col items-center gap-2">
        <AlertCircle size={24} />
        Không thể khởi tạo phòng chat với đội thi này.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[500px] bg-[#070b13] border border-slate-800/80 rounded-2xl overflow-hidden shadow-xl animate-fadeIn">
      {/* Sub-Header */}
      <div className="px-4 py-2.5 bg-[#0d1629] border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'} animate-pulse`}></span>
          <span className="text-[10px] font-bold font-mono text-slate-400 uppercase tracking-wider">
            {isConnected ? 'Kênh trực tuyến (Real-time)' : 'Mất kết nối'}
          </span>
        </div>
        <span className="text-[10px] text-cyan-400/85 font-black font-mono uppercase bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded">
          {team.name}
        </span>
      </div>

      {/* Messages Feed */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-3.5"
      >
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-650 space-y-2">
            <MessageCircle className="w-8 h-8 opacity-20" />
            <p className="text-xs font-mono">Bắt đầu trao đổi với đội thi tại đây!</p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const currentUserToken = token ? JSON.parse(atob(token.split('.')[1])) : null;
            const currentUserId = currentUserToken?._id || currentUserToken?.id;
            const isMe = currentUserId === msg.senderId;

            return (
              <div key={msg._id || index} className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[75%]`}>
                  <div className={`flex items-end gap-1.5 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                    {/* Initial Avatar */}
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                      isMe ? 'bg-cyan-605 text-white' : 'bg-slate-800 text-slate-350 border border-slate-700'
                    }`}>
                      {(msg.senderName || 'U').charAt(0).toUpperCase()}
                    </div>

                    {/* Bubble */}
                    <div className={`px-3 py-2 rounded-xl text-xs leading-relaxed ${
                      msg.isRecalled
                        ? 'border border-slate-800 bg-slate-900/30 text-slate-600 italic rounded-bl-sm'
                        : isMe
                          ? 'bg-gradient-to-tr from-cyan-600 to-blue-600 text-white rounded-br-sm shadow-md'
                          : 'bg-slate-800 text-slate-200 rounded-bl-sm border border-slate-700/60'
                    }`}>
                      {!isMe && !msg.isRecalled && (
                        <div className="text-[9px] font-bold text-cyan-400 mb-0.5 font-mono">{msg.senderName}</div>
                      )}
                      <div className="break-words whitespace-pre-wrap">{msg.content}</div>
                    </div>
                  </div>
                  <span className="text-[8px] text-slate-600 mt-1 font-mono">
                    {new Date(msg.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <form onSubmit={sendMessage} className="p-3 bg-[#0d1629] border-t border-slate-800 flex gap-2">
        <input
          type="text"
          value={newMessage}
          onChange={e => setNewMessage(e.target.value)}
          placeholder="Nhập tin nhắn trao đổi với đội thi..."
          disabled={!isConnected}
          className="flex-1 bg-[#060b13] border border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500/80 focus:ring-1 focus:ring-cyan-500/20 transition-all placeholder:text-slate-550"
        />
        <button
          type="submit"
          disabled={!newMessage.trim() || !isConnected}
          className="bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white px-4 py-2 rounded-xl transition-all flex items-center justify-center cursor-pointer shadow-md shadow-cyan-600/10 hover:shadow-cyan-600/20 animate-fadeIn"
        >
          <Send size={13} className="mr-1" />
          <span className="text-xs font-bold uppercase tracking-wider">Gửi</span>
        </button>
      </form>
    </div>
  );
}
