import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Home, Trophy, Users, ClipboardList, User, LogOut } from 'lucide-react-native';
import api from '../api/api';
import socketService from '../api/socketService';

export default function BottomTabs({ activeTab, navigation }) {
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkRole = async () => {
      try {
        const userStr = await AsyncStorage.getItem('user');
        const rolesStr = await AsyncStorage.getItem('roles');
        if (userStr && rolesStr) {
          const user = JSON.parse(userStr);
          const roles = JSON.parse(rolesStr);
          
          const isSystemAdmin = user.isSystemAdmin;
          const isCoordinator = roles.some((r) => r.role === 'coordinator') || isSystemAdmin;
          const isJudge = roles.some((r) => r.role === 'judge') || isSystemAdmin;
          
          if (isJudge) {
            setRole('judge');
          } else {
            setRole('participant');
          }
        }
      } catch (err) {
        console.error('Lỗi khi tải vai trò của người dùng', err);
      } finally {
        setLoading(false);
      }
    };
    checkRole();
  }, []);

  const handleTeamTabPress = async () => {
    if (role === 'judge') {
      navigation.navigate('JudgeDashboard');
    } else {
      try {
        const res = await api.get('/teams/my-team');
        if (res.data.team) {
          navigation.navigate('TeamArea');
        } else {
          navigation.navigate('RegisterTeam');
        }
      } catch (err) {
        navigation.navigate('RegisterTeam');
      }
    }
  };

  const handleLogout = () => {
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
                routes: [{ name: 'Login' }],
              });
            } catch (err) {
              console.error('Lỗi khi đăng xuất:', err);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color="#00f0ff" size="small" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Tab Trang Chủ */}
      <TouchableOpacity
        style={styles.tab}
        onPress={() => navigation.navigate('Home')}
      >
        <Home
          size={20}
          color={activeTab === 'home' ? '#00f0ff' : '#849495'}
        />
        <Text
          style={[
            styles.label,
            { color: activeTab === 'home' ? '#00f0ff' : '#849495' },
          ]}
        >
          Trang chủ
        </Text>
      </TouchableOpacity>

      {/* Tab Bảng Xếp Hạng */}
      <TouchableOpacity
        style={styles.tab}
        onPress={() => navigation.navigate('Leaderboard')}
      >
        <Trophy
          size={20}
          color={activeTab === 'leaderboard' ? '#00f0ff' : '#849495'}
        />
        <Text
          style={[
            styles.label,
            { color: activeTab === 'leaderboard' ? '#00f0ff' : '#849495' },
          ]}
        >
          Xếp hạng
        </Text>
      </TouchableOpacity>

      {/* Tab Đội của tôi / Bàn Giám khảo */}
      <TouchableOpacity style={styles.tab} onPress={handleTeamTabPress}>
        {role === 'judge' ? (
          <>
            <ClipboardList
              size={20}
              color={activeTab === 'judge' ? '#00f0ff' : '#849495'}
            />
            <Text
              style={[
                styles.label,
                { color: activeTab === 'judge' ? '#00f0ff' : '#849495' },
              ]}
            >
              Chấm điểm
            </Text>
          </>
        ) : (
          <>
            <Users
              size={20}
              color={activeTab === 'team' ? '#00f0ff' : '#849495'}
            />
            <Text
              style={[
                styles.label,
                { color: activeTab === 'team' ? '#00f0ff' : '#849495' },
              ]}
            >
              Đội thi
            </Text>
          </>
        )}
      </TouchableOpacity>

      {/* Tab Cá Nhân */}
      <TouchableOpacity
        style={styles.tab}
        onPress={() => navigation.navigate('Profile')}
      >
        <User
          size={20}
          color={activeTab === 'profile' ? '#00f0ff' : '#849495'}
        />
        <Text
          style={[
            styles.label,
            { color: activeTab === 'profile' ? '#00f0ff' : '#849495' },
          ]}
        >
          Cá nhân
        </Text>
      </TouchableOpacity>

      {/* Tab Đăng xuất */}
      <TouchableOpacity
        style={styles.tab}
        onPress={handleLogout}
      >
        <LogOut
          size={20}
          color="#ff3b30"
        />
        <Text
          style={[
            styles.label,
            { color: '#ff3b30' },
          ]}
        >
          Đăng xuất
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    height: 60,
    backgroundColor: '#0a141d',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingBottom: 5,
  },
  tab: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingVertical: 5,
  },
  label: {
    fontSize: 10,
    marginTop: 4,
    fontWeight: '600',
  },
});
