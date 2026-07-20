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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../api/api';
import BottomTabs from '../components/BottomTabs';
import HeaderAvatar from '../components/HeaderAvatar';
import { Trophy, RefreshCw, Lock } from 'lucide-react-native';

export default function LeaderboardScreen({ navigation }) {
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [rounds, setRounds] = useState([]);
  const [selectedRoundId, setSelectedRoundId] = useState('');
  const [selectedRound, setSelectedRound] = useState(null);

  const [standings, setStandings] = useState([]);
  const [isLocked, setIsLocked] = useState(false);
  const [lockedMessage, setLockedMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchEvents = async () => {
    try {
      const res = await api.get('/events');
      setEvents(res.data);
      if (res.data.length > 0) {
        setSelectedEventId(res.data[0]._id);
      }
    } catch (err) {
      console.error('Lỗi khi lấy danh sách sự kiện', err);
    }
  };

  const fetchRounds = async (eventId) => {
    try {
      const res = await api.get(`/events/${eventId}`);
      const roundList = res.data.rounds || [];
      setRounds(roundList);
      if (roundList.length > 0) {
        setSelectedRoundId(roundList[0]._id);
        setSelectedRound(roundList[0]);
      } else {
        setSelectedRoundId('');
        setSelectedRound(null);
        setStandings([]);
      }
    } catch (err) {
      console.error('Lỗi khi lấy danh sách vòng thi', err);
    }
  };

  const fetchRankings = async (roundId) => {
    if (!roundId) return;
    setLoading(true);
    try {
      const rolesStr = await AsyncStorage.getItem('roles');
      const roles = rolesStr ? JSON.parse(rolesStr) : [];
      const userStr = await AsyncStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      const isSystemAdmin = user?.isSystemAdmin;

      const isCoordinator =
        isSystemAdmin ||
        roles.some((r) => r.eventId === selectedEventId && r.role === 'coordinator');

      let res;
      if (isCoordinator && selectedRound?.status !== 'completed') {
        res = await api.get(`/grades/live-ranking/${roundId}`);
      } else {
        res = await api.get(`/grades/leaderboard/${roundId}`);
      }

      if (res.data.locked) {
        setIsLocked(true);
        setLockedMessage(res.data.message || 'Bảng xếp hạng đang bị đóng băng.');
        setStandings([]);
      } else {
        setIsLocked(false);
        setLockedMessage('');
        setStandings(res.data.standings || []);
      }
    } catch (err) {
      console.error('Lỗi khi lấy thứ hạng', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  useEffect(() => {
    if (selectedEventId) {
      fetchRounds(selectedEventId);
    }
  }, [selectedEventId]);

  useEffect(() => {
    if (selectedRoundId) {
      fetchRankings(selectedRoundId);
    }
  }, [selectedRoundId]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (selectedRoundId) {
      await fetchRankings(selectedRoundId);
    }
    setRefreshing(false);
  }, [selectedRoundId]);

  const getRankColor = (rank) => {
    switch (rank) {
      case 1:
        return '#d97706'; // Gold Amber
      case 2:
        return '#475569'; // Silver Slate
      case 3:
        return '#ea580c'; // Bronze Orange
      default:
        return '#64748b';
    }
  };

  const renderItem = ({ item }) => {
    const isTopThree = item.rank <= 3;

    return (
      <View
        style={[
          styles.card,
          item.rank === 1 && styles.cardFirst,
        ]}
      >
        <View style={styles.cardLeft}>
          <Text style={[styles.rankText, { color: getRankColor(item.rank) }]}>
            #{item.rank}
          </Text>
          <View style={styles.teamInfo}>
            <Text style={styles.teamName}>{item.teamName}</Text>
            <Text style={styles.trackText}>Bảng: {item.trackName}</Text>
          </View>
        </View>

        <View style={styles.cardRight}>
          <Text style={styles.scoreText}>
            {item.totalScore != null ? item.totalScore.toFixed(2) : '—'}
          </Text>
          <Text style={styles.scoreUnit}>ĐIỂM ĐTB</Text>
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
            <Trophy size={20} color="#ea580c" />
            <Text style={styles.headerTitle}>BẢNG XẾP HẠNG</Text>
          </View>
          <HeaderAvatar navigation={navigation} />
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
                  onPress={() => {
                    setSelectedRoundId(rnd._id);
                    setSelectedRound(rnd);
                  }}
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

        {/* Nội dung Bảng Xếp Hạng */}
        <View style={styles.listContainer}>
          {loading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color="#ea580c" />
            </View>
          ) : isLocked ? (
            <View style={styles.centerContainer}>
              <Lock size={48} color="#ea580c" style={styles.lockIcon} />
              <Text style={styles.lockedTitle}>BẢNG ĐIỂM ĐÃ ĐÓNG BĂNG</Text>
              <Text style={styles.lockedText}>{lockedMessage}</Text>
            </View>
          ) : standings.length === 0 ? (
            <View style={styles.centerContainer}>
              <Text style={styles.noDataText}>Chưa có dữ liệu xếp hạng cho vòng thi này.</Text>
            </View>
          ) : (
            <FlatList
              data={standings}
              keyExtractor={(item, index) => item.teamId || index.toString()}
              renderItem={renderItem}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#ea580c']} />
              }
              contentContainerStyle={{ paddingBottom: 20 }}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>

        <BottomTabs activeTab="leaderboard" navigation={navigation} />
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
    letterSpacing: 0.5,
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
  lockIcon: {
    marginBottom: 12,
  },
  lockedTitle: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 8,
  },
  lockedText: {
    color: '#64748b',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
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
  cardFirst: {
    borderColor: '#fed7aa',
    backgroundColor: '#fff7ed',
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  rankText: {
    fontSize: 18,
    fontWeight: '900',
    width: 40,
  },
  teamInfo: {
    marginLeft: 4,
    flex: 1,
  },
  teamName: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  trackText: {
    color: '#64748b',
    fontSize: 11,
  },
  cardRight: {
    alignItems: 'flex-end',
    marginLeft: 10,
  },
  scoreText: {
    color: '#ea580c',
    fontSize: 18,
    fontWeight: '900',
  },
  scoreUnit: {
    color: '#64748b',
    fontSize: 9,
    fontWeight: '700',
    marginTop: 1,
  },
});
