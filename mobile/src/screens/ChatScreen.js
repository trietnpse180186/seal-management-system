import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Send, Users, User, Megaphone, MessagesSquare, MessageCircle, X, Quote } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../api/api';
import socketService from '../api/socketService';

const ENDED_EVENT_STATUSES = ['completed', 'cancelled'];

export default function ChatScreen({ navigation, route }) {
  const [rooms, setRooms] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [replyingTo, setReplyingTo] = useState(null);

  const flatListRef = useRef(null);
  const currentUserRef = useRef(currentUser);
  const selectedRoomRef = useRef(selectedRoom);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  useEffect(() => {
    selectedRoomRef.current = selectedRoom;
  }, [selectedRoom]);

  const handleNewMessage = useCallback((message) => {
    const curRoom = selectedRoomRef.current;
    const msgRoomId = typeof message.roomId === 'object' ? message.roomId?._id : message.roomId;
    const curRoomId = curRoom?._id;

    if (curRoomId && msgRoomId === curRoomId) {
      setMessages((prev) => {
        // 1. Check exact _id match
        const exactIndex = prev.findIndex((m) => m._id === message._id);
        if (exactIndex !== -1) {
          const updated = [...prev];
          updated[exactIndex] = message;
          return updated;
        }

        // 2. Match temporary optimistic message (starts with 'temp_' and same content)
        const myUser = currentUserRef.current;
        const myUserId = myUser?.userId || myUser?._id || myUser?.id;
        const msgSenderId = typeof message.senderId === 'object' ? message.senderId?._id : message.senderId;

        const tempIndex = prev.findIndex(
          (m) =>
            m._id &&
            typeof m._id === 'string' &&
            m._id.startsWith('temp_') &&
            (m.content === message.content || m.content === message.content?.trim()) &&
            (!msgSenderId || !myUserId || msgSenderId === myUserId || m.senderId === msgSenderId || m.senderId === myUserId)
        );

        if (tempIndex !== -1) {
          const updated = [...prev];
          updated[tempIndex] = message;
          return updated;
        }

        return [...prev, message];
      });

      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 50);
    } else {
      if (msgRoomId) {
        setUnreadCounts((prev) => ({
          ...prev,
          [msgRoomId]: (prev[msgRoomId] || 0) + 1,
        }));
      }
    }
  }, []);

  const handleMessageRecalled = useCallback((data) => {
    setMessages((prev) =>
      prev.map((m) => (m._id === data.messageId ? { ...m, isRecalled: true, content: data.content } : m))
    );
  }, []);

  useEffect(() => {
    const init = async () => {
      const userStr = await AsyncStorage.getItem('user');
      if (userStr) {
        setCurrentUser(JSON.parse(userStr));
      }
      await fetchRooms();
      await socketService.connect();
    };

    init();

    // Socket listeners
    socketService.on('new_message', handleNewMessage);
    socketService.on('message_recalled', handleMessageRecalled);

    return () => {
      socketService.off('new_message');
      socketService.off('message_recalled');
    };
  }, [handleNewMessage, handleMessageRecalled]);

  useEffect(() => {
    if (selectedRoom) {
      fetchMessages(selectedRoom._id);
      socketService.emit('join_room', selectedRoom._id);

      // Clear unread count for this room
      setUnreadCounts((prev) => ({
        ...prev,
        [selectedRoom._id]: 0,
      }));
    }
  }, [selectedRoom]);

  const fetchRooms = async () => {
    try {
      const res = await api.get('/chat/rooms');
      setRooms(res.data);

      // If a roomId was passed in route params, auto-select it
      if (route.params?.roomId) {
        const room = res.data.find((r) => r._id === route.params.roomId);
        if (room) setSelectedRoom(room);
      } else if (route.params?.teamId) {
        const room = res.data.find((r) => r.teamId?._id === route.params.teamId);
        if (room) setSelectedRoom(room);
      }
    } catch (error) {
      console.error('Error fetching rooms:', error);
      Alert.alert('Lỗi', 'Không thể tải danh sách phòng chat.');
    } finally {
      setLoadingRooms(false);
    }
  };

  const fetchMessages = async (roomId) => {
    setLoadingMessages(true);
    try {
      const res = await api.get(`/chat/rooms/${roomId}/messages?page=1&limit=50`);
      setMessages(res.data);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 150);
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoadingMessages(false);
    }
  };

  const sendMessage = () => {
    if (!newMessage.trim() || !selectedRoom) return;

    const isReadOnly = ENDED_EVENT_STATUSES.includes(selectedRoom.eventId?.status || '');
    if (isReadOnly) {
      Alert.alert('Thông báo', 'Cuộc thi đã kết thúc. Chỉ có thể xem lịch sử chat.');
      return;
    }

    const trimmed = newMessage.trim();
    const tempId = 'temp_' + Date.now();

    // Optimistic UI Update: Hiển thị ngay tin nhắn trên Mobile lập tức!
    const tempMsg = {
      _id: tempId,
      tempId,
      roomId: selectedRoom._id,
      senderId: currentUser?.userId || currentUser?._id || currentUser?.id,
      senderName: currentUser?.fullName || currentUser?.name || 'Tôi',
      senderRole: currentUser?.role || 'user',
      content: trimmed,
      createdAt: new Date().toISOString(),
      replyTo: replyingTo
        ? {
            messageId: replyingTo._id,
            senderName: replyingTo.senderName,
            content: replyingTo.content,
          }
        : undefined,
    };

    setMessages((prev) => [...prev, tempMsg]);
    setNewMessage('');
    setReplyingTo(null);

    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 50);

    socketService.emit('send_message', {
      roomId: selectedRoom._id,
      content: trimmed,
      replyTo: replyingTo
        ? {
            messageId: replyingTo._id,
            senderName: replyingTo.senderName,
            content: replyingTo.content,
          }
        : undefined,
    });
  };

  const getRoomName = (room) => {
    if (room.type === 'event_general') {
      return `Kênh Chung - ${room.eventId?.name || 'Cuộc thi'}`;
    }
    if (room.type === 'track_mentors') {
      return `Kênh Mentor - Bảng ${room.trackId?.name || 'Chung'}`;
    }
    if (room.type === 'team_mentor') {
      return `Đội thi: ${room.teamId?.name || 'Đội'}`;
    }
    return room.name || 'Phòng trò chuyện';
  };

  const getRoomIcon = (type) => {
    switch (type) {
      case 'event_general':
        return <Megaphone size={18} color="#ea580c" />;
      case 'track_mentors':
        return <Users size={18} color="#0284c7" />;
      case 'team_mentor':
        return <MessageCircle size={18} color="#16a34a" />;
      default:
        return <MessagesSquare size={18} color="#64748b" />;
    }
  };

  const renderRoomItem = ({ item }) => {
    const isSelected = selectedRoom?._id === item._id;
    const unread = unreadCounts[item._id] || 0;

    return (
      <TouchableOpacity
        style={[styles.roomCard, isSelected && styles.roomCardSelected]}
        onPress={() => setSelectedRoom(item)}
        activeOpacity={0.7}
      >
        <View style={styles.roomIconBox}>{getRoomIcon(item.type)}</View>
        <View style={styles.roomInfo}>
          <View style={styles.roomHeaderRow}>
            <Text style={[styles.roomNameText, isSelected && styles.roomNameTextSelected]} numberOfLines={1}>
              {getRoomName(item)}
            </Text>
            {unread > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>{unread}</Text>
              </View>
            )}
          </View>
          <Text style={styles.roomSubText} numberOfLines={1}>
            {item.lastMessage?.content || 'Chưa có tin nhắn'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderMessageItem = ({ item }) => {
    const isMe =
      item.senderId === currentUser?.userId ||
      item.senderId === currentUser?._id ||
      item.senderId === currentUser?.id;
    const isRecalled = item.isRecalled;

    return (
      <View style={[styles.msgRow, isMe ? styles.msgRowMe : styles.msgRowOther]}>
        <View style={[styles.msgBubble, isMe ? styles.msgBubbleMe : styles.msgBubbleOther]}>
          {!isMe && <Text style={styles.msgSenderName}>{item.senderName || 'Người dùng'}</Text>}

          {item.replyTo && (
            <View style={styles.replyBox}>
              <Text style={styles.replySender}>@{item.replyTo.senderName}:</Text>
              <Text style={styles.replyContent} numberOfLines={1}>
                {item.replyTo.content}
              </Text>
            </View>
          )}

          <Text style={[styles.msgContentText, isMe ? styles.msgContentTextMe : styles.msgContentTextOther]}>
            {isRecalled ? 'Tin nhắn đã bị thu hồi' : item.content}
          </Text>

          <Text style={[styles.msgTimeText, isMe ? styles.msgTimeTextMe : styles.msgTimeTextOther]}>
            {new Date(item.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>

        {!isRecalled && !isMe && (
          <TouchableOpacity style={styles.replyBtn} onPress={() => setReplyingTo(item)}>
            <Quote size={12} color="#64748b" />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={styles.container}>
          {/* Top Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <ArrowLeft size={20} color="#0f172a" />
            </TouchableOpacity>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {selectedRoom ? getRoomName(selectedRoom) : 'Trò chuyện'}
            </Text>
            {selectedRoom && (
              <TouchableOpacity onPress={() => setSelectedRoom(null)} style={styles.closeRoomBtn}>
                <X size={18} color="#64748b" />
              </TouchableOpacity>
            )}
          </View>

          {/* Main Area: Rooms List OR Active Chat Room */}
          {!selectedRoom ? (
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionHeaderTitle}>DANH SÁCH PHÒNG TRÒ CHUYỆN</Text>
              {loadingRooms ? (
                <View style={styles.centerContainer}>
                  <ActivityIndicator size="large" color="#ea580c" />
                </View>
              ) : (
                <FlatList
                  data={rooms}
                  renderItem={renderRoomItem}
                  keyExtractor={(item) => item._id}
                  contentContainerStyle={styles.roomsListContent}
                  ListEmptyComponent={
                    <View style={styles.centerContainer}>
                      <MessagesSquare size={40} color="#cbd5e1" />
                      <Text style={styles.emptyText}>Chưa có phòng trò chuyện nào.</Text>
                    </View>
                  }
                />
              )}
            </View>
          ) : (
            <View style={{ flex: 1 }}>
              {/* Messages Feed */}
              {loadingMessages ? (
                <View style={styles.centerContainer}>
                  <ActivityIndicator size="small" color="#ea580c" />
                </View>
              ) : (
                <FlatList
                  ref={flatListRef}
                  data={messages}
                  renderItem={renderMessageItem}
                  keyExtractor={(item, index) => item._id || String(index)}
                  contentContainerStyle={styles.messagesListContent}
                  onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
                />
              )}

              {/* Replying Banner */}
              {replyingTo && (
                <View style={styles.replyingBanner}>
                  <Text style={styles.replyingBannerText} numberOfLines={1}>
                    Đang trả lời <Text style={{ fontWeight: '800' }}>@{replyingTo.senderName}</Text>: {replyingTo.content}
                  </Text>
                  <TouchableOpacity onPress={() => setReplyingTo(null)}>
                    <X size={14} color="#ea580c" />
                  </TouchableOpacity>
                </View>
              )}

              {/* Chat Input Bar */}
              <View style={styles.inputBar}>
                <TextInput
                  style={styles.textInput}
                  placeholder="Nhập tin nhắn..."
                  placeholderTextColor="#94a3b8"
                  value={newMessage}
                  onChangeText={setNewMessage}
                  multiline={false}
                />
                <TouchableOpacity
                  style={[styles.sendBtn, !newMessage.trim() && styles.sendBtnDisabled]}
                  onPress={sendMessage}
                  disabled={!newMessage.trim()}
                >
                  <Send size={16} color="#ffffff" />
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 8,
  },
  closeRoomBtn: {
    padding: 4,
  },
  sectionHeaderTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
    paddingHorizontal: 16,
    paddingTop: 12,
    letterSpacing: 0.5,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 8,
  },
  roomsListContent: {
    padding: 16,
    gap: 8,
  },
  roomCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  roomCardSelected: {
    backgroundColor: '#fff7ed',
    borderColor: '#fed7aa',
  },
  roomIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  roomInfo: {
    flex: 1,
  },
  roomHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  roomNameText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  roomNameTextSelected: {
    color: '#ea580c',
    fontWeight: '800',
  },
  unreadBadge: {
    backgroundColor: '#ef4444',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  unreadBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
  roomSubText: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  messagesListContent: {
    padding: 16,
    gap: 12,
  },
  msgRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 4,
  },
  msgRowMe: {
    justifyContent: 'flex-end',
  },
  msgRowOther: {
    justifyContent: 'flex-start',
  },
  msgBubble: {
    maxWidth: '82%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
  },
  msgBubbleMe: {
    backgroundColor: '#ea580c',
    borderBottomRightRadius: 2,
  },
  msgBubbleOther: {
    backgroundColor: '#f1f5f9',
    borderBottomLeftRadius: 2,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  msgSenderName: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ea580c',
    marginBottom: 2,
  },
  msgContentText: {
    fontSize: 14,
    lineHeight: 20,
  },
  msgContentTextMe: {
    color: '#ffffff',
  },
  msgContentTextOther: {
    color: '#0f172a',
  },
  msgTimeText: {
    fontSize: 9.5,
    marginTop: 4,
    textAlign: 'right',
  },
  msgTimeTextMe: {
    color: '#ffedd5',
  },
  msgTimeTextOther: {
    color: '#94a3b8',
  },
  replyBox: {
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderLeftWidth: 2,
    borderLeftColor: '#ea580c',
    padding: 6,
    borderRadius: 4,
    marginBottom: 4,
  },
  replySender: {
    fontSize: 10,
    fontWeight: '800',
    color: '#ea580c',
  },
  replyContent: {
    fontSize: 11,
    color: '#475569',
  },
  replyBtn: {
    padding: 6,
  },
  replyingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff7ed',
    borderTopWidth: 1,
    borderTopColor: '#ffedd5',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  replyingBannerText: {
    fontSize: 12,
    color: '#9a3412',
    flex: 1,
    marginRight: 8,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    backgroundColor: '#ffffff',
  },
  textInput: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 14,
    color: '#0f172a',
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ea580c',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: '#cbd5e1',
  },
});
