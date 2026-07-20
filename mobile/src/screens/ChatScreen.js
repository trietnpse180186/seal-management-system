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
  }, []);

  useEffect(() => {
    if (selectedRoom) {
      fetchMessages(selectedRoom._id);
      socketService.emit('join_room', selectedRoom._id);

      // Clear unread count for this room
      setUnreadCounts(prev => ({
        ...prev,
        [selectedRoom._id]: 0
      }));
    }
  }, [selectedRoom]);

  const handleNewMessage = (message) => {
    // If we are in the room, add it to messages
    if (selectedRoom && message.roomId === selectedRoom._id) {
      setMessages(prev => {
        if (prev.find(m => m._id === message._id)) return prev;
        return [...prev, message];
      });
      // Scroll to bottom
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    } else {
      // Otherwise, update unread counts
      setUnreadCounts(prev => ({
        ...prev,
        [message.roomId]: (prev[message.roomId] || 0) + 1
      }));
    }
  };

  const handleMessageRecalled = (data) => {
    setMessages(prev => prev.map(m =>
      m._id === data.messageId ? { ...m, isRecalled: true, content: data.content } : m
    ));
  };

  const fetchRooms = async () => {
    try {
      const res = await api.get('/chat/rooms');
      setRooms(res.data);

      // If a roomId was passed in route params, auto-select it
      if (route.params?.roomId) {
        const room = res.data.find(r => r._id === route.params.roomId);
        if (room) setSelectedRoom(room);
      } else if (route.params?.teamId) {
        const room = res.data.find(r => r.teamId?._id === route.params.teamId);
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
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 200);
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

    socketService.emit('send_message', {
      roomId: selectedRoom._id,
      content: newMessage.trim(),
      replyTo: replyingTo ? {
        messageId: replyingTo._id,
        senderName: replyingTo.senderName,
        content: replyingTo.content
      } : undefined
    });

    setNewMessage('');
    setReplyingTo(null);
    Keyboard.dismiss();
  };

  const getRoomName = (room) => {
    if (room.type === 'event_general') {
      return `Kênh Chung - ${room.eventId?.name || 'Cuộc thi'}`;
    }
    if (room.type === 'track_mentors') {
      return `Kênh Mentor - Bảng ${room.trackId?.name || 'Chung'}`;
    }

    // Check if current user is a member of the team
    const isTeamMember = room.members && room.members.some(m =>
      (m._id || m) === (currentUser?._id || currentUser?.id)
    );

    if (isTeamMember) {
      const mentorName = room.mentorId?.fullName || room.teamId?.mentorId?.fullName;
      return mentorName ? `Mentor: ${mentorName}` : `Hỗ trợ từ Mentor`;
    }
    return `Đội thi: ${room.teamId?.name || 'Đội thi'}`;
  };

  const renderRoomItem = ({ item }) => {
    const roomUnread = unreadCounts[item._id] || 0;
    const isTeamRoom = item.type === 'team_mentor';

    let icon = <Users size={20} color="#00f0ff" />;
    if (item.type === 'event_general') icon = <Megaphone size={20} color="#f59e0b" />;
    else if (item.type === 'track_mentors') icon = <MessagesSquare size={20} color="#6366f1" />;
    else if (isTeamRoom) icon = <MessageCircle size={20} color="#10b981" />;

    return (
      <TouchableOpacity
        style={styles.roomItem}
        onPress={() => setSelectedRoom(item)}
      >
        <View style={styles.roomIconBox}>{icon}</View>
        <View style={styles.roomInfo}>
          <Text style={styles.roomName} numberOfLines={1}>{getRoomName(item)}</Text>
          <Text style={styles.roomEvent} numberOfLines={1}>{item.eventId?.name}</Text>
        </View>
        {roomUnread > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadText}>{roomUnread}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderMessageItem = ({ item }) => {
    const isMe = (item.senderId?._id || item.senderId) === (currentUser?._id || currentUser?.id);
    const isRecalled = item.isRecalled;

    return (
      <View style={[styles.messageContainer, isMe ? styles.myMessageContainer : styles.otherMessageContainer]}>
        {!isMe && <Text style={styles.senderName}>{item.senderName}</Text>}
        <View style={[
          styles.messageBubble,
          isMe ? styles.myBubble : styles.otherBubble,
          isRecalled && styles.recalledBubble
        ]}>
          {item.replyTo && !isRecalled && (
            <View style={styles.replyBox}>
              <Text style={styles.replySender}>@{item.replyTo.senderName}</Text>
              <Text style={styles.replyContent} numberOfLines={1}>{item.replyTo.content}</Text>
            </View>
          )}
          <Text style={[styles.messageText, isMe ? styles.myMessageText : styles.otherMessageText, isRecalled && styles.recalledText]}>
            {item.content}
          </Text>
        </View>
        <Text style={styles.messageTime}>
          {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    );
  };

  if (loadingRooms) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#00f0ff" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => {
            if (selectedRoom) setSelectedRoom(null);
            else navigation.goBack();
          }}>
            <ArrowLeft size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {selectedRoom ? getRoomName(selectedRoom) : 'PHÒNG CHAT'}
          </Text>
          <View style={{ width: 24 }} />
        </View>

        {!selectedRoom ? (
          /* Room List */
          <FlatList
            data={rooms}
            renderItem={renderRoomItem}
            keyExtractor={item => item._id}
            contentContainerStyle={styles.listContainer}
            ListEmptyComponent={
              <Text style={styles.emptyText}>Chưa có phòng chat nào.</Text>
            }
          />
        ) : (
          /* Message View */
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
          >
            <FlatList
              ref={flatListRef}
              data={messages}
              renderItem={renderMessageItem}
              keyExtractor={item => item._id}
              contentContainerStyle={styles.messageList}
              onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
            />

            {/* Input Area */}
            <View style={styles.inputArea}>
              {replyingTo && (
                <View style={styles.replyingArea}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.replyingTitle}>Đang trả lời @{replyingTo.senderName}</Text>
                    <Text style={styles.replyingText} numberOfLines={1}>{replyingTo.content}</Text>
                  </View>
                  <TouchableOpacity onPress={() => setReplyingTo(null)}>
                    <X size={16} color="#849495" />
                  </TouchableOpacity>
                </View>
              )}
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.input}
                  placeholder="Nhập tin nhắn..."
                  placeholderTextColor="#849495"
                  value={newMessage}
                  onChangeText={setNewMessage}
                  multiline
                />
                <TouchableOpacity
                  style={[styles.sendBtn, !newMessage.trim() && styles.sendBtnDisabled]}
                  onPress={sendMessage}
                  disabled={!newMessage.trim()}
                >
                  <Send size={20} color={newMessage.trim() ? "#000" : "#5c6d70"} />
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  centerContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerTitle: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '800',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 10,
  },
  listContainer: {
    padding: 16,
  },
  roomItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 2,
  },
  roomIconBox: {
    width: 40,
    height: 40,
    backgroundColor: '#fff7ed',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  roomInfo: {
    flex: 1,
  },
  roomName: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  roomEvent: {
    color: '#64748b',
    fontSize: 11,
  },
  unreadBadge: {
    backgroundColor: '#ea580c',
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  unreadText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '900',
  },
  emptyText: {
    color: '#64748b',
    textAlign: 'center',
    marginTop: 40,
  },
  messageList: {
    padding: 16,
    paddingBottom: 20,
  },
  messageContainer: {
    marginBottom: 14,
    maxWidth: '85%',
  },
  myMessageContainer: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  otherMessageContainer: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  senderName: {
    color: '#ea580c',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
    marginLeft: 4,
  },
  messageBubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
  },
  myBubble: {
    backgroundColor: '#ea580c',
    borderBottomRightRadius: 2,
  },
  otherBubble: {
    backgroundColor: '#ffffff',
    borderBottomLeftRadius: 2,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  recalledBubble: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  messageText: {
    fontSize: 13,
    lineHeight: 18,
  },
  myMessageText: {
    color: '#ffffff',
    fontWeight: '500',
  },
  otherMessageText: {
    color: '#0f172a',
  },
  recalledText: {
    color: '#94a3b8',
    fontStyle: 'italic',
  },
  messageTime: {
    color: '#94a3b8',
    fontSize: 9,
    marginTop: 4,
  },
  replyBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    padding: 6,
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#ea580c',
    marginBottom: 6,
  },
  replySender: {
    fontSize: 10,
    fontWeight: '700',
    color: '#ea580c',
  },
  replyContent: {
    fontSize: 11,
    color: '#475569',
  },
  inputArea: {
    padding: 12,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  replyingArea: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff7ed',
    padding: 8,
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#ea580c',
  },
  replyingTitle: {
    color: '#ea580c',
    fontSize: 10,
    fontWeight: '800',
  },
  replyingText: {
    color: '#64748b',
    fontSize: 11,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderColor: '#cbd5e1',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    paddingTop: 8,
    color: '#0f172a',
    maxHeight: 100,
    fontSize: 14,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ea580c',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  sendBtnDisabled: {
    backgroundColor: '#cbd5e1',
  },
});
