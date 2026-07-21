import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ShieldAlert, RefreshCw, UserPlus, ArrowLeft } from 'lucide-react-native';
import { SvgXml } from 'react-native-svg';
import api from '../api/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import socketService from '../api/socketService';
import { formatCaptchaSvg } from '../utils/captchaFormatter';

export default function RegisterScreen({ navigation }) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [studentId, setStudentId] = useState('');
  const [university, setUniversity] = useState('Trường Đại học FPT TP.HCM');

  const [captchaId, setCaptchaId] = useState('');
  const [captchaSvg, setCaptchaSvg] = useState('');
  const [captchaValue, setCaptchaValue] = useState('');

  const [loading, setLoading] = useState(false);
  const [loadingCaptcha, setLoadingCaptcha] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchCaptcha();
  }, []);

  const fetchCaptcha = async () => {
    setLoadingCaptcha(true);
    try {
      const res = await api.get('/auth/captcha');
      if (res.data && res.data.captchaId && res.data.captchaSvg) {
        setCaptchaId(res.data.captchaId);
        setCaptchaSvg(formatCaptchaSvg(res.data.captchaSvg));
        setCaptchaValue('');
      }
    } catch (err) {
      console.error('Lỗi khi tải Captcha:', err.message || 'Không thể tải Captcha');
    } finally {
      setLoadingCaptcha(false);
    }
  };

  const handleRegister = async () => {
    if (!fullName || !email || !password) {
      setError('Vui lòng điền đầy đủ Họ tên, Email và Mật khẩu.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Mật khẩu nhập lại không trùng khớp.');
      return;
    }

    if (!captchaValue) {
      setError('Vui lòng nhập mã xác thực (CAPTCHA).');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const res = await api.post('/auth/register', {
        fullName,
        email,
        password,
        studentId,
        university,
        captchaId,
        captchaValue,
      });

      Alert.alert(
        'Đăng ký thành công',
        'Tài khoản của bạn đã được khởi tạo thành công! Hãy đăng nhập để bắt đầu.',
        [
          {
            text: 'Đăng nhập ngay',
            onPress: () => navigation.replace('Login'),
          },
        ]
      );
    } catch (err) {
      console.error('Lỗi đăng ký:', err);
      fetchCaptcha(); // Reload captcha on failure
      if (err.response && err.response.data && err.response.data.message) {
        setError(err.response.data.message);
      } else {
        setError('Đăng ký thất bại. Vui lòng kiểm tra lại thông tin.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
          {/* Top Bar */}
          <View style={styles.topNav}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => navigation.goBack()}
              activeOpacity={0.7}
            >
              <ArrowLeft size={20} color="#0f172a" />
              <Text style={styles.backBtnText}>Quay lại</Text>
            </TouchableOpacity>
          </View>

          {/* Logo Branding */}
          {/* <View style={styles.header}>
            <Text style={styles.logoText}>SEAL</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>HACKATHON</Text>
            </View>
          </View> */}

          {/* Form Container */}
          <View style={styles.formContainer}>
            <View style={styles.formTitleRow}>
              <Text style={styles.title}>ĐĂNG KÝ</Text>
            </View>

            {error ? (
              <View style={styles.errorAlert}>
                <ShieldAlert size={16} color="#ef4444" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <Text style={styles.label}>Họ và tên *</Text>
            <TextInput
              style={styles.input}
              placeholder="Nguyễn Văn A"
              placeholderTextColor="#94a3b8"
              value={fullName}
              onChangeText={setFullName}
            />

            <Text style={styles.label}>Email *</Text>
            <TextInput
              style={styles.input}
              placeholder="email@example.com"
              placeholderTextColor="#94a3b8"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Text style={styles.label}>Mật khẩu *</Text>
            <TextInput
              style={styles.input}
              placeholder="Nhập mật khẩu"
              placeholderTextColor="#94a3b8"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
            />

            <Text style={styles.label}>Nhập lại mật khẩu *</Text>
            <TextInput
              style={styles.input}
              placeholder="Xác nhận lại mật khẩu"
              placeholderTextColor="#94a3b8"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              autoCapitalize="none"
            />

            <View style={styles.rowTwoCols}>
              <View style={{ flex: 1, marginRight: 6 }}>
                <Text style={styles.label}>Mã sinh viên (MSSV)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="SE180000"
                  placeholderTextColor="#94a3b8"
                  value={studentId}
                  onChangeText={setStudentId}
                  autoCapitalize="characters"
                />
              </View>
              <View style={{ flex: 1, marginLeft: 6 }}>
                <Text style={styles.label}>Trường Đại học</Text>
                <TextInput
                  style={styles.input}
                  placeholder="FPT University"
                  placeholderTextColor="#94a3b8"
                  value={university}
                  onChangeText={setUniversity}
                />
              </View>
            </View>

            {/* Captcha Section */}
            <Text style={styles.label}>Mã xác thực (CAPTCHA) *</Text>
            <View style={styles.captchaRow}>
              <View style={styles.captchaImageWrap}>
                {captchaSvg ? (
                  <SvgXml xml={captchaSvg} width={160} height={48} />
                ) : (
                  <View style={styles.captchaPlaceholder}>
                    <ActivityIndicator size="small" color="#ea580c" />
                  </View>
                )}
              </View>
              <TouchableOpacity
                style={styles.refreshCaptchaBtn}
                onPress={fetchCaptcha}
                disabled={loadingCaptcha}
              >
                <RefreshCw size={18} color="#ea580c" />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.input}
              placeholder="Nhập mã xác thực CAPTCHA"
              placeholderTextColor="#94a3b8"
              value={captchaValue}
              onChangeText={setCaptchaValue}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <TouchableOpacity
              style={styles.registerBtn}
              onPress={handleRegister}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.registerBtnText}>TẠO TÀI KHOẢN MỚI</Text>
              )}
            </TouchableOpacity>

            <View style={styles.loginRedirect}>
              <Text style={styles.loginRedirectText}>Đã có tài khoản? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                <Text style={styles.loginRedirectLink}>Đăng nhập ngay</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollContainer: {
    flexGrow: 1,
    padding: 20,
    justifyContent: 'center',
  },
  topNav: {
    marginBottom: 10,
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
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoText: {
    fontSize: 36,
    fontWeight: '900',
    color: '#ea580c',
    letterSpacing: 2,
  },
  badge: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 2,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
  },
  formContainer: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 20,
    borderRadius: 16,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
  },
  formTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    gap: 8,
  },
  title: {
    color: '#0f172a',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
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
  rowTwoCols: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  captchaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  captchaImageWrap: {
    width: 160,
    height: 48,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  captchaPlaceholder: {
    width: 160,
    height: 48,
    backgroundColor: '#fff7ed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshCaptchaBtn: {
    width: 48,
    height: 48,
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    borderRadius: 10,
    marginLeft: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  registerBtn: {
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
  registerBtnText: {
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
  loginRedirect: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 18,
  },
  loginRedirectText: {
    color: '#64748b',
    fontSize: 13,
  },
  loginRedirectLink: {
    color: '#ea580c',
    fontSize: 13,
    fontWeight: '700',
  },
});
