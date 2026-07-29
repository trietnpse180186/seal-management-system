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
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../api/api';
import BottomTabs from '../components/BottomTabs';
import HeaderAvatar from '../components/HeaderAvatar';
import socketService from '../api/socketService';
import { ClipboardList, ArrowRight, MessageSquare, ShieldAlert, Award, Calendar, Layers } from 'lucide-react-native';

export default function JudgeDashboardScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const [isJudge, setIsJudge] = useState(false);
  const [activeEvent, setActiveEvent] = useState(null);
  const [currentRound, setCurrentRound] = useState(null);
  const [assignedTrack, setAssignedTrack] = useState(null);

  const [teams, setTeams] = useState([]);
  const [teamGrades, setTeamGrades] = useState({});

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const userStr = await AsyncStorage.getItem('user');
      const rolesStr = await AsyncStorage.getItem('roles');

      const user = userStr ? JSON.parse(userStr) : null;
      const roles = rolesStr ? JSON.parse(rolesStr) : [];

      const isSystemAdmin = !!user?.isSystemAdmin;
      const hasJudgeRole = roles.some((r) => r.role === 'judge') || isSystemAdmin;

      setIsJudge(hasJudgeRole);

      if (!hasJudgeRole) {
        setLoading(false);
        return;
      }

      // 1. Tải thông tin cuộc thi đang diễn ra & vòng thi hiện tại
      const contestRes = await api.get('/events/judge/active-contest');
      const eventData = contestRes.data?.event;
      const roundData = contestRes.data?.currentRound;
      const trackData = contestRes.data?.assignedTrack;

      setActiveEvent(eventData || null);
      setCurrentRound(roundData || null);
      setAssignedTrack(trackData || null);

      if (eventData && roundData) {
        // 2. Tải danh sách đội thi cần chấm trong vòng thi & bảng đấu được phân công
        const teamsRes = await api.get(
          `/teams/all/${eventData._id}?roundId=${roundData._id}&role=judge`
        );
        const confirmedTeams = (teamsRes.data || []).filter((t) => t.status === 'confirmed');
        setTeams(confirmedTeams);

        // 3. Kiểm tra trạng thái đã chấm/chưa chấm & lưu số điểm từng đội
        const gradesMap = {};
        for (const t of confirmedTeams) {
          try {
            const resGrade = await api.get(`/grades/team/${t._id}/round/${roundData._id}`);
            if (resGrade.data && resGrade.data.score) {
              const scoreObj = resGrade.data.score;
              const maxScoreScale = resGrade.data.rubric?.maxCriterionScore || (resGrade.data.criteria?.[0]?.maxScore) || 5;
              gradesMap[t._id] = {
                isGraded: true,
                scoreValue: scoreObj.totalWeightedScore,
                maxScoreScale,
              };
            } else {
              gradesMap[t._id] = { isGraded: false };
            }
          } catch (err) {
            gradesMap[t._id] = { isGraded: false };
          }
        }
        setTeamGrades(gradesMap);
      } else {
        setTeams([]);
        setTeamGrades({});
      }
    } catch (err) {
      console.warn('Lỗi khi tải thông tin Bàn giám khảo:', err.message || err);
      setTeams([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Tự động làm mới dữ liệu và cập nhật số điểm/trạng thái mỗi khi màn hình quay trở lại focus
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  useEffect(() => {
    const initSocket = async () => {
      await socketService.connect();
      socketService.on('new_message', () => {
        setUnreadCount((prev) => prev + 1);
      });
    };
    initSocket();

    return () => {
      socketService.off('new_message');
    };
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const renderTeamItem = ({ item }) => {
    const gradeInfo = teamGrades[item._id] || {};
    const isGraded = gradeInfo.isGraded;

    return (
      <View style={styles.card}>
        <View style={styles.cardLeft}>
          <Text style={styles.teamName}>{item.name}</Text>
          <Text style={styles.trackName}>
            Bảng: {item.trackId?.name || assignedTrack?.name || 'Mặc định'}
          </Text>
          {item.topicTitle ? (
            <Text style={styles.topicTitle} numberOfLines={1}>
              Đề tài: {item.topicTitle}
            </Text>
          ) : null}

          {/* Hiển thị Điểm đã chấm ngay trên thẻ đội thi */}
          {isGraded && gradeInfo.scoreValue !== undefined ? (
            <View style={styles.gradedScoreRow}>
              <Award size={14} color="#ea580c" />
              <Text style={styles.gradedScoreText}>
                Điểm đã chấm: <Text style={styles.gradedScoreNum}>{gradeInfo.scoreValue}/{gradeInfo.maxScoreScale || 5} đ</Text>
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.cardRight}>
          <View
            style={[
              styles.statusBadge,
              isGraded ? styles.statusBadgeGraded : styles.statusBadgePending,
            ]}
          >
            <Text
              style={[
                styles.statusBadgeText,
                isGraded ? styles.statusBadgeTextGraded : styles.statusBadgeTextPending,
              ]}
            >
              {isGraded ? 'ĐÃ CHẤM' : 'CHƯA CHẤM'}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.gradeBtn}
            onPress={() =>
              navigation.navigate('JudgeScoring', {
                teamId: item._id,
                roundId: currentRound?._id,
                teamName: item.name,
              })
            }
            activeOpacity={0.85}
          >
            <Text style={styles.gradeBtnText}>
              {isGraded ? 'SỬA ĐIỂM' : 'CHẤM ĐIỂM'}
            </Text>
            <ArrowRight size={14} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.container}>
        {/* Header Bar */}
        <View style={styles.headerBar}>
          <View style={styles.headerTitleRow}>
            <ClipboardList size={22} color="#ea580c" />
            <Text style={styles.headerTitle}>BÀN GIÁM KHẢO</Text>
          </View>

          <View style={styles.headerRightActions}>
            <TouchableOpacity
              style={styles.chatHeaderBtn}
              onPress={() => {
                setUnreadCount(0);
                navigation.navigate('Chat');
              }}
              activeOpacity={0.7}
            >
              <MessageSquare size={22} color="#ea580c" />
              {unreadCount > 0 && (
                <View style={styles.headerBadge}>
                  <Text style={styles.headerBadgeText}>{unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
            <HeaderAvatar navigation={navigation} />
          </View>
        </View>

        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#ea580c" />
            <Text style={styles.loadingText}>Đang tải danh sách phân công chấm điểm...</Text>
          </View>
        ) : !isJudge ? (
          <View style={styles.centerContainer}>
            <ShieldAlert size={48} color="#94a3b8" />
            <Text style={styles.unassignedTitle}>Chưa được phân công Giám khảo</Text>
            <Text style={styles.unassignedSub}>
              Tài khoản của bạn hiện chưa được ban tổ chức phân công chấm điểm cho bất kỳ bảng đấu hoặc cuộc thi nào.
            </Text>
          </View>
        ) : !activeEvent ? (
          <View style={styles.centerContainer}>
            <Calendar size={48} color="#cbd5e1" />
            <Text style={styles.unassignedTitle}>Không có cuộc thi nào đang diễn ra</Text>
            <Text style={styles.unassignedSub}>
              Hiện không có cuộc thi nào ở trạng thái Đang diễn ra (Active) mà bạn được phân công.
            </Text>
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            {/* Thẻ Thông Tin Cuộc Thi & Vòng Thi Active */}
            <View style={styles.eventBanner}>
              <Text style={styles.eventName}>{activeEvent.name}</Text>
              <View style={styles.eventMetaRow}>
                {currentRound ? (
                  <View style={styles.roundChip}>
                    <Layers size={12} color="#c2410c" />
                    <Text style={styles.roundChipText}>Vòng: {currentRound.name}</Text>
                  </View>
                ) : null}
                {assignedTrack ? (
                  <View style={styles.trackChip}>
                    <Text style={styles.trackChipText}>Bảng: {assignedTrack.name}</Text>
                  </View>
                ) : null}
              </View>
            </View>

            {/* Danh sách các Đội thi cần chấm */}
            <FlatList
              data={teams}
              renderItem={renderTeamItem}
              keyExtractor={(item) => item._id}
              contentContainerStyle={styles.listContent}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#ea580c']} />
              }
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Award size={40} color="#cbd5e1" />
                  <Text style={styles.emptyText}>Chưa có đội thi nào trong bảng đấu này.</Text>
                </View>
              }
            />
          </View>
        )}

        {/* Dynamic Staff Bottom Bar */}
        <BottomTabs navigation={navigation} activeTab="JudgeDashboard" />
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
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  chatHeaderBtn: {
    position: 'relative',
    padding: 4,
  },
  headerBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#ef4444',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  headerBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '800',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  loadingText: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 12,
  },
  unassignedTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#334155',
    marginTop: 12,
    textAlign: 'center',
  },
  unassignedSub: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  eventBanner: {
    backgroundColor: '#fff7ed',
    borderBottomWidth: 1,
    borderBottomColor: '#ffedd5',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  eventName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#9a3412',
  },
  eventMetaRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  roundChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ffedd5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  roundChipText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#c2410c',
  },
  trackChip: {
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#bae6fd',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  trackChipText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0284c7',
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardLeft: {
    flex: 1,
    paddingRight: 8,
  },
  teamName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  trackName: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  topicTitle: {
    fontSize: 11,
    color: '#475569',
    marginTop: 4,
  },
  gradedScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#ffedd5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  gradedScoreText: {
    fontSize: 11,
    color: '#9a3412',
    fontWeight: '600',
  },
  gradedScoreNum: {
    fontSize: 12,
    fontWeight: '900',
    color: '#ea580c',
  },
  cardRight: {
    alignItems: 'flex-end',
    gap: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusBadgeGraded: {
    backgroundColor: '#dcfce7',
  },
  statusBadgePending: {
    backgroundColor: '#fee2e2',
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  statusBadgeTextGraded: {
    color: '#16a34a',
  },
  statusBadgeTextPending: {
    color: '#dc2626',
  },
  gradeBtn: {
    backgroundColor: '#ea580c',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  gradeBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 8,
  },
});
