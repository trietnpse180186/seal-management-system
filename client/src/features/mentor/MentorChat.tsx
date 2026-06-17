import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import axios from 'axios';
import { Send, Users, User, Clock, CheckCircle, Trash2, Quote, Forward, MoreHorizontal, X } from 'lucide-react';
import { toast } from 'sonner';

interface MentorChatProps {
  teamId: string;
}

interface Message {
  _id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  content: string;
  createdAt: string;
  isRecalled?: boolean;
  replyTo?: {
    messageId: string;
    senderName: string;
    content: string;
  };
}

interface ChatMember {
  id: string;
  _id?: string;
  fullName: string;
  role?: string;
  avatar?: string;
}

interface ChatRoom {
  _id: string;
  teamId: { _id: string; name: string };
  mentorId: { _id: string; fullName: string; email: string };
  eventId: string;
  members: ChatMember[];
}

export default function MentorChat({ teamId }: MentorChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [roomId, setRoomId] = useState<string | null>(null);
  const [activeRoom, setActiveRoom] = useState<ChatRoom | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isConnected, setIsConnected] = useState(false);
  
  // Pagination
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  
  // Zalo reply & menu actions
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (window as any).activeChatRoomId = roomId;
    return () => {
      (window as any).activeChatRoomId = null;
    };
  }, [roomId]);

  const playNotificationSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const playTone = (freq: number, start: number, duration: number) => {
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);
        gainNode.gain.setValueAtTime(0.08, start);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, start + duration);
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        osc.start(start);
        osc.stop(start + duration);
      };
      const now = audioCtx.currentTime;
      playTone(783.99, now, 0.12);
      playTone(1046.50, now + 0.08, 0.20);
    } catch (error) {
      console.warn("AudioContext failed to play sound:", error);
    }
  };

  const showDesktopNotification = (msg: Message) => {
    if ("Notification" in window && Notification.permission === "granted" && document.hidden) {
      try {
        new Notification(`Tin nhắn mới từ ${msg.senderName}`, {
          body: msg.content,
          icon: "/favicon.ico"
        });
      } catch (err) {
        console.warn("Failed to create desktop notification:", err);
      }
    }
  };

  useEffect(() => {
    // Request desktop notification permission
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    // Add click away listener for Zalo dropdowns
    const handleOutsideClick = () => {
      setActiveMenuId(null);
    };
    window.addEventListener('click', handleOutsideClick);

    // 1. Fetch currentUser profile
    const fetchUser = async () => {
      try {
        const token = localStorage.getItem('token');
        if (token) {
          const res = await axios.get('http://localhost:5000/api/auth/me', {
            headers: { Authorization: `Bearer ${token}` }
          });
          setCurrentUser(res.data.user);
        }
      } catch (err) {
        console.error("Error fetching user profile in chat:", err);
      }
    };
    fetchUser();

    // 2. Setup socket connection
    const token = localStorage.getItem('token');
    const newSocket = io('http://localhost:5000', {
      query: { token }
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
      window.removeEventListener('click', handleOutsideClick);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const fetchRoomsAndMessages = async () => {
      try {
        const token = localStorage.getItem('token');
        const resRooms = await axios.get(`http://localhost:5000/api/chat/rooms`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        const room = resRooms.data.find((r: ChatRoom) => r.teamId && r.teamId._id === teamId);
        
        if (room && isMounted) {
          setRoomId(room._id);
          setActiveRoom(room);
          
          setLoadingMessages(true);
          const resMsgs = await axios.get(`http://localhost:5000/api/chat/rooms/${room._id}/messages?page=1&limit=50`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (isMounted) {
            setMessages(resMsgs.data);
            setHasMore(resMsgs.data.length === 50);
            setLoadingMessages(false);
            setTimeout(() => {
              messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
            }, 100);
          }
          
          if (socket) {
            socket.emit('join_room', room._id);
          }
        }
      } catch (error) {
        console.error("Error fetching chat data:", error);
        if (isMounted) setLoadingMessages(false);
      }
    };

    if (socket && teamId) {
      fetchRoomsAndMessages();
    }
    
    return () => {
      isMounted = false;
    };
  }, [socket, teamId]);

  useEffect(() => {
    if (socket) {
      socket.on('connect', () => setIsConnected(true));
      socket.on('disconnect', () => setIsConnected(false));
      socket.on('error', (err: any) => console.error("Socket error:", err));

      socket.on('new_message', (message: Message) => {
        setMessages(prev => {
          if (prev.find(m => m._id === message._id)) return prev;
          return [...prev, message];
        });

        // Plays sound and shows desktop notification if message is from another user
        const isMsgFromMe = currentUser && (
          currentUser.userId === message.senderId ||
          currentUser._id === message.senderId ||
          currentUser.id === message.senderId
        );
        if (!isMsgFromMe) {
          playNotificationSound();
          showDesktopNotification(message);
        }

        // Scroll to bottom on new message
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      });

      socket.on('message_recalled', (data: { messageId: string; roomId: string; content: string }) => {
        setMessages(prev => prev.map(m => 
          m._id === data.messageId ? { ...m, isRecalled: true, content: data.content } : m
        ));
      });
    }
    return () => {
      if (socket) {
        socket.off('connect');
        socket.off('disconnect');
        socket.off('error');
        socket.off('new_message');
        socket.off('message_recalled');
      }
    };
  }, [socket, currentUser]);

  const loadMoreMessages = async () => {
    if (!roomId || !hasMore || loadingMessages) return;
    try {
      setLoadingMessages(true);
      const token = localStorage.getItem('token');
      const nextPage = page + 1;
      const resMsgs = await axios.get(`http://localhost:5000/api/chat/rooms/${roomId}/messages?page=${nextPage}&limit=50`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const prevScrollHeight = messagesContainerRef.current?.scrollHeight || 0;
      
      setMessages(prev => [...resMsgs.data, ...prev]);
      setHasMore(resMsgs.data.length === 50);
      setPage(nextPage);
      
      // Adjust scroll position after prepending items
      setTimeout(() => {
        if (messagesContainerRef.current) {
          const newScrollHeight = messagesContainerRef.current.scrollHeight;
          messagesContainerRef.current.scrollTop = newScrollHeight - prevScrollHeight;
        }
      }, 0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleScroll = () => {
    if (messagesContainerRef.current) {
      const { scrollTop } = messagesContainerRef.current;
      if (scrollTop === 0) {
        loadMoreMessages();
      }
    }
  };

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content);
    toast.success("Đã sao chép tin nhắn vào bộ nhớ tạm");
  };

  const handleDeleteLocally = (messageId: string) => {
    setMessages(prev => prev.filter(m => m._id !== messageId));
    toast.success("Đã xóa tin nhắn phía bạn");
  };

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !roomId || !socket) return;

    socket.emit('send_message', {
      roomId,
      content: newMessage.trim(),
      replyTo: replyingTo ? {
        messageId: replyingTo._id,
        senderName: replyingTo.senderName,
        content: replyingTo.content
      } : undefined
    });

    setNewMessage('');
    setReplyingTo(null);
  };

  const recallMessage = (messageId: string) => {
    if (!socket || !roomId) return;
    if (window.confirm("Bạn có chắc chắn muốn thu hồi tin nhắn này?")) {
      socket.emit('recall_message', { messageId, roomId });
    }
  };

  return (
    <div className="flex flex-col h-[600px] bg-[#0a141d]/80 rounded-xl border border-blue-500/30 overflow-hidden shadow-[0_0_15px_rgba(59,130,246,0.15)] backdrop-blur-md">
      {/* Header */}
      <div className="px-6 py-4 border-b border-blue-500/30 bg-[#0a141d] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/20 rounded-lg">
            <Users className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-200">Phòng Chat Nhóm</h3>
            <p className="text-xs text-blue-400/80 font-mono">
              {activeRoom ? `${activeRoom.members.length} thành viên trong nhóm` : '0 thành viên trong nhóm'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`flex h-2 w-2 rounded-full ${isConnected ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]' : 'bg-red-500'} animate-pulse`}></span>
          <span className={`text-xs font-mono ${isConnected ? 'text-green-400' : 'text-red-400'}`}>
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>

      {/* Messages Area */}
      <div 
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-6 space-y-4"
      >
        {loadingMessages && page > 1 && (
          <div className="text-center text-xs text-blue-400/70 py-2">Đang tải tin nhắn cũ...</div>
        )}
        
        {messages.length === 0 && !loadingMessages ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-3">
            <div className="w-16 h-16 rounded-full bg-slate-800/50 flex items-center justify-center border border-slate-700/50">
              <User className="w-8 h-8 text-slate-600" />
            </div>
            <p className="text-sm">Chưa có tin nhắn nào. Bắt đầu trò chuyện!</p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isMe = currentUser?.userId === msg.senderId || currentUser?._id === msg.senderId || currentUser?.id === msg.senderId;
            const isRecalled = msg.isRecalled;
            return (
              <div key={msg._id || index} className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[85%]`}>
                  <div className={`flex items-end gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                    {/* Avatar */}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${isMe ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300'}`}>
                      {(msg?.senderName || "U").charAt(0).toUpperCase()}
                    </div>
                    
                    {/* Message Bubble & Hover Bar Container */}
                    <div className="relative group/bubble flex items-center">
                      <div className={`px-4 py-2 rounded-2xl max-w-md ${
                        isRecalled
                          ? isMe
                            ? 'border border-blue-500/20 bg-blue-950/20 text-slate-500/80 italic rounded-br-sm'
                            : 'border border-slate-800 bg-slate-900/40 text-slate-500/80 italic rounded-bl-sm'
                          : isMe
                            ? 'bg-blue-600 text-white rounded-br-sm shadow-[0_0_10px_rgba(37,99,235,0.3)]'
                            : 'bg-gray-700 text-gray-200 rounded-bl-sm border border-slate-700'
                      }`}>
                        {/* Nested Replying To Block */}
                        {msg.replyTo && !isRecalled && (
                          <div className="mb-2 px-2.5 py-1.5 rounded bg-black/30 border-l-2 border-blue-400 text-[11px] text-slate-300 max-w-full text-left">
                            <div className="font-bold text-[10px] text-blue-400 mb-0.5">@{msg.replyTo.senderName}</div>
                            <div className="truncate text-slate-400 max-h-8 font-mono">{msg.replyTo.content}</div>
                          </div>
                        )}
                        {!isMe && <div className="text-[10px] font-bold text-blue-400 mb-1">{msg.senderName}</div>}
                        <div className="text-sm break-words whitespace-pre-wrap">{msg.content}</div>
                      </div>

                      {/* Zalo Style Hover Bar Container (Bridging the hover gap) */}
                      {!isRecalled && (
                        <div 
                          className={`opacity-0 pointer-events-none group-hover/bubble:opacity-100 group-hover/bubble:pointer-events-auto transition-all duration-150 absolute ${
                            isMe ? 'right-full pr-3' : 'left-full pl-3'
                          } top-1/2 -translate-y-1/2 flex items-center z-10`}
                        >
                          <div className="flex items-center gap-1.5 bg-[#122130] border border-blue-500/30 px-2 py-1.5 rounded-full shadow-[0_4px_15px_rgba(0,0,0,0.4)]">
                            {/* Button 1: Quote (Reply) */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setReplyingTo(msg);
                              }}
                              className="w-7 h-7 rounded-full flex items-center justify-center bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-all shadow-sm cursor-pointer"
                              title="Trả lời"
                            >
                              <Quote className="w-3 h-3 text-slate-600 fill-slate-650" />
                            </button>

                            {/* Button 2: Share / Copy */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopy(msg.content);
                              }}
                              className="w-7 h-7 rounded-full flex items-center justify-center bg-white border border-slate-200 text-slate-750 hover:bg-slate-100 hover:text-slate-900 transition-all shadow-sm cursor-pointer"
                              title="Sao chép"
                            >
                              <Forward className="w-3.5 h-3.5 text-slate-600" />
                            </button>

                            {/* Button 3: More actions */}
                            <div className="relative">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveMenuId(activeMenuId === msg._id ? null : msg._id);
                                }}
                                className="w-7 h-7 rounded-full flex items-center justify-center bg-white border border-slate-200 text-blue-600 hover:bg-slate-100 hover:text-blue-700 transition-all shadow-sm cursor-pointer"
                                title="Thêm"
                              >
                                <MoreHorizontal className="w-3.5 h-3.5 text-blue-600" />
                              </button>

                              {/* Dropdown Menu */}
                              {activeMenuId === msg._id && (
                                <div 
                                  onClick={(e) => e.stopPropagation()}
                                  className={`absolute ${
                                    isMe ? 'right-0' : 'left-0'
                                  } top-full mt-2 bg-slate-950 border border-slate-800 rounded-xl shadow-[0_10px_25px_rgba(0,0,0,0.5)] py-1.5 z-20 w-36 overflow-hidden`}
                                >
                                  <button
                                    onClick={() => {
                                      handleCopy(msg.content);
                                      setActiveMenuId(null);
                                    }}
                                    className="w-full text-left px-3.5 py-2 hover:bg-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer text-xs"
                                  >
                                    Sao chép
                                  </button>
                                  {isMe && (
                                    <button
                                      onClick={() => {
                                        recallMessage(msg._id);
                                        setActiveMenuId(null);
                                      }}
                                      className="w-full text-left px-3.5 py-2 hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors cursor-pointer text-xs font-semibold"
                                    >
                                      Thu hồi (Xóa cả 2 bên)
                                    </button>
                                  )}
                                  <button
                                    onClick={() => {
                                      handleDeleteLocally(msg._id);
                                      setActiveMenuId(null);
                                    }}
                                    className="w-full text-left px-3.5 py-2 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer text-xs"
                                  >
                                    Xóa ở phía tôi
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Time */}
                  <div className={`text-[10px] text-slate-500 mt-1 ${isMe ? 'pr-10' : 'pl-10'}`}>
                    {new Date(msg.createdAt).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-[#0a141d] border-t border-blue-500/30">
        {roomId ? (
          <div className="flex flex-col">
            {/* Replying Banner */}
            {replyingTo && (
              <div className="px-4 py-2 bg-slate-900 border-l-4 border-blue-500 flex items-center justify-between text-xs text-slate-350 gap-2 mb-2 rounded-t-lg">
                <div className="truncate flex-1">
                  <span className="text-blue-400 font-bold font-mono">ĐANG TRẢ LỜI @{replyingTo.senderName}:</span>{" "}
                  <span className="italic text-slate-400">{replyingTo.content}</span>
                </div>
                <button 
                  type="button" 
                  onClick={() => setReplyingTo(null)}
                  className="text-slate-500 hover:text-slate-300 cursor-pointer p-0.5 hover:bg-slate-800 rounded transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            
            <form onSubmit={sendMessage} className="flex gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Nhập tin nhắn..."
                className="flex-1 bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-all placeholder:text-slate-600"
              />
              <button
                type="submit"
                disabled={!newMessage.trim() || !isConnected}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600 text-white px-5 py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        ) : (
          <div className="text-center text-sm text-amber-500/80 p-2 border border-amber-500/20 bg-amber-500/5 rounded-lg">
            Phòng chat chưa được khởi tạo. Vui lòng liên hệ Admin.
          </div>
        )}
      </div>
    </div>
  );
}
