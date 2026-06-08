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
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import api, { initApiUrl, updateBaseUrl } from '../api/api';
import { Settings, ShieldAlert } from 'lucide-react-native';

WebBrowser.maybeCompleteAuthSession();

const getWebClientUrl = (apiUrl) => {
  try {
    if (!apiUrl) return 'http://10.0.2.2:5173';
    const match = apiUrl.match(/^(https?:\/\/)([^:/]+)/i);
    if (match) {
      const protocol = match[1];
      const hostname = match[2];
      return `${protocol}${hostname}:5173`;
    }
    return 'http://10.0.2.2:5173';
  } catch (e) {
    console.error(e);
    return 'http://10.0.2.2:5173';
  }
};

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [apiUrl, setApiUrl] = useState('');
  const [webUrl, setWebUrl] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState('');

  // Các state hỗ trợ OAuth & Mock Login
  const [showMockModal, setShowMockModal] = useState(false);
  const [mockProvider, setMockProvider] = useState('google');
  const [mockEmail, setMockEmail] = useState('');
  const [mockUsername, setMockUsername] = useState('');
  const [mockFullName, setMockFullName] = useState('');

  useEffect(() => {
    const checkExistingSession = async () => {
      try {
        const currentUrl = await initApiUrl();
        setApiUrl(currentUrl);

        // Load saved Web Client URL hoặc tự suy luận
        const savedWebUrl = await AsyncStorage.getItem('web_client_url');
        if (savedWebUrl) {
          setWebUrl(savedWebUrl);
        } else {
          setWebUrl(getWebClientUrl(currentUrl));
        }

        const token = await AsyncStorage.getItem('token');
        const userStr = await AsyncStorage.getItem('user');
        const rolesStr = await AsyncStorage.getItem('roles');

        if (token && userStr && rolesStr) {
          const user = JSON.parse(userStr);
          const roles = JSON.parse(rolesStr);
          redirectUser(user, roles);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setInitializing(false);
      }
    };
    checkExistingSession();
  }, []);

  const redirectUser = async (user, roles) => {
    navigation.replace('Home');
  };

  const getQueryParam = (url, paramName) => {
    const reg = new RegExp('[#?&]' + paramName + '=([^&#]*)', 'i');
    const string = reg.exec(url);
    return string ? decodeURIComponent(string[1]) : null;
  };

  const loginWithBackend = async (endpoint, payload) => {
    setError('');
    setLoading(true);
    try {
      const res = await api.post(endpoint, payload);
      const { token, user, roles } = res.data;

      await AsyncStorage.setItem('token', token);
      await AsyncStorage.setItem('user', JSON.stringify(user));
      await AsyncStorage.setItem('roles', JSON.stringify(roles || []));

      await redirectUser(user, roles || []);
    } catch (err) {
      console.error(err);
      if (err.response && err.response.data && err.response.data.message) {
        setError(err.response.data.message);
      } else {
        setError('Kết nối máy chủ thất bại. Hãy kiểm tra địa chỉ API của bạn.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthRealFlow = async (provider) => {
    setError('');
    setLoading(true);
    try {
      const finalWebUrl = webUrl || getWebClientUrl(apiUrl);
      const redirectUrl = AuthSession.makeRedirectUri({
        scheme: 'sealhackathon',
        path: 'redirect',
      });
      const authUrl = `${finalWebUrl}/login?platform=mobile&mobile_redirect=${encodeURIComponent(redirectUrl)}&provider=${provider}&api_url=${encodeURIComponent(apiUrl)}`;

      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);

      if (result.type === 'success' && result.url) {
        const token = getQueryParam(result.url, 'token');
        const userStr = getQueryParam(result.url, 'user');
        const rolesStr = getQueryParam(result.url, 'roles');

        if (token && userStr && rolesStr) {
          const user = JSON.parse(userStr);
          const roles = JSON.parse(rolesStr);

          await AsyncStorage.setItem('token', token);
          await AsyncStorage.setItem('user', JSON.stringify(user));
          await AsyncStorage.setItem('roles', JSON.stringify(roles || []));

          await redirectUser(user, roles || []);
        } else {
          setError('Không trích xuất được thông tin đăng nhập từ Web Client.');
        }
      } else if (result.type === 'cancel') {
        // User cancelled
      } else {
        setError('Đăng nhập qua trình duyệt thất bại.');
      }
    } catch (err) {
      console.error(err);
      setError('Lỗi khi mở trình duyệt đăng nhập cầu nối.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async (isRealFlow = false) => {
    if (!isRealFlow) {
      setMockProvider('google');
      setMockEmail('');
      setMockFullName('');
      setShowMockModal(true);
      return;
    }
    await handleOAuthRealFlow('google');
  };

  const handleGithubLogin = async (isRealFlow = false) => {
    if (!isRealFlow) {
      setMockProvider('github');
      setMockEmail('');
      setMockUsername('');
      setMockFullName('');
      setShowMockModal(true);
      return;
    }
    await handleOAuthRealFlow('github');
  };

  const handleMockSubmit = async () => {
    if (mockProvider === 'google') {
      if (!mockEmail) {
        setError('Vui lòng nhập Email giả lập.');
        return;
      }
      setShowMockModal(false);
      await loginWithBackend('/auth/google', {
        email: mockEmail,
        fullName: mockFullName || mockEmail.split('@')[0],
        isMock: true
      });
    } else {
      if (!mockEmail || !mockUsername) {
        setError('Vui lòng nhập đầy đủ Email và GitHub Username giả lập.');
        return;
      }
      setShowMockModal(false);
      await loginWithBackend('/auth/github', {
        email: mockEmail,
        githubUsername: mockUsername,
        fullName: mockFullName || mockEmail.split('@')[0],
        isMock: true
      });
    }
  };

  const handleLogin = async () => {

    if (!email || !password) {
      setError('Vui lòng nhập đầy đủ thông tin đăng nhập.');
      return;
    }
    setError('');
    setLoading(true);

    try {
      const res = await api.post('/auth/login', { email, password });
      const { token, user, roles } = res.data;

      await AsyncStorage.setItem('token', token);
      await AsyncStorage.setItem('user', JSON.stringify(user));
      await AsyncStorage.setItem('roles', JSON.stringify(roles || []));

      await redirectUser(user, roles || []);
    } catch (err) {
      console.error(err);
      if (err.response && err.response.data && err.response.data.message) {
        setError(err.response.data.message);
      } else {
        setError('Kết nối máy chủ thất bại. Hãy kiểm tra địa chỉ API của bạn.');
      }
    } finally {
      setLoading(false);
    }
  };

  const saveApiSettings = async () => {
    if (!apiUrl.trim()) return;
    await updateBaseUrl(apiUrl.trim());
    if (webUrl.trim()) {
      await AsyncStorage.setItem('web_client_url', webUrl.trim());
    }
    setShowSettings(false);
    setError('');
  };

  if (initializing) {
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
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <View style={styles.header}>
            <Text style={styles.logoText}>SEAL</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>HACKATHON</Text>
            </View>
          </View>

          <View style={styles.formContainer}>
            <Text style={styles.title}>ĐĂNG NHẬP HỆ THỐNG</Text>

            {error ? (
              <View style={styles.errorAlert}>
                <ShieldAlert size={16} color="#ef4444" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="#849495"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <TextInput
              style={styles.input}
              placeholder="Mật khẩu"
              placeholderTextColor="#849495"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
            />

            <TouchableOpacity
              style={styles.loginBtn}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={styles.loginBtnText}>ĐĂNG NHẬP</Text>
              )}
            </TouchableOpacity>

            {/* Divider Hoặc đăng nhập bằng */}
            <View style={styles.dividerContainer}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>Hoặc đăng nhập bằng</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Nút bấm Google và GitHub */}
            <View style={styles.oauthRow}>
              <TouchableOpacity
                style={styles.oauthBtn}
                onPress={() => handleGoogleLogin(false)}
                disabled={loading}
              >
                <Text style={[styles.googleIconText, { marginRight: 8 }]}>[G]</Text>
                <Text style={styles.oauthBtnText}>Google</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.oauthBtn}
                onPress={() => handleGithubLogin(false)}
                disabled={loading}
              >
                <Text style={[styles.githubIconText, { marginRight: 8 }]}>[Git]</Text>
                <Text style={styles.oauthBtnText}>GitHub</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Modal Đăng nhập nhanh (Test Mode) / OAuth */}
          <Modal
            animationType="fade"
            transparent={true}
            visible={showMockModal}
            onRequestClose={() => setShowMockModal(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>
                  {mockProvider === 'google' ? 'ĐĂNG NHẬP GOOGLE' : 'ĐĂNG NHẬP GITHUB'}
                </Text>
                
                <TouchableOpacity 
                  style={styles.modalRealBtn}
                  onPress={() => {
                    setShowMockModal(false);
                    if (mockProvider === 'google') {
                      handleGoogleLogin(true);
                    } else {
                      handleGithubLogin(true);
                    }
                  }}
                >
                  <Text style={styles.modalRealBtnText}>ĐĂNG NHẬP THẬT (OAUTH)</Text>
                </TouchableOpacity>

                <View style={styles.modalDividerContainer}>
                  <View style={styles.modalDividerLine} />
                  <Text style={styles.modalDividerText}>HOẶC MOCK TEST</Text>
                  <View style={styles.modalDividerLine} />
                </View>

                <Text style={styles.modalLabel}>Họ và tên giả lập (Tùy chọn)</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Ví dụ: Nguyễn Văn A"
                  placeholderTextColor="#849495"
                  value={mockFullName}
                  onChangeText={setMockFullName}
                  autoCapitalize="none"
                />

                <Text style={styles.modalLabel}>Email giả lập</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="example@gmail.com"
                  placeholderTextColor="#849495"
                  value={mockEmail}
                  onChangeText={setMockEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />

                {mockProvider === 'github' && (
                  <>
                    <Text style={styles.modalLabel}>GitHub Username giả lập</Text>
                    <TextInput
                      style={styles.modalInput}
                      placeholder="github-username"
                      placeholderTextColor="#849495"
                      value={mockUsername}
                      onChangeText={setMockUsername}
                      autoCapitalize="none"
                    />
                  </>
                )}

                <View style={styles.modalActionRow}>
                  <TouchableOpacity
                    style={styles.modalCancelBtn}
                    onPress={() => setShowMockModal(false)}
                  >
                    <Text style={styles.modalCancelBtnText}>HỦY</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.modalSubmitBtn}
                    onPress={handleMockSubmit}
                  >
                    <Text style={styles.modalSubmitBtnText}>XÁC NHẬN</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>


          {/* Cấu hình kết nối API */}
          <View style={styles.settingsSection}>
            <TouchableOpacity
              style={styles.settingsToggle}
              onPress={() => setShowSettings(!showSettings)}
            >
              <Settings size={16} color="#849495" />
              <Text style={styles.settingsToggleText}>Cấu hình API kết nối</Text>
            </TouchableOpacity>

            {showSettings ? (
              <View style={styles.settingsBox}>
                <Text style={styles.settingsTitle}>ĐỊA CHỈ API SERVER</Text>
                <TextInput
                  style={styles.settingsInput}
                  placeholder="http://10.0.2.2:5000/api"
                  placeholderTextColor="#849495"
                  value={apiUrl}
                  onChangeText={setApiUrl}
                  autoCapitalize="none"
                />

                <Text style={styles.settingsTitle}>ĐỊA CHỈ WEB CLIENT (OAUTH BRIDGE)</Text>
                <TextInput
                  style={styles.settingsInput}
                  placeholder="http://10.0.2.2:5173"
                  placeholderTextColor="#849495"
                  value={webUrl}
                  onChangeText={setWebUrl}
                  autoCapitalize="none"
                />

                <TouchableOpacity
                  style={styles.settingsSaveBtn}
                  onPress={saveApiSettings}
                >
                  <Text style={styles.settingsSaveBtnText}>LƯU CẤU HÌNH</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0a141d',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0a141d',
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoText: {
    fontSize: 40,
    fontWeight: '900',
    color: '#00f0ff',
    textShadowColor: 'rgba(0, 240, 255, 0.4)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  badge: {
    backgroundColor: '#131d25',
    borderColor: '#3b494b',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 2,
    marginTop: 4,
  },
  badgeText: {
    color: '#b9cacb',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
  },
  formContainer: {
    backgroundColor: '#131d25',
    borderWidth: 1,
    borderColor: 'rgba(0, 240, 255, 0.15)',
    padding: 20,
    borderRadius: 4,
  },
  title: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 20,
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
  loginBtn: {
    backgroundColor: '#00f0ff',
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 4,
  },
  loginBtnText: {
    color: '#000',
    fontWeight: '800',
    letterSpacing: 1,
    fontSize: 14,
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
  settingsSection: {
    marginTop: 30,
    alignItems: 'center',
  },
  settingsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingsToggleText: {
    color: '#849495',
    fontSize: 12,
    marginLeft: 6,
    fontWeight: '600',
  },
  settingsBox: {
    width: '100%',
    backgroundColor: '#131d25',
    borderWidth: 1,
    borderColor: '#3b494b',
    padding: 16,
    marginTop: 12,
    borderRadius: 4,
  },
  settingsTitle: {
    color: '#849495',
    fontSize: 10,
    fontWeight: '800',
    marginBottom: 8,
    letterSpacing: 1,
  },
  settingsInput: {
    backgroundColor: 'rgba(6, 15, 23, 0.8)',
    borderWidth: 1,
    borderColor: '#3b494b',
    color: '#dae3f0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 12,
    marginBottom: 10,
    borderRadius: 4,
  },
  settingsSaveBtn: {
    borderColor: '#00f0ff',
    borderWidth: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 4,
  },
  settingsSaveBtnText: {
    color: '#00f0ff',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(59, 73, 75, 0.4)',
  },
  dividerText: {
    color: '#849495',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    paddingHorizontal: 10,
    textTransform: 'uppercase',
  },
  oauthRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  oauthBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#131d25',
    borderColor: '#3b494b',
    borderWidth: 1,
    paddingVertical: 12,
    borderRadius: 4,
  },
  googleIconText: {
    color: '#00f0ff',
    fontWeight: '900',
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  githubIconText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  oauthBtnText: {
    color: '#dae3f0',
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 0.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(6, 15, 23, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    backgroundColor: '#131d25',
    borderColor: '#00f0ff',
    borderWidth: 1,
    borderRadius: 4,
    padding: 24,
    shadowColor: '#00f0ff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
    elevation: 10,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 20,
    letterSpacing: 1,
  },
  modalRealBtn: {
    backgroundColor: '#00f0ff',
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 4,
    marginBottom: 16,
  },
  modalRealBtnText: {
    color: '#000',
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 1,
  },
  modalDividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  modalDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(59, 73, 75, 0.4)',
  },
  modalDividerText: {
    color: '#849495',
    fontSize: 9,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    paddingHorizontal: 8,
  },
  modalLabel: {
    color: '#849495',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  modalInput: {
    backgroundColor: 'rgba(6, 15, 23, 0.8)',
    borderWidth: 1,
    borderColor: '#3b494b',
    color: '#dae3f0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 12,
    marginBottom: 16,
    borderRadius: 4,
  },
  modalActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 8,
  },
  modalCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  modalCancelBtnText: {
    color: '#849495',
    fontSize: 12,
    fontWeight: '800',
  },
  modalSubmitBtn: {
    borderColor: '#00f0ff',
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 4,
  },
  modalSubmitBtnText: {
    color: '#00f0ff',
    fontSize: 12,
    fontWeight: '800',
  },
});

