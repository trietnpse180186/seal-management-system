import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../api/api';
import BottomTabs from '../components/BottomTabs';
import HeaderAvatar from '../components/HeaderAvatar';
import { Users, MessageSquare, ShieldAlert, Calendar, Award, UserCheck } from 'lucide-react-native';

export default function MentorDashboardScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [isMentor, setIsMentor] = useState(false);
  const [activeEvent, setActiveEvent] = useState(null);
  const [teams, setTeams] = useState([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const userStr = await AsyncStorage.getItem('user');
      const rolesStr = await AsyncStorage.getItem('roles');

      const user = userStr ? JSON.parse(userStr) : null;
      const roles = rolesStr ? JSON.parse(rolesStr) : [];

      const isSystemAdmin = !!user?.isSystemAdmin;
      const hasMentorRole = roles.some((r) => r.role === 'mentor') || isSystemAdmin;

      setIsMentor(hasMentorRole);

      if (!hasMentorRole) {
        setLoading(false);
        return;
      }

      // 1. Tải cuộc thi đang diễn ra
      const contestRes = await api.get('/events/judge/active-contest');
      const eventData = contestRes.data?.event;
      setActiveEvent(eventData || null);

      if (eventData) {
        // 2. Tải danh sách đội thi do Mentor hướng dẫn
        const teamsRes = await api.get(`/teams/all/${eventData._id}?role=mentor`);
        const confirmedTeams = (teamsRes.data || []).filter((t) => t.status === 'confirmed');
        setTeams(confirmedTeams);
      } else {
        setTeams([]);
      }
    } catch (err) {
      console.warn('Lỗi khi tải thông tin Mentor Dashboard:', err.message || err);
      setTeams([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const renderTeamItem = ({ item }) => {
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('MentorTeamDetail', { teamId: item._id })}
        activeOpacity={0.88}
      >
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <View style={styles.trackBadge}>
              <Text style={styles.trackBadgeText}>
                Bảng: {item.trackId?.name || 'Chưa phân bảng'}
              </Text>
            </View>
            <Text style={styles.teamName}>{item.name}</Text>
          </View>

          <TouchableOpacity
            style={styles.chatBtn}
            onPress={() => navigation.navigate('Chat')}
            activeOpacity={0.8}
          >
            <MessageSquare size={16} color="#ffffff" />
            <Text style={styles.chatBtnText}>Nhắn tin</Text>
          </TouchableOpacity>
        </View>

        {item.topicTitle ? (
          <View style={styles.topicBox}>
            <Text style={styles.topicLabel}>Đề tài:</Text>
            <Text style={styles.topicText}>{item.topicTitle}</Text>
          </View>
        ) : null}

        <View style={styles.divider} />

        <View style={styles.membersSection}>
          <View style={styles.membersHeader}>
            <Users size={14} color="#ea580c" />
            <Text style={styles.membersTitle}>THÀNH VIÊN ĐỘI THI ({item.members?.length || 0})</Text>
          </View>
          <View style={styles.membersGrid}>
            {(item.members || []).map((m, idx) => {
              const name = m.userId?.fullName || m.fullName || 'Thành viên';
              const email = m.userId?.email || m.email || '';
              return (
                <View key={idx} style={styles.memberChip}>
                  <Text style={styles.memberName}>{name}</Text>
                  {email ? (
                    <Text style={styles.memberEmail} numberOfLines={1}>
                      {email}
                    </Text>
                  ) : null}
                </View>
              );
            })}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.container}>
        {/* Header Bar */}
        <View style={styles.headerBar}>
          <View style={styles.headerTitleRow}>
            <UserCheck size={22} color="#ea580c" />
            <Text style={styles.headerTitle}>HƯỚNG DẪN ĐỘI</Text>
          </View>
          <HeaderAvatar navigation={navigation} />
        </View>

        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color="#ea580c" />
            <Text style={styles.loadingText}>Đang tải danh sách đội hướng dẫn...</Text>
          </View>
        ) : !isMentor ? (
          /* Thông báo khi không có vai trò Mentor */
          <View style={styles.emptyCard}>
            <ShieldAlert size={52} color="#94a3b8" />
            <Text style={styles.emptyTitle}>Chưa được phân công làm Mentor</Text>
            <Text style={styles.emptySub}>
              Tài khoản của bạn chưa được phân công làm Mentor hướng dẫn cho cuộc thi này.
            </Text>
          </View>
        ) : !activeEvent ? (
          /* Không có cuộc thi nào đang diễn ra */
          <View style={styles.emptyCard}>
            <Calendar size={52} color="#94a3b8" />
            <Text style={styles.emptyTitle}>Không có cuộc thi nào đang diễn ra</Text>
            <Text style={styles.emptySub}>
              Hiện tại chưa có cuộc thi Hackathon nào được kích hoạt trạng thái đang diễn ra.
            </Text>
          </View>
        ) : (
          /* Danh sách Đội Thi hướng dẫn */
          <View style={styles.contentContainer}>
            {/* Banner Cuộc thi */}
            <View style={styles.eventBanner}>
              <View style={styles.bannerRow}>
                <Award size={20} color="#ea580c" />
                <Text style={styles.bannerEventName}>{activeEvent.name}</Text>
              </View>
              <Text style={styles.bannerMeta}>
                Kỳ {activeEvent.semester} {activeEvent.year} • Trạng thái: Đang diễn ra
              </Text>
            </View>

            {teams.length === 0 ? (
              <View style={styles.emptyCard}>
                <Users size={48} color="#cbd5e1" />
                <Text style={styles.emptyTitle}>Chưa có đội thi nào</Text>
                <Text style={styles.emptySub}>
                  Bạn chưa được phân công hướng dẫn đội thi nào trong cuộc thi này.
                </Text>
              </View>
            ) : (
              <FlatList
                data={teams}
                keyExtractor={(item) => item._id}
                renderItem={renderTeamItem}
                refreshControl={
                  <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#ea580c']} />
                }
                contentContainerStyle={styles.listPadding}
                showsVerticalScrollIndicator={false}
              />
            )}
          </View>
        )}

        <BottomTabs activeTab="mentor" navigation={navigation} />
      </View>
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
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: 0.5,
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  emptyCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#334155',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySub: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  contentContainer: {
    flex: 1,
  },
  eventBanner: {
    backgroundColor: '#fff7ed',
    borderBottomWidth: 1,
    borderBottomColor: '#ffedd5',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  bannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bannerEventName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ea580c',
  },
  bannerMeta: {
    fontSize: 12,
    color: '#9a3412',
    marginTop: 2,
  },
  listPadding: {
    padding: 16,
    paddingBottom: 24,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  trackBadge: {
    backgroundColor: '#f1f5f9',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 4,
  },
  trackBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  teamName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  chatBtn: {
    backgroundColor: '#ea580c',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  chatBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  topicBox: {
    marginTop: 10,
    backgroundColor: '#f8fafc',
    padding: 8,
    borderRadius: 6,
  },
  topicLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
  },
  topicText: {
    fontSize: 13,
    color: '#1e293b',
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 12,
  },
  membersSection: {},
  membersHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  membersTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.5,
  },
  membersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  memberChip: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    maxWidth: '48%',
  },
  memberName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1e293b',
  },
  memberEmail: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 1,
  },
});
