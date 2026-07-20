import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Alert,
  TouchableWithoutFeedback,
} from 'react-native';
import { User, Edit3, LogOut, X, Shield, ChevronRight } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../api/api';
import socketService from '../api/socketService';

export default function HeaderAvatar({ navigation }) {
  const [modalVisible, setModalVisible] = useState(false);
  const [user, setUser] = useState(null);
  const [roles, setRoles] = useState([]);

  useEffect(() => {
    loadUserData();
  }, [modalVisible]);

  const loadUserData = async () => {
    try {
      const userStr = await AsyncStorage.getItem('user');
      const rolesStr = await AsyncStorage.getItem('roles');
      if (userStr) {
        setUser(JSON.parse(userStr));
      }
      if (rolesStr) {
        setRoles(JSON.parse(rolesStr));
      }
    } catch (err) {
      console.error('Lỗi khi tải thông tin người dùng ở HeaderAvatar:', err);
    }
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const handleLogout = () => {
    setModalVisible(false);
    Alert.alert(
      'Đăng xuất',
      'Bạn có chắc chắn muốn đăng xuất khỏi hệ thống?',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Đăng xuất',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.post('/auth/logout').catch(() => {});
              socketService.disconnect();
              await AsyncStorage.removeItem('token');
              await AsyncStorage.removeItem('user');
              await AsyncStorage.removeItem('roles');
              navigation.reset({
                index: 0,
                routes: [{ name: 'Welcome' }],
              });
            } catch (err) {
              console.error('Lỗi khi đăng xuất:', err);
            }
          },
        },
      ]
    );
  };

  const handleEditProfile = () => {
    setModalVisible(false);
    navigation.navigate('Profile');
  };

  const isJudge = roles.some((r) => r.role === 'judge');
  const isCoordinator = roles.some((r) => r.role === 'coordinator');

  let roleLabel = 'Thí sinh';
  if (user?.isSystemAdmin) roleLabel = 'Quản trị viên';
  else if (isCoordinator) roleLabel = 'Ban tổ chức';
  else if (isJudge) roleLabel = 'Giám khảo';

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.avatarBtn}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.85}
      >
        <View style={styles.avatarRing}>
          <Text style={styles.avatarText}>{getInitials(user?.fullName)}</Text>
        </View>
      </TouchableOpacity>

      <Modal
        animationType="fade"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalCard}>
                {/* Header */}
                <View style={styles.modalHeader}>
                  <View style={styles.headerLeft}>
                    <View style={styles.largeAvatar}>
                      <Text style={styles.largeAvatarText}>{getInitials(user?.fullName)}</Text>
                    </View>
                    <View style={styles.userInfo}>
                      <Text style={styles.userName} numberOfLines={1}>
                        {user?.fullName || 'Người dùng'}
                      </Text>
                      <Text style={styles.userEmail} numberOfLines={1}>
                        {user?.email || 'email@example.com'}
                      </Text>
                      <View style={styles.roleBadge}>
                        <Shield size={10} color="#ea580c" />
                        <Text style={styles.roleBadgeText}>{roleLabel}</Text>
                      </View>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.closeBtn}
                    onPress={() => setModalVisible(false)}
                  >
                    <X size={18} color="#64748b" />
                  </TouchableOpacity>
                </View>

                <View style={styles.divider} />

                {/* Options List */}
                <View style={styles.optionsContainer}>
                  <TouchableOpacity
                    style={styles.optionItem}
                    onPress={handleEditProfile}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.iconBox, { backgroundColor: '#fff7ed' }]}>
                      <Edit3 size={18} color="#ea580c" />
                    </View>
                    <View style={styles.optionContent}>
                      <Text style={styles.optionTitle}>Chỉnh sửa thông tin</Text>
                      <Text style={styles.optionSub}>Cập nhật họ tên, MSSV, mật khẩu...</Text>
                    </View>
                    <ChevronRight size={16} color="#94a3b8" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.optionItem, { marginTop: 8 }]}
                    onPress={handleLogout}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.iconBox, { backgroundColor: '#fef2f2' }]}>
                      <LogOut size={18} color="#ef4444" />
                    </View>
                    <View style={styles.optionContent}>
                      <Text style={[styles.optionTitle, { color: '#ef4444' }]}>
                        Đăng xuất tài khoản
                      </Text>
                      <Text style={styles.optionSub}>Thoát phiên làm việc hiện tại</Text>
                    </View>
                    <ChevronRight size={16} color="#fca5a5" />
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarBtn: {
    padding: 2,
  },
  avatarRing: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#ea580c',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffedd5',
    shadowColor: '#ea580c',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 55,
    paddingRight: 16,
  },
  modalCard: {
    width: 310,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  largeAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ea580c',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  largeAvatarText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  userEmail: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff7ed',
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#ea580c',
    marginLeft: 3,
  },
  closeBtn: {
    padding: 4,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
  },
  divider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 14,
  },
  optionsContainer: {
    gap: 4,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  iconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  optionSub: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 1,
  },
});
