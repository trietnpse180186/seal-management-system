import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  NativeModules,
  Platform,
  ScrollView,
  TurboModuleRegistry,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../api/api';
import socketService from '../api/socketService';
import { ShieldAlert, LogIn, ArrowLeft, LogOut } from 'lucide-react-native';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import * as GoogleAuthSession from 'expo-auth-session/providers/google';

const googleServices = require('../../google-services.json');
const androidClient = googleServices.client?.[0];
const firebaseWebClientId = androidClient?.oauth_client?.find((client) => client.client_type === 3)?.client_id;
const EXPO_GOOGLE_REDIRECT_URI = 'https://auth.expo.io/@ntngoc204/mobile';

let isGoogleSigninConfigured = false;
const GOOGLE_SIGNIN_NATIVE_MODULE = 'RNGoogleSignin';

WebBrowser.maybeCompleteAuthSession();

const hasGoogleSigninNativeModule = () => {
  try {
    return Boolean(
      TurboModuleRegistry?.get?.(GOOGLE_SIGNIN_NATIVE_MODULE) ||
      NativeModules?.[GOOGLE_SIGNIN_NATIVE_MODULE]
    );
  } catch (err) {
    return Boolean(NativeModules?.[GOOGLE_SIGNIN_NATIVE_MODULE]);
  }
};

const getGoogleSigninModule = () => {
  if (!hasGoogleSigninNativeModule()) {
    return null;
  }

  const googleSigninModule = require('@react-native-google-signin/google-signin');

  if (!isGoogleSigninConfigured) {
    googleSigninModule.GoogleSignin.configure({
      webClientId: firebaseWebClientId,
      offlineAccess: false,
    });
    isGoogleSigninConfigured = true;
  }

  return googleSigninModule;
};

const getGoogleLoginErrorMessage = (err, statusCodes) => {
  const code = err?.code || err?.nativeErrorCode;
  const message = String(err?.message || '');

  if (code === statusCodes?.SIGN_IN_CANCELLED) {
    return '';
  }

  if (code === statusCodes?.IN_PROGRESS) {
    return 'Đang có một phiên đăng nhập Google đang chạy.';
  }

  if (code === statusCodes?.PLAY_SERVICES_NOT_AVAILABLE) {
    return 'Google Play Services không khả dụng hoặc cần cập nhật.';
  }

  if (
    code === 'DEVELOPER_ERROR' ||
    message.includes('DEVELOPER_ERROR') ||
    message.includes('ApiException: 10')
  ) {
    return 'Google Sign-In chưa khớp Android package/SHA-1. Kiểm tra SHA-1 trên Firebase Console.';
  }

  if (err?.response?.data?.message) {
    return err.response.data.message;
  }

  return code
    ? `Đăng nhập Google thất bại (${code}). Vui lòng thử lại.`
    : 'Đăng nhập Google thất bại. Vui lòng thử lại.';
};

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState('');
  const [sessionConflict, setSessionConflict] = useState(false);
  const [lastGoogleToken, setLastGoogleToken] = useState(null);

  const googleLoginInProgressRef = useRef(false);
  const googleLoginCompletedRef = useRef(false);

  useEffect(() => {
    const checkExistingSession = async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        const userStr = await AsyncStorage.getItem('user');
        const rolesStr = await AsyncStorage.getItem('roles');

        if (token && userStr && rolesStr) {
          const user = JSON.parse(userStr);
          const roles = JSON.parse(rolesStr);
          redirectUser(user, roles);
        }
      } catch (err) {
        console.log('Session check error:', err);
      } finally {
        setInitializing(false);
      }
    };
    checkExistingSession();
  }, []);

  const redirectUser = async (user, roles) => {
    navigation.replace('Home');
  };

  const saveSession = async ({ token, user, roles }) => {
    await AsyncStorage.setItem('token', token);
    await AsyncStorage.setItem('user', JSON.stringify(user));
    await AsyncStorage.setItem('roles', JSON.stringify(roles || []));
    await socketService.connect();
    await redirectUser(user, roles || []);
  };

  const completeGoogleLoginWithIdToken = async (idToken, force = false) => {
    if (!idToken) {
      setError('Không lấy được Google ID token. Kiểm tra google-services.json.');
      return;
    }

    try {
      const res = await api.post('/auth/google', { idToken, force });
      googleLoginCompletedRef.current = true;
      await saveSession(res.data);
    } catch (err) {
      if (err.response?.status === 409 || err.response?.data?.code === 'ACTIVE_SESSION_EXISTS') {
        setSessionConflict(true);
        setLastGoogleToken(idToken);
        setError(err.response?.data?.message || 'Tài khoản này đang được đăng nhập ở nơi khác. Vui lòng đăng xuất ở thiết bị cũ.');
      } else {
        throw err;
      }
    }
  };

  const handleExpoGoogleLogin = async () => {
    const authSessionId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const expoGoogleRequest = new AuthSession.AuthRequest({
      clientId: firebaseWebClientId,
      redirectUri: EXPO_GOOGLE_REDIRECT_URI,
      responseType: AuthSession.ResponseType.IdToken,
      scopes: ['openid', 'profile', 'email'],
      usePKCE: false,
      extraParams: {
        prompt: 'select_account',
        nonce: authSessionId,
      },
    });

    const authUrl = await expoGoogleRequest.makeAuthUrlAsync(GoogleAuthSession.discovery);
    const returnUrl = AuthSession.getDefaultReturnUrl(`expo-auth-session/${authSessionId}`);
    const startUrl = `${EXPO_GOOGLE_REDIRECT_URI}/start?authUrl=${encodeURIComponent(authUrl)}&returnUrl=${encodeURIComponent(returnUrl)}`;
    const browserResult = await WebBrowser.openAuthSessionAsync(startUrl, returnUrl);

    if (browserResult?.type === 'cancel' || browserResult?.type === 'dismiss') {
      return;
    }

    if (browserResult?.type !== 'success') {
      const authError = new Error(browserResult?.type || 'EXPO_GOOGLE_AUTH_FAILED');
      authError.code = browserResult?.type;
      throw authError;
    }

    const result = expoGoogleRequest.parseReturnUrl(browserResult.url);

    if (result?.type !== 'success') {
      const errorCode = result?.params?.error || result?.error?.code;
      const authError = new Error(errorCode || 'EXPO_GOOGLE_AUTH_FAILED');
      authError.code = errorCode;
      throw authError;
    }

    const idToken = result.params?.id_token || result.authentication?.idToken;
    await completeGoogleLoginWithIdToken(idToken);
  };

  const handleGoogleLogin = async () => {
    if (googleLoginInProgressRef.current) {
      return;
    }

    googleLoginInProgressRef.current = true;
    googleLoginCompletedRef.current = false;
    setError('');
    setLoading(true);

    let googleSigninModule;
    try {
      googleSigninModule = getGoogleSigninModule();
    } catch (err) {
      console.log('Google Sign-In native module error:', err);
      googleSigninModule = null;
    }

    if (!firebaseWebClientId) {
      setError('Không tìm thấy Firebase Web Client ID trong google-services.json.');
      googleLoginInProgressRef.current = false;
      setLoading(false);
      return;
    }

    if (!googleSigninModule) {
      try {
        await handleExpoGoogleLogin();
      } catch (err) {
        console.log('Expo Google login error:', err);
        if (!googleLoginCompletedRef.current) {
          setError(getGoogleLoginErrorMessage(err, null));
        }
      } finally {
        googleLoginInProgressRef.current = false;
        setLoading(false);
      }
      return;
    }
    const {
      GoogleSignin,
      isCancelledResponse,
      isErrorWithCode,
      statusCodes,
    } = googleSigninModule;

    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      try {
        await GoogleSignin.signOut();
      } catch (e) {
        // Bỏ qua nếu người dùng chưa từng đăng nhập trước đó
      }
      const signInResult = await GoogleSignin.signIn();

      if (isCancelledResponse(signInResult)) {
        return;
      }

      let idToken = signInResult.data?.idToken;
      if (!idToken) {
        const tokens = await GoogleSignin.getTokens();
        idToken = tokens.idToken;
      }

      await completeGoogleLoginWithIdToken(idToken);
    } catch (err) {
      console.log('Google login error:', err);

      const googleErrorMessage = getGoogleLoginErrorMessage(err, isErrorWithCode(err) ? statusCodes : null);
      if (googleErrorMessage) {
        setError(googleErrorMessage);
      }
    } finally {
      googleLoginInProgressRef.current = false;
      setLoading(false);
    }
  };

  const handleLogin = async (force = false) => {
    if (!email || !password) {
      setError('Vui lòng nhập đầy đủ thông tin đăng nhập.');
      return;
    }
    setError('');
    setSessionConflict(false);
    setLoading(true);

    try {
      const res = await api.post('/auth/login', { email, password, force });
      await saveSession(res.data);
    } catch (err) {
      console.log('Login error:', err);
      if (err.response?.status === 409 || err.response?.data?.code === 'ACTIVE_SESSION_EXISTS') {
        setSessionConflict(true);
        setError(err.response?.data?.message || 'Tài khoản này đang được đăng nhập ở nơi khác. Vui lòng đăng xuất ở thiết bị cũ.');
      } else if (err.response && err.response.data && err.response.data.message) {
        setError(err.response.data.message);
      } else {
        setError('Kết nối máy chủ thất bại. Hãy kiểm tra lại kết nối mạng.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForceLogin = async () => {
    if (lastGoogleToken) {
      setLoading(true);
      try {
        await completeGoogleLoginWithIdToken(lastGoogleToken, true);
      } catch (err) {
        setError(err.response?.data?.message || 'Không thể thực hiện đăng nhập đè.');
      } finally {
        setLoading(false);
      }
    } else {
      await handleLogin(true);
    }
  };

  if (initializing) {
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
        <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
          {/* Top Bar */}
          <View style={styles.topNav}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => navigation.navigate('Welcome')}
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
              <Text style={styles.title}>ĐĂNG NHẬP</Text>
            </View>

            {error ? (
              <View style={styles.errorAlertContainer}>
                <View style={styles.errorAlertRow}>
                  <ShieldAlert size={18} color="#ef4444" style={{ marginTop: 2 }} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>

                {sessionConflict && (
                  <TouchableOpacity
                    style={styles.forceLoginBtn}
                    onPress={handleForceLogin}
                    disabled={loading}
                    activeOpacity={0.85}
                  >
                    <LogOut size={16} color="#ffffff" style={{ marginRight: 6 }} />
                    <Text style={styles.forceLoginBtnText}>ĐĂNG XUẤT THIẾT BỊ KHÁC & ĐĂNG NHẬP</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : null}

            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="Email của bạn"
              placeholderTextColor="#94a3b8"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Text style={styles.label}>Mật khẩu</Text>
            <TextInput
              style={styles.input}
              placeholder="Mật khẩu"
              placeholderTextColor="#94a3b8"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
            />

            <TouchableOpacity
              style={styles.loginBtn}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.loginBtnText}>ĐĂNG NHẬP</Text>
              )}
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.dividerContainer}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>Hoặc đăng nhập bằng</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Google OAuth Button */}
            <TouchableOpacity
              style={styles.oauthBtn}
              onPress={handleGoogleLogin}
              disabled={loading}
              activeOpacity={0.85}
            >
              <Image
                source={require('../../assets/images.jpg')}
                style={styles.googleIconImage}
                resizeMode="contain"
              />
              <Text style={styles.oauthBtnText}>Đăng nhập với Google</Text>
            </TouchableOpacity>

            <View style={styles.registerRedirect}>
              <Text style={styles.registerRedirectText}>Chưa có tài khoản? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Register')}>
                <Text style={styles.registerRedirectLink}>Đăng ký tài khoản ngay</Text>
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
    padding: 24,
    justifyContent: 'center',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topNav: {
    marginBottom: 16,
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
    marginBottom: 28,
  },
  logoText: {
    fontSize: 40,
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
    padding: 22,
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
    marginBottom: 18,
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
    paddingVertical: 12,
    fontSize: 14,
    marginBottom: 16,
    borderRadius: 10,
  },
  loginBtn: {
    backgroundColor: '#ea580c',
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 12,
    marginTop: 4,
    shadowColor: '#ea580c',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  loginBtnText: {
    color: '#ffffff',
    fontWeight: '800',
    letterSpacing: 0.5,
    fontSize: 14,
  },
  errorAlertContainer: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  errorAlertRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  errorText: {
    color: '#dc2626',
    fontSize: 13,
    marginLeft: 8,
    flex: 1,
    lineHeight: 18,
  },
  forceLoginBtn: {
    backgroundColor: '#ea580c',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginTop: 10,
    shadowColor: '#ea580c',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  forceLoginBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e2e8f0',
  },
  dividerText: {
    color: '#64748b',
    fontSize: 11,
    paddingHorizontal: 10,
    fontWeight: '600',
  },
  oauthBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff7ed',
    borderColor: '#fed7aa',
    borderWidth: 1,
    paddingVertical: 12,
    borderRadius: 10,
  },
  googleIconImage: {
    width: 20,
    height: 20,
    marginRight: 8,
  },
  oauthBtnText: {
    color: '#ea580c',
    fontWeight: '700',
    fontSize: 13,
  },
  registerRedirect: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  registerRedirectText: {
    color: '#64748b',
    fontSize: 13,
  },
  registerRedirectLink: {
    color: '#ea580c',
    fontSize: 13,
    fontWeight: '700',
  },
});
