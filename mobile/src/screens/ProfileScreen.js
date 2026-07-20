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
import { User, ShieldAlert, CheckCircle, ArrowLeft } from 'lucide-react-native';
import api from '../api/api';
import BottomTabs from '../components/BottomTabs';
import HeaderAvatar from '../components/HeaderAvatar';

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
        const res = await api.get('/auth/me');
        const user = res.data.user;
        if (user) {
          setEmail(user.email || '');
          setFullName(user.fullName || '');
          setStudentId(user.studentId || '');
          setUniversity(user.university || '');
          setGithubUsername(user.githubUsername || '');

          await AsyncStorage.setItem('user', JSON.stringify(user));
        }
      } catch (err) {
        console.error('Lỗi khi tải profile từ API:', err);
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
        <ActivityIndicator size="large" color="#ea580c" />
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
          {/* Top Bar */}
          <View style={styles.headerBar}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => navigation.goBack()}
              activeOpacity={0.7}
            >
              <ArrowLeft size={20} color="#0f172a" />
              <Text style={styles.backBtnText}>Quay lại</Text>
            </TouchableOpacity>
            <HeaderAvatar navigation={navigation} />
          </View>

          <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
            <View style={styles.header}>
              <User size={22} color="#ea580c" />
              <Text style={styles.headerTitle}>CHỈNH SỬA THÔNG TIN CÁ NHÂN</Text>
            </View>

            <View style={styles.profileBox}>
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

              <Text style={styles.label}>HỌ VÀ TÊN</Text>
              <TextInput
                style={styles.input}
                placeholder="Họ và tên..."
                placeholderTextColor="#94a3b8"
                value={fullName}
                onChangeText={setFullName}
              />

              <Text style={styles.label}>MÃ SỐ SINH VIÊN (MSSV)</Text>
              <TextInput
                style={styles.input}
                placeholder="MSSV..."
                placeholderTextColor="#94a3b8"
                value={studentId}
                onChangeText={setStudentId}
              />

              <Text style={styles.label}>TRƯỜNG ĐẠI HỌC</Text>
              <TextInput
                style={styles.input}
                placeholder="Ví dụ: Đại học FPT..."
                placeholderTextColor="#94a3b8"
                value={university}
                onChangeText={setUniversity}
              />

              <Text style={styles.label}>TÀI KHOẢN GITHUB (USERNAME)</Text>
              <TextInput
                style={styles.input}
                placeholder="github-username..."
                placeholderTextColor="#94a3b8"
                value={githubUsername}
                onChangeText={setGithubUsername}
                autoCapitalize="none"
              />

              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleSave}
                disabled={updating}
                activeOpacity={0.85}
              >
                {updating ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.saveBtnText}>LƯU THAY ĐỔI</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
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
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
    marginLeft: 4,
  },
  scrollContainer: {
    padding: 16,
    paddingBottom: 24,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    marginBottom: 16,
  },
  headerTitle: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '800',
    marginLeft: 8,
    letterSpacing: 0.5,
  },
  profileBox: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarPlaceholder: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#ea580c',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    shadowColor: '#ea580c',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 26,
    fontWeight: '800',
  },
  profileEmail: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '600',
  },
  label: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    color: '#0f172a',
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 14,
    borderRadius: 10,
  },
  saveBtn: {
    backgroundColor: '#ea580c',
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 12,
    marginTop: 8,
    shadowColor: '#ea580c',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  saveBtnText: {
    color: '#ffffff',
    fontWeight: '800',
    letterSpacing: 0.5,
    fontSize: 14,
  },
  errorAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    padding: 10,
    borderRadius: 10,
    marginBottom: 14,
  },
  errorText: {
    color: '#dc2626',
    fontSize: 12,
    marginLeft: 8,
    flex: 1,
  },
  successAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    padding: 10,
    borderRadius: 10,
    marginBottom: 14,
  },
  successText: {
    color: '#047857',
    fontSize: 12,
    marginLeft: 8,
    flex: 1,
  },
});
