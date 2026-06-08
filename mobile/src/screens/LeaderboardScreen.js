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
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../api/api';
import BottomTabs from '../components/BottomTabs';
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
    } else if (selectedEventId) {
      await fetchRounds(selectedEventId);
    } else {
      await fetchEvents();
    }
    setRefreshing(false);
  }, [selectedEventId, selectedRoundId]);

  const getRankStyle = (index) => {
    if (index === 0) return { color: '#ffd700', textShadowColor: 'rgba(255, 215, 0, 0.4)' }; // Vàng
    if (index === 1) return { color: '#c0c0c0', textShadowColor: 'rgba(192, 192, 192, 0.4)' }; // Bạc
    if (index === 2) return { color: '#cd7f32', textShadowColor: 'rgba(205, 127, 50, 0.4)' }; // Đồng
    return { color: '#b9cacb' };
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Trophy size={22} color="#00f0ff" />
          <Text style={styles.headerTitle}>BẢNG XẾP HẠNG</Text>
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
            <Text style={styles.filterLabel}>VÒNG THI</Text>
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
                    {rnd.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {/* Danh sách xếp hạng */}
        <View style={styles.listContainer}>
          {loading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color="#00f0ff" />
            </View>
          ) : isLocked ? (
            <View style={styles.centerContainer}>
              <Lock size={48} color="#ef4444" style={styles.lockIcon} />
              <Text style={styles.lockedTitle}>BẢNG ĐIỂM ĐÃ BỊ KHÓA</Text>
              <Text style={styles.lockedText}>{lockedMessage}</Text>
            </View>
          ) : standings.length === 0 ? (
            <View style={styles.centerContainer}>
              <Text style={styles.noDataText}>
                {selectedRoundId ? 'Chưa có dữ liệu chấm điểm cho vòng này.' : 'Vui lòng chọn sự kiện và vòng thi.'}
              </Text>
            </View>
          ) : (
            <FlatList
              data={standings}
              keyExtractor={(item) => item.teamId}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00f0ff" />}
              renderItem={({ item, index }) => (
                <View style={[styles.card, index === 0 && styles.cardFirst]}>
                  <View style={styles.cardLeft}>
                    <Text
                      style={[
                        styles.rankText,
                        getRankStyle(index),
                        Platform.OS === 'ios' ? { fontFamily: 'Courier' } : { fontFamily: 'monospace' },
                      ]}
                    >
                      #{index + 1}
                    </Text>
                    <View style={styles.teamInfo}>
                      <Text style={styles.teamName}>{item.teamName}</Text>
                      <Text style={styles.trackText}>Chủ đề: {item.trackName || 'Chưa phân'}</Text>
                    </View>
                  </View>
                  <View style={styles.cardRight}>
                    <Text style={styles.scoreText}>{item.totalScore?.toFixed(2)}</Text>
                    <Text style={styles.scoreUnit}>điểm</Text>
                  </View>
                </View>
              )}
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
  lockIcon: {
    marginBottom: 15,
  },
  lockedTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 10,
  },
  lockedText: {
    color: '#849495',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
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
  cardFirst: {
    borderColor: 'rgba(0, 240, 255, 0.3)',
    backgroundColor: 'rgba(0, 240, 255, 0.03)',
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  rankText: {
    fontSize: 18,
    fontWeight: '900',
    width: 45,
  },
  teamInfo: {
    marginLeft: 5,
    flex: 1,
  },
  teamName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 3,
  },
  trackText: {
    color: '#849495',
    fontSize: 11,
  },
  cardRight: {
    alignItems: 'flex-end',
    marginLeft: 10,
  },
  scoreText: {
    color: '#00f0ff',
    fontSize: 18,
    fontWeight: '800',
  },
  scoreUnit: {
    color: '#849495',
    fontSize: 10,
    marginTop: 2,
  },
});
