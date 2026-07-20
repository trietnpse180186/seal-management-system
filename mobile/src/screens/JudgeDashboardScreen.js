import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../api/api';
import BottomTabs from '../components/BottomTabs';
import HeaderAvatar from '../components/HeaderAvatar';
import socketService from '../api/socketService';
import { ClipboardList, ArrowRight, MessageSquare } from 'lucide-react-native';

export default function JudgeDashboardScreen({ navigation }) {
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [rounds, setRounds] = useState([]);
  const [selectedRoundId, setSelectedRoundId] = useState('');

  const [teams, setTeams] = useState([]);
  const [teamGrades, setTeamGrades] = useState({});

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchEvents = async () => {
    try {
      const res = await api.get('/events');
      setEvents(res.data);
      if (res.data.length > 0) {
        setSelectedEventId(res.data[0]._id);
      }
    } catch (err) {
      console.error('Lỗi khi tải danh sách sự kiện', err);
    }
  };

  const fetchRounds = async (eventId) => {
    try {
      const res = await api.get(`/events/${eventId}`);
      const roundList = res.data.rounds || [];
      setRounds(roundList);
      if (roundList.length > 0) {
        setSelectedRoundId(roundList[0]._id);
      } else {
        setSelectedRoundId('');
        setTeams([]);
      }
    } catch (err) {
      console.error('Lỗi khi tải vòng thi', err);
    }
  };

  const fetchTeamsAndGrades = async (eventId, roundId) => {
    if (!eventId || !roundId) return;
    setLoading(true);
    try {
      const resTeams = await api.get(`/teams?eventId=${eventId}`);
      const teamsList = resTeams.data || [];

      const gradesMap = {};
      for (const t of teamsList) {
        try {
          const resGrade = await api.get(`/grades/team/${t._id}/round/${roundId}`);
          gradesMap[t._id] = !!resGrade.data.grade;
        } catch (err) {
          gradesMap[t._id] = false;
        }
      }

      setTeams(teamsList);
      setTeamGrades(gradesMap);
    } catch (err) {
      console.error('Lỗi khi tải danh sách đội thi', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();

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

  useEffect(() => {
    if (selectedEventId) {
      fetchRounds(selectedEventId);
    }
  }, [selectedEventId]);

  useEffect(() => {
    if (selectedEventId && selectedRoundId) {
      fetchTeamsAndGrades(selectedEventId, selectedRoundId);
    }
  }, [selectedEventId, selectedRoundId]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (selectedEventId && selectedRoundId) {
      await fetchTeamsAndGrades(selectedEventId, selectedRoundId);
    }
    setRefreshing(false);
  }, [selectedEventId, selectedRoundId]);

  const renderTeamItem = ({ item }) => {
    const isGraded = teamGrades[item._id];

    return (
      <View style={styles.card}>
        <View style={styles.cardLeft}>
          <Text style={styles.teamName}>{item.name}</Text>
          <Text style={styles.trackName}>
            Bảng: {item.trackId?.name || 'Chưa xếp bảng'}
          </Text>
          {item.topicTitle ? (
            <Text style={styles.topicTitle} numberOfLines={1}>
              Đề tài: {item.topicTitle}
            </Text>
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
                isGraded
                  ? styles.statusBadgeTextGraded
                  : styles.statusBadgeTextPending,
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
                roundId: selectedRoundId,
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
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header Bar */}
        <View style={styles.headerBar}>
          <View style={styles.headerTitleRow}>
            <ClipboardList size={20} color="#ea580c" />
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

        {/* Lọc Sự Kiện */}
        <View style={styles.filterSection}>
          <Text style={styles.filterLabel}>CHỌN CUỘC THI:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollFilters}>
            {events.map((evt) => (
              <TouchableOpacity
                key={evt._id}
                style={[
                  styles.filterTab,
                  selectedEventId === evt._id && styles.filterTabActive,
                ]}
                onPress={() => setSelectedEventId(evt._id)}
              >
                <Text
                  style={[
                    styles.filterTabText,
                    selectedEventId === evt._id && styles.filterTabTextActive,
                  ]}
                >
                  {evt.name} ({evt.semester})
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Lọc Vòng Thi */}
        {rounds.length > 0 && (
          <View style={styles.filterSection}>
            <Text style={styles.filterLabel}>CHỌN VÒNG THI:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollFilters}>
              {rounds.map((rnd) => (
                <TouchableOpacity
                  key={rnd._id}
                  style={[
                    styles.filterTab,
                    selectedRoundId === rnd._id && styles.filterTabActive,
                  ]}
                  onPress={() => setSelectedRoundId(rnd._id)}
                >
                  <Text
                    style={[
                      styles.filterTabText,
                      selectedRoundId === rnd._id && styles.filterTabTextActive,
                    ]}
                  >
                    Vòng {rnd.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Danh sách Đội Thi */}
        <View style={styles.listContainer}>
          {loading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color="#ea580c" />
            </View>
          ) : teams.length === 0 ? (
            <View style={styles.centerContainer}>
              <Text style={styles.noDataText}>Chưa có đội thi nào thuộc vòng đấu này.</Text>
            </View>
          ) : (
            <FlatList
              data={teams}
              keyExtractor={(item) => item._id}
              renderItem={renderTeamItem}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#ea580c']} />
              }
              contentContainerStyle={{ paddingBottom: 20 }}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>

        <BottomTabs activeTab="judge" navigation={navigation} />
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
    backgroundColor: '#f8fafc',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '800',
    marginLeft: 8,
    letterSpacing: 0.5,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  chatHeaderBtn: {
    padding: 6,
    position: 'relative',
    backgroundColor: '#fff7ed',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  headerBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#ef4444',
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  headerBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '800',
  },
  filterSection: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  filterLabel: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '800',
    marginBottom: 6,
  },
  scrollFilters: {
    flexDirection: 'row',
  },
  filterTab: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    borderRadius: 8,
  },
  filterTabActive: {
    borderColor: '#ea580c',
    backgroundColor: '#fff7ed',
  },
  filterTabText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '600',
  },
  filterTabTextActive: {
    color: '#ea580c',
    fontWeight: '800',
  },
  listContainer: {
    flex: 1,
    padding: 16,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  noDataText: {
    color: '#64748b',
    fontSize: 13,
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    marginBottom: 10,
    borderRadius: 12,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 2,
  },
  cardLeft: {
    flex: 1,
    marginRight: 10,
  },
  teamName: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },
  trackName: {
    color: '#ea580c',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 2,
  },
  topicTitle: {
    color: '#64748b',
    fontSize: 11,
  },
  cardRight: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 65,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusBadgeGraded: {
    backgroundColor: '#dcfce7',
    borderColor: '#bbf7d0',
    borderWidth: 1,
  },
  statusBadgePending: {
    backgroundColor: '#fff7ed',
    borderColor: '#fed7aa',
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  statusBadgeTextGraded: {
    color: '#166534',
  },
  statusBadgeTextPending: {
    color: '#c2410c',
  },
  gradeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ea580c',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  gradeBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
    marginRight: 4,
  },
});
