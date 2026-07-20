import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Home, Award, Users, ClipboardList } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../api/api';

export default function BottomTabs({ activeTab, navigation }) {
  const insets = useSafeAreaInsets();
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
          const isJudge = roles.some((r) => r.role === 'judge') || isSystemAdmin;

          if (isJudge) {
            setRole('judge');
          } else {
            setRole('participant');
          }
        }
      } catch (err) {
        console.error('Lỗi khi tải vai trò người dùng:', err);
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
        if (res.data && res.data.team) {
          navigation.navigate('TeamArea');
        } else {
          navigation.navigate('RegisterTeam');
        }
      } catch (err) {
        navigation.navigate('RegisterTeam');
      }
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingBottom: insets.bottom || 4, height: 56 + (insets.bottom || 0) }]}>
        <ActivityIndicator color="#ea580c" size="small" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom || 4, height: 56 + (insets.bottom || 0) }]}>
      {/* Tab 1: Trang chủ */}
      <TouchableOpacity
        style={styles.tab}
        onPress={() => navigation.navigate('Home')}
        activeOpacity={0.7}
      >
        <Home
          size={20}
          color={activeTab === 'home' ? '#ea580c' : '#64748b'}
        />
        <Text
          style={[
            styles.label,
            { color: activeTab === 'home' ? '#ea580c' : '#64748b' },
          ]}
        >
          Trang chủ
        </Text>
      </TouchableOpacity>

      {/* Tab 2: Đội thi (hoặc Chấm điểm nếu là Giám khảo) */}
      <TouchableOpacity
        style={styles.tab}
        onPress={handleTeamTabPress}
        activeOpacity={0.7}
      >
        {role === 'judge' ? (
          <>
            <ClipboardList
              size={20}
              color={activeTab === 'judge' ? '#ea580c' : '#64748b'}
            />
            <Text
              style={[
                styles.label,
                { color: activeTab === 'judge' ? '#ea580c' : '#64748b' },
              ]}
            >
              Chấm điểm
            </Text>
          </>
        ) : (
          <>
            <Users
              size={20}
              color={activeTab === 'team' ? '#ea580c' : '#64748b'}
            />
            <Text
              style={[
                styles.label,
                { color: activeTab === 'team' ? '#ea580c' : '#64748b' },
              ]}
            >
              Đội thi
            </Text>
          </>
        )}
      </TouchableOpacity>

      {/* Tab 3: Thành tích */}
      <TouchableOpacity
        style={styles.tab}
        onPress={() => navigation.navigate('MyAchievements')}
        activeOpacity={0.7}
      >
        <Award
          size={20}
          color={activeTab === 'achievements' ? '#ea580c' : '#64748b'}
        />
        <Text
          style={[
            styles.label,
            { color: activeTab === 'achievements' ? '#ea580c' : '#64748b' },
          ]}
        >
          Thành tích
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    height: 60,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingBottom: 4,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 8,
  },
  tab: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingVertical: 4,
  },
  label: {
    fontSize: 11,
    marginTop: 3,
    fontWeight: '700',
  },
});
