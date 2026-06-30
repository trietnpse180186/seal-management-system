import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import apiClient from '../api/apiClient';

export default function SampleLoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Thông báo', 'Vui lòng nhập đầy đủ email và mật khẩu.');
      return;
    }

    setLoading(true);
    try {
      // Gọi API qua client trung gian
      const response = await apiClient.post('/auth/login', {
        email: email.trim(),
        password: password.trim(),
      });

      Alert.alert('Thành công', 'Đăng nhập thành công!');
      console.log('User Data:', response.data);
    } catch (error) {
      /**
       * DECOUPLED UI (TÁCH BIỆT HOÀN TOÀN LOGIC):
       * Khối catch ở giao diện cực kỳ sạch sẽ. UI chỉ làm nhiệm vụ duy nhất là
       * nhận error.message đã được Việt hóa và hiển thị ra màn hình cho người dùng.
       * 
       * Không hề có code kiểm tra Axios thô như:
       * if (error.response.status === 409) ...
       */
      Alert.alert('Lỗi đăng nhập', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Đăng Nhập Hệ Thống</Text>
      
      <TextInput
        style={styles.input}
        placeholder="Nhập email..."
        placeholderTextColor="#849495"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />

      <TextInput
        style={styles.input}
        placeholder="Nhập mật khẩu..."
        placeholderTextColor="#849495"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#000" size="small" />
        ) : (
          <Text style={styles.buttonText}>ĐĂNG NHẬP</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a141d',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 24,
    color: '#00f0ff',
  },
  input: {
    backgroundColor: '#131d25',
    borderWidth: 1,
    borderColor: '#3b494b',
    color: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 6,
    marginBottom: 16,
    fontSize: 14,
  },
  button: {
    backgroundColor: '#00f0ff',
    paddingVertical: 14,
    borderRadius: 6,
    alignItems: 'center',
  },
  buttonText: {
    color: '#000',
    fontWeight: '800',
    fontSize: 14,
  },
});
