import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User, Mail, School, ShieldAlert, LogOut, CheckCircle } from 'lucide-react-native';
import api from '../api/api';
import BottomTabs from '../components/BottomTabs';

export default function ProfileScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [university, setUniversity] = useState('');
  const [githubUsername, setGithubUsername] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    const loadProfile = async () => {
      try {
        // Gọi API lấy thông tin mới nhất
        const res = await api.get('/auth/me');
        const user = res.data.user;
        if (user) {
          setEmail(user.email || '');
          setFullName(user.fullName || '');
          setStudentId(user.studentId || '');
          setUniversity(user.university || '');
          setGithubUsername(user.githubUsername || '');
          
          // Cập nhật lại AsyncStorage
          await AsyncStorage.setItem('user', JSON.stringify(user));
        }
      } catch (err) {
        console.error('Lỗi khi tải profile từ API:', err);
        // Fallback đọc từ AsyncStorage
        const userStr = await AsyncStorage.getItem('user');
        if (userStr) {
          const user = JSON.parse(userStr);
          setEmail(user.email || '');
          setFullName(user.fullName || '');
          setStudentId(user.studentId || '');
          setUniversity(user.university || '');
          setGithubUsername(user.githubUsername || '');
        }
      } finally {
        setLoading(false);
      }
    };
    loadProfile();
  }, []);

  const handleSave = async () => {
    if (!fullName.trim()) {
      setError('Họ và tên không được để trống.');
      return;
    }
    
    setError('');
    setSuccessMsg('');
    setUpdating(true);

    try {
      const payload = {
        fullName: fullName.trim(),
        studentId: studentId.trim(),
        university: university.trim(),
        githubUsername: githubUsername.trim(),
      };
      
      const res = await api.put('/auth/profile', payload);
      
      // Lưu lại thông tin mới
      const { user, roles } = res.data;
      await AsyncStorage.setItem('user', JSON.stringify(user));
      if (roles) {
        await AsyncStorage.setItem('roles', JSON.stringify(roles));
      }

      setSuccessMsg(res.data.message || 'Cập nhật thông tin thành công!');
      Alert.alert('Thành công', res.data.message || 'Đã cập nhật thông tin cá nhân!');
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.message || 'Có lỗi xảy ra khi cập nhật thông tin.';
      setError(msg);
      Alert.alert('Thất bại', msg);
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00f0ff" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={styles.container}>
          <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
            <View style={styles.header}>
              <User size={22} color="#00f0ff" />
              <Text style={styles.headerTitle}>TRANG CÁ NHÂN</Text>
            </View>

            <View style={styles.profileBox}>
              {/* Ảnh đại diện giả định */}
              <View style={styles.avatarContainer}>
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarText}>
                    {fullName ? fullName.charAt(0).toUpperCase() : 'U'}
                  </Text>
                </View>
                <Text style={styles.profileEmail}>{email}</Text>
              </View>

              {error ? (
                <View style={styles.errorAlert}>
                  <ShieldAlert size={16} color="#ef4444" />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              {successMsg ? (
                <View style={styles.successAlert}>
                  <CheckCircle size={16} color="#10b981" />
                  <Text style={styles.successText}>{successMsg}</Text>
                </View>
              ) : null}

              {/* Form Input */}
              <Text style={styles.label}>HỌ VÀ TÊN</Text>
              <TextInput
                style={styles.input}
                placeholder="Họ và tên..."
                placeholderTextColor="#849495"
                value={fullName}
                onChangeText={setFullName}
              />

              <Text style={styles.label}>MÃ SỐ SINH VIÊN (MSSV)</Text>
              <TextInput
                style={styles.input}
                placeholder="MSSV..."
                placeholderTextColor="#849495"
                value={studentId}
                onChangeText={setStudentId}
              />

              <Text style={styles.label}>TRƯỜNG ĐẠI HỌC</Text>
              <TextInput
                style={styles.input}
                placeholder="Ví dụ: Đại học FPT..."
                placeholderTextColor="#849495"
                value={university}
                onChangeText={setUniversity}
              />

              <Text style={styles.label}>TÀI KHOẢN GITHUB (USERNAME)</Text>
              <TextInput
                style={styles.input}
                placeholder="github-username..."
                placeholderTextColor="#849495"
                value={githubUsername}
                onChangeText={setGithubUsername}
                autoCapitalize="none"
              />

              {/* Action Buttons */}
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleSave}
                disabled={updating}
              >
                {updating ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <Text style={styles.saveBtnText}>LƯU THAY ĐỔI</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>

          <BottomTabs activeTab="profile" navigation={navigation} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0a141d',
  },
  container: {
    flex: 1,
  },
  scrollContainer: {
    paddingGrow: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0a141d',
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 4,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    marginLeft: 10,
    letterSpacing: 1.5,
  },
  profileBox: {
    backgroundColor: '#131d25',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
    padding: 20,
    borderRadius: 4,
    marginBottom: 20,
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarPlaceholder: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(0, 240, 255, 0.1)',
    borderColor: '#00f0ff',
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#00f0ff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  avatarText: {
    color: '#00f0ff',
    fontSize: 28,
    fontWeight: '800',
  },
  profileEmail: {
    color: '#849495',
    fontSize: 13,
    fontWeight: '600',
  },
  label: {
    color: '#849495',
    fontSize: 10,
    fontWeight: '800',
    marginBottom: 8,
    letterSpacing: 1,
  },
  input: {
    backgroundColor: 'rgba(6, 15, 23, 0.8)',
    borderWidth: 1,
    borderColor: '#3b494b',
    color: '#dae3f0',
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    marginBottom: 16,
    borderRadius: 4,
  },
  saveBtn: {
    backgroundColor: '#00f0ff',
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 4,
    marginTop: 10,
    marginBottom: 12,
  },
  saveBtnText: {
    color: '#000',
    fontWeight: '800',
    letterSpacing: 1,
    fontSize: 13,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: '#ff3b30',
    borderWidth: 1,
    paddingVertical: 12,
    borderRadius: 4,
    marginTop: 8,
    backgroundColor: 'rgba(255, 59, 48, 0.03)',
  },
  logoutBtnText: {
    color: '#ff3b30',
    fontWeight: '800',
    fontSize: 12,
    marginLeft: 8,
    letterSpacing: 0.5,
  },
  errorAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
    padding: 10,
    marginBottom: 16,
  },
  errorText: {
    color: '#fca5a5',
    fontSize: 12,
    marginLeft: 8,
    flex: 1,
  },
  successAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
    padding: 10,
    marginBottom: 16,
  },
  successText: {
    color: '#a7f3d0',
    fontSize: 12,
    marginLeft: 8,
    flex: 1,
  },
});
