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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import api from '../api/api';
import socketService from '../api/socketService';
import { firebaseAuth, firebaseWebClientId } from '../config/firebase';
import { ShieldAlert } from 'lucide-react-native';

let isGoogleSigninConfigured = false;

const getGoogleSigninModule = () => {
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

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState('');

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

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);

    let googleSigninModule;
    try {
      googleSigninModule = getGoogleSigninModule();
    } catch (err) {
      console.log('Google Sign-In native module error:', err);
      setError('Google native login chi hoat dong tren APK/EAS development build, khong ho tro Expo Go.');
      setLoading(false);
      return;
    }

    const {
      GoogleSignin,
      isCancelledResponse,
      isErrorWithCode,
      statusCodes,
    } = googleSigninModule;

    try {
      if (!firebaseWebClientId) {
        setError('Khong tim thay Firebase Web Client ID trong google-services.json.');
        return;
      }

      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const signInResult = await GoogleSignin.signIn();

      if (isCancelledResponse(signInResult)) {
        return;
      }

      let idToken = signInResult.data?.idToken;
      if (!idToken) {
        const tokens = await GoogleSignin.getTokens();
        idToken = tokens.idToken;
      }

      if (!idToken) {
        setError('Khong lay duoc Google ID token. Hay kiem tra Firebase Google Auth.');
        return;
      }

      const googleCredential = GoogleAuthProvider.credential(idToken);
      const firebaseCredential = await signInWithCredential(firebaseAuth, googleCredential);
      const firebaseIdToken = await firebaseCredential.user.getIdToken();

      const res = await api.post('/auth/firebase-google', { firebaseIdToken });
      await saveSession(res.data);
    } catch (err) {
      console.log('Google login error:', err);

      if (isErrorWithCode(err)) {
        if (err.code === statusCodes.IN_PROGRESS) {
          setError('Dang co mot phien dang nhap Google dang chay.');
          return;
        }

        if (err.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
          setError('Google Play Services khong kha dung hoac can cap nhat.');
          return;
        }
      }

      if (err.response?.data?.message) {
        setError(err.response.data.message);
      } else {
        setError('Dang nhap Google that bai. Vui long thu lai.');
      }
    } finally {
      setLoading(false);
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
      await saveSession(res.data);
    } catch (err) {
      console.log('Login error:', err);
      if (err.response && err.response.data && err.response.data.message) {
        setError(err.response.data.message);
      } else {
        setError('Kết nối máy chủ thất bại. Hãy kiểm tra địa chỉ API của bạn.');
      }
    } finally {
      setLoading(false);
    }
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

            {/* Nút bấm Google */}
            <View style={styles.oauthRow}>
              <TouchableOpacity
                style={styles.oauthBtn}
                onPress={handleGoogleLogin}
                disabled={loading}
              >
                <Text style={[styles.googleIconText, { marginRight: 8 }]}>[G]</Text>
                <Text style={styles.oauthBtnText}>Google</Text>
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
  oauthBtnText: {
    color: '#dae3f0',
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 0.5,
  },
});

