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
import socketService from '../api/socketService';
import { ClipboardList, RefreshCw, ArrowRight, MessageSquare } from 'lucide-react-native';

export default function JudgeDashboardScreen({ navigation }) {
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [rounds, setRounds] = useState([]);
  const [selectedRoundId, setSelectedRoundId] = useState('');

  const [teams, setTeams] = useState([]);
  const [teamGrades, setTeamGrades] = useState({}); // { [teamId]: isGraded }
  
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
      // Tải danh sách đội thi của sự kiện
      const teamsRes = await api.get(`/teams/all/${eventId}?roundId=${roundId}`);
      const confirmedTeams = teamsRes.data.filter((t) => t.status === 'confirmed');
      setTeams(confirmedTeams);

      // Tải trạng thái đã chấm điểm cho từng đội song song
      const gradesStatus = {};
      await Promise.all(
        confirmedTeams.map(async (team) => {
          try {
            const gradeRes = await api.get(`/grades/team/${team._id}/round/${roundId}`);
            gradesStatus[team._id] = !!(gradeRes.data && gradeRes.data.score);
          } catch (e) {
            gradesStatus[team._id] = false;
          }
        })
      );
      setTeamGrades(gradesStatus);
    } catch (err) {
      console.error('Lỗi tải danh sách đội thi & bảng điểm', err);
      Alert.alert('Thất bại', 'Không thể tải danh sách đội thi chấm điểm.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();

    // Socket setup
    const initSocket = async () => {
      await socketService.connect();
      socketService.on('new_message', () => {
        setUnreadCount(prev => prev + 1);
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
    } else {
      await fetchEvents();
    }
    setRefreshing(false);
  }, [selectedEventId, selectedRoundId]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <ClipboardList size={22} color="#00f0ff" />
          <Text style={styles.headerTitle}>BÀN GIÁM KHẢO</Text>
          <TouchableOpacity
            style={styles.chatHeaderBtn}
            onPress={() => {
              setUnreadCount(0);
              navigation.navigate('Chat');
            }}
          >
            <MessageSquare size={22} color="#00f0ff" />
            {unreadCount > 0 && (
              <View style={styles.headerBadge}>
                <Text style={styles.headerBadgeText}>{unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={onRefresh} style={styles.refreshBtn}>
            <RefreshCw size={18} color="#00f0ff" />
          </TouchableOpacity>
        </View>

        {/* Lọc Sự kiện */}
        <View style={styles.filterSection}>
          <Text style={styles.filterLabel}>SỰ KIỆN</Text>
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
                  {evt.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Lọc Vòng thi */}
        {rounds.length > 0 ? (
          <View style={styles.filterSection}>
            <Text style={styles.filterLabel}>VÒNG THI CHẤM ĐIỂM</Text>
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
                    {rnd.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {/* Danh sách đội cần chấm điểm */}
        <View style={styles.listContainer}>
          {loading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color="#00f0ff" />
            </View>
          ) : teams.length === 0 ? (
            <View style={styles.centerContainer}>
              <Text style={styles.noDataText}>Không có đội thi nào được tìm thấy trong sự kiện này.</Text>
            </View>
          ) : (
            <FlatList
              data={teams}
              keyExtractor={(item) => item._id}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00f0ff" />}
              renderItem={({ item }) => {
                const isGraded = teamGrades[item._id];
                return (
                  <View style={styles.card}>
                    <View style={styles.cardLeft}>
                      <Text style={styles.teamName}>{item.name}</Text>
                      <Text style={styles.trackName}>Bảng thi: {item.trackId?.name || 'Chưa phân'}</Text>
                      <Text style={styles.topicTitle} numberOfLines={1}>
                        Đề tài: {item.topicSubmission?.title || 'Chưa nộp đề tài'}
                      </Text>
                    </View>

                    <View style={styles.cardRight}>
                      {/* Trạng thái chấm điểm */}
                      <View style={[styles.statusBadge, isGraded ? styles.statusBadgeGraded : styles.statusBadgePending]}>
                        <Text style={[styles.statusBadgeText, isGraded ? styles.statusBadgeTextGraded : styles.statusBadgeTextPending]}>
                          {isGraded ? 'ĐÃ CHẤM' : 'CHƯA CHẤM'}
                        </Text>
                      </View>

                      {/* Nút vào chấm điểm */}
                      <TouchableOpacity
                        style={styles.gradeBtn}
                        onPress={() =>
                          navigation.navigate('JudgeScoring', {
                            teamId: item._id,
                            roundId: selectedRoundId,
                          })
                        }
                      >
                        <Text style={styles.gradeBtnText}>Chấm</Text>
                        <ArrowRight size={14} color="#000" />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              }}
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
    backgroundColor: '#0a141d',
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    marginLeft: 10,
    flex: 1,
    letterSpacing: 1.5,
  },
  chatHeaderBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    marginRight: 10,
  },
  headerBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#ff3b30',
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: '#0a141d',
  },
  headerBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '900',
  },
  refreshBtn: {
    padding: 5,
  },
  filterSection: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  filterLabel: {
    color: '#849495',
    fontSize: 10,
    fontWeight: '800',
    marginBottom: 6,
    letterSpacing: 1,
  },
  scrollFilters: {
    flexDirection: 'row',
  },
  filterTab: {
    backgroundColor: '#131d25',
    borderColor: '#3b494b',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 10,
    borderRadius: 4,
  },
  filterTabActive: {
    borderColor: '#00f0ff',
    backgroundColor: 'rgba(0, 240, 255, 0.05)',
  },
  filterTabText: {
    color: '#b9cacb',
    fontSize: 12,
    fontWeight: '600',
  },
  filterTabTextActive: {
    color: '#00f0ff',
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
    color: '#849495',
    fontSize: 14,
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#131d25',
    borderColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    marginBottom: 12,
    borderRadius: 4,
  },
  cardLeft: {
    flex: 1,
    marginRight: 10,
  },
  teamName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '850',
    marginBottom: 4,
  },
  trackName: {
    color: '#b9cacb',
    fontSize: 12,
    marginBottom: 4,
  },
  topicTitle: {
    color: '#849495',
    fontSize: 11,
  },
  cardRight: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 70,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  statusBadgeGraded: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderColor: 'rgba(16, 185, 129, 0.2)',
    borderWidth: 1,
  },
  statusBadgePending: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderColor: 'rgba(245, 158, 11, 0.2)',
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  statusBadgeTextGraded: {
    color: '#10b981',
  },
  statusBadgeTextPending: {
    color: '#f59e0b',
  },
  gradeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00f0ff',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
  },
  gradeBtnText: {
    color: '#000',
    fontSize: 12,
    fontWeight: '800',
    marginRight: 4,
  },
});
