import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Home, Award, Users, ClipboardList } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../api/api';

export default function BottomTabs({ activeTab, navigation }) {
  const insets = useSafeAreaInsets();
  const [isStaff, setIsStaff] = useState(
    activeTab === 'judge' ||
    activeTab === 'JudgeDashboard' ||
    activeTab === 'mentor' ||
    activeTab === 'MentorDashboard'
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkRole = async () => {
      try {
        const userStr = await AsyncStorage.getItem('user');
        const rolesStr = await AsyncStorage.getItem('roles');

        let isStaffRole = false;

        if (userStr) {
          const user = JSON.parse(userStr);
          const roles = rolesStr ? JSON.parse(rolesStr) : [];

          const isSystemAdmin = !!user?.isSystemAdmin;
          const isJudge = roles.some((r) => r.role === 'judge');
          const isMentor = roles.some((r) => r.role === 'mentor');

          isStaffRole = isJudge || isMentor || isSystemAdmin;
        }

        // Nếu đang ở các màn hình của Giám khảo / Mentor, ép buộc là Staff
        if (
          activeTab === 'judge' ||
          activeTab === 'JudgeDashboard' ||
          activeTab === 'mentor' ||
          activeTab === 'MentorDashboard'
        ) {
          isStaffRole = true;
        }

        // Nếu chưa rõ, gọi API profile để chắc chắn
        if (!isStaffRole) {
          try {
            const profileRes = await api.get('/users/profile');
            if (profileRes.data) {
              const u = profileRes.data.user;
              const rList = profileRes.data.roles || [];
              if (u?.isSystemAdmin || rList.some((r) => r.role === 'judge' || r.role === 'mentor')) {
                isStaffRole = true;
                if (rList.length > 0) {
                  await AsyncStorage.setItem('roles', JSON.stringify(rList));
                }
              }
            }
          } catch (e) {
            // ignore
          }
        }

        setIsStaff(isStaffRole);
      } catch (err) {
        console.error('Lỗi khi tải vai trò người dùng:', err);
      } finally {
        setLoading(false);
      }
    };
    checkRole();
  }, [activeTab]);

  const handleTeamTabPress = async () => {
    if (
      isStaff ||
      activeTab === 'judge' ||
      activeTab === 'JudgeDashboard' ||
      activeTab === 'mentor' ||
      activeTab === 'MentorDashboard'
    ) {
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

  const handleTab3Press = () => {
    if (
      isStaff ||
      activeTab === 'judge' ||
      activeTab === 'JudgeDashboard' ||
      activeTab === 'mentor' ||
      activeTab === 'MentorDashboard'
    ) {
      navigation.navigate('MentorDashboard');
    } else {
      navigation.navigate('MyAchievements');
    }
  };

  if (loading && !isStaff) {
    return (
      <View style={[styles.container, { paddingBottom: insets.bottom || 4, height: 56 + (insets.bottom || 0) }]}>
        <ActivityIndicator color="#ea580c" size="small" />
      </View>
    );
  }

  const isHomeActive = activeTab === 'home' || activeTab === 'Home';
  const isJudgeActive = activeTab === 'judge' || activeTab === 'JudgeDashboard';
  const isTeamActive = activeTab === 'team' || activeTab === 'Team' || activeTab === 'TeamArea';
  const isMentorActive = activeTab === 'mentor' || activeTab === 'MentorDashboard';
  const isAchievementsActive = activeTab === 'achievements' || activeTab === 'MyAchievements';

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
          color={isHomeActive ? '#ea580c' : '#64748b'}
        />
        <Text
          style={[
            styles.label,
            { color: isHomeActive ? '#ea580c' : '#64748b' },
          ]}
        >
          Trang chủ
        </Text>
      </TouchableOpacity>

      {/* Tab 2: Đội thi (hoặc Chấm điểm nếu là Giám khảo/Mentor) */}
      <TouchableOpacity
        style={styles.tab}
        onPress={handleTeamTabPress}
        activeOpacity={0.7}
      >
        {isStaff ? (
          <>
            <ClipboardList
              size={20}
              color={isJudgeActive ? '#ea580c' : '#64748b'}
            />
            <Text
              style={[
                styles.label,
                { color: isJudgeActive ? '#ea580c' : '#64748b' },
              ]}
            >
              Chấm điểm
            </Text>
          </>
        ) : (
          <>
            <Users
              size={20}
              color={isTeamActive ? '#ea580c' : '#64748b'}
            />
            <Text
              style={[
                styles.label,
                { color: isTeamActive ? '#ea580c' : '#64748b' },
              ]}
            >
              Đội thi
            </Text>
          </>
        )}
      </TouchableOpacity>

      {/* Tab 3: Thành tích (hoặc Hướng dẫn Đội nếu là Giám khảo/Mentor) */}
      <TouchableOpacity
        style={styles.tab}
        onPress={handleTab3Press}
        activeOpacity={0.7}
      >
        {isStaff ? (
          <>
            <Users
              size={20}
              color={isMentorActive ? '#ea580c' : '#64748b'}
            />
            <Text
              style={[
                styles.label,
                { color: isMentorActive ? '#ea580c' : '#64748b' },
              ]}
            >
              Hướng dẫn Đội
            </Text>
          </>
        ) : (
          <>
            <Award
              size={20}
              color={isAchievementsActive ? '#ea580c' : '#64748b'}
            />
            <Text
              style={[
                styles.label,
                { color: isAchievementsActive ? '#ea580c' : '#64748b' },
              ]}
            >
              Thành tích
            </Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  label: {
    fontSize: 10,
    marginTop: 2,
    fontWeight: '700',
  },
});
