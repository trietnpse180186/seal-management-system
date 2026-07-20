import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Award, Trophy, Users, Shield, Calendar, ArrowUpRight } from 'lucide-react-native';
import api from '../api/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import BottomTabs from '../components/BottomTabs';
import HeaderAvatar from '../components/HeaderAvatar';

export default function MyAchievementsScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [teamsHistory, setTeamsHistory] = useState([]);
  const [achievementsMap, setAchievementsMap] = useState({});

  const fetchAchievements = async () => {
    try {
      const res = await api.get('/teams/history');
      const history = res.data || [];
      setTeamsHistory(history);

      const map = {};
      for (const t of history) {
        try {
          const achRes = await api.get(`/grades/team/${t._id}/achievements`);
          map[t._id] = achRes.data || [];
        } catch (err) {
          console.error(`Lỗi tải thành tích cho đội ${t.name}:`, err);
          map[t._id] = [];
        }
      }
      setAchievementsMap(map);
    } catch (err) {
      console.error('Lỗi tải lịch sử đội thi:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAchievements();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchAchievements();
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.container}>
        {/* Top Header */}
        <View style={styles.headerBar}>
          <View style={styles.brandGroup}>
            <Text style={styles.brandTitle}>SEAL</Text>
            <View style={styles.brandBadge}>
              <Text style={styles.brandBadgeText}>HACKATHON</Text>
            </View>
          </View>
          <HeaderAvatar navigation={navigation} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#ea580c']} />
          }
        >
          {/* Title Hero Banner */}
          <View style={styles.bannerCard}>
            <View style={styles.bannerTitleRow}>
              <Award size={26} color="#ea580c" />
              <Text style={styles.bannerTitle}>THÀNH TÍCH CỦA TÔI</Text>
            </View>
            <Text style={styles.bannerDesc}>
              Lịch sử các đội thi và thứ hạng bạn đã đạt được qua các mùa Hackathon.
            </Text>
          </View>

          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color="#ea580c" />
              <Text style={styles.loadingText}>Đang tải lịch sử thành tích...</Text>
            </View>
          ) : teamsHistory.length === 0 ? (
            <View style={styles.emptyCard}>
              <Trophy size={48} color="#cbd5e1" />
              <Text style={styles.emptyTitle}>Chưa có thành tích nào</Text>
              <Text style={styles.emptySub}>
                Bạn chưa tham gia cuộc thi nào hoặc các cuộc thi bạn tham gia chưa công bố kết quả.
              </Text>
              <TouchableOpacity
                style={styles.exploreBtn}
                onPress={() => navigation.navigate('Home')}
                activeOpacity={0.8}
              >
                <Text style={styles.exploreBtnText}>Khám phá các cuộc thi ngay ➔</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.teamsList}>
              {teamsHistory.map((t) => {
                const achievements = achievementsMap[t._id] || [];

                return (
                  <View key={t._id} style={styles.teamCard}>
                    {/* Team & Event Info Header */}
                    <View style={styles.teamHeader}>
                      <View style={{ flex: 1 }}>
                        <View style={styles.eventNameTag}>
                          <Text style={styles.eventNameTagText}>
                            Cuộc thi: {t.event?.name}
                          </Text>
                        </View>
                        <Text style={styles.teamNameText}>Đội: {t.name}</Text>
                      </View>
                      <View style={styles.semesterBadge}>
                        <Calendar size={12} color="#64748b" style={{ marginRight: 3 }} />
                        <Text style={styles.semesterText}>
                          Kỳ {t.event?.semester} {t.event?.year}
                        </Text>
                      </View>
                    </View>

                    {/* Members List */}
                    <View style={styles.sectionDivider} />
                    <View style={styles.membersSection}>
                      <View style={styles.sectionTitleRow}>
                        <Users size={14} color="#ea580c" />
                        <Text style={styles.sectionTitleText}>ĐỒNG ĐỘI CỦA BẠN</Text>
                      </View>
                      <View style={styles.membersGrid}>
                        {t.members.map((m, idx) => (
                          <View key={idx} style={styles.memberChip}>
                            <Text style={styles.memberName}>{m.fullName}</Text>
                            <Text style={styles.memberEmail} numberOfLines={1}>
                              {m.email}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>

                    {/* Round Achievements */}
                    <View style={styles.sectionDivider} />
                    <View style={styles.achievementsSection}>
                      <View style={styles.sectionTitleRow}>
                        <Trophy size={14} color="#ea580c" />
                        <Text style={styles.sectionTitleText}>THÀNH TÍCH CÁC VÒNG ĐẤU</Text>
                      </View>

                      {achievements.length > 0 ? (
                        <View style={styles.roundsList}>
                          {achievements.map((ach) => {
                            const rank = ach.rank || 1;
                            let rankBg = '#f1f5f9';
                            let rankBorder = '#cbd5e1';
                            let rankColor = '#475569';

                            if (rank === 1) {
                              rankBg = '#fffbeb';
                              rankBorder = '#fde68a';
                              rankColor = '#d97706';
                            } else if (rank === 2) {
                              rankBg = '#f8fafc';
                              rankBorder = '#e2e8f0';
                              rankColor = '#475569';
                            } else if (rank === 3) {
                              rankBg = '#fff7ed';
                              rankBorder = '#ffedd5';
                              rankColor = '#c2410c';
                            }

                            const roundName = ach.roundId?.name || '';
                            const isFinalRound =
                              roundName.toLowerCase().includes('chung kết') ||
                              roundName.toLowerCase() === 'final';

                            return (
                              <View key={ach._id} style={styles.roundCard}>
                                <View style={styles.roundHeaderRow}>
                                  <Text style={styles.roundName}>Vòng: {roundName}</Text>
                                  <View
                                    style={[
                                      styles.rankBadge,
                                      { backgroundColor: rankBg, borderColor: rankBorder },
                                    ]}
                                  >
                                    <Text style={[styles.rankBadgeText, { color: rankColor }]}>
                                      Hạng {rank}
                                    </Text>
                                  </View>
                                </View>

                                <View style={styles.roundMetaRow}>
                                  <Text style={styles.metaLabel}>
                                    Bảng đấu: <Text style={styles.metaValue}>{ach.trackId?.name || 'Mặc định'}</Text>
                                  </Text>
                                  <Text style={styles.metaLabel}>
                                    Số Giám khảo: <Text style={styles.metaValue}>{ach.judgeCount || 0}</Text>
                                  </Text>
                                </View>

                                <View style={styles.scoreRow}>
                                  <View>
                                    <Text style={styles.scoreLabel}>ĐIỂM TRUNG BÌNH</Text>
                                    <Text style={styles.scoreValue}>
                                      {ach.averageScore != null ? ach.averageScore.toFixed(2) : '—'}
                                    </Text>
                                  </View>

                                  {!isFinalRound && (
                                    <View style={styles.statusBox}>
                                      {ach.isAdvanced ? (
                                        <View style={styles.statusAdvanced}>
                                          <Text style={styles.statusAdvancedText}>ĐÃ ĐI TIẾP</Text>
                                        </View>
                                      ) : ach.roundId?.status === 'completed' ? (
                                        <View style={styles.statusStopped}>
                                          <Text style={styles.statusStoppedText}>DỪNG BƯỚC</Text>
                                        </View>
                                      ) : (
                                        <View style={styles.statusPending}>
                                          <Text style={styles.statusPendingText}>ĐANG CHẤM</Text>
                                        </View>
                                      )}
                                    </View>
                                  )}
                                </View>
                              </View>
                            );
                          })}
                        </View>
                      ) : (
                        <Text style={styles.noRoundText}>
                          Chưa có bảng điểm hay xếp hạng chính thức cho đội ở cuộc thi này.
                        </Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>

        <BottomTabs activeTab="achievements" navigation={navigation} />
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
  brandGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#ea580c',
    letterSpacing: 1.5,
  },
  brandBadge: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 6,
  },
  brandBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  scrollContainer: {
    padding: 16,
    paddingBottom: 24,
  },
  bannerCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  bannerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  bannerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    marginLeft: 8,
  },
  bannerDesc: {
    fontSize: 12,
    color: '#64748b',
    lineHeight: 18,
  },
  loadingBox: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 10,
    color: '#64748b',
    fontSize: 13,
  },
  emptyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 30,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 12,
  },
  emptySub: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  exploreBtn: {
    marginTop: 16,
    backgroundColor: '#ea580c',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  exploreBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  teamsList: {
    gap: 16,
  },
  teamCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  teamHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  eventNameTag: {
    backgroundColor: '#fff7ed',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#fed7aa',
    marginBottom: 6,
  },
  eventNameTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ea580c',
  },
  teamNameText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  semesterBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  semesterText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  sectionDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 12,
  },
  membersSection: {},
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitleText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
    marginLeft: 6,
    letterSpacing: 0.5,
  },
  membersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  memberChip: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: '48%',
    flex: 1,
  },
  memberName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1e293b',
  },
  memberEmail: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 1,
  },
  achievementsSection: {},
  roundsList: {
    gap: 8,
  },
  roundCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  roundHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  roundName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  rankBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
  },
  rankBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  roundMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 6,
  },
  metaLabel: {
    fontSize: 11,
    color: '#64748b',
  },
  metaValue: {
    fontWeight: '700',
    color: '#334155',
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  scoreLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748b',
  },
  scoreValue: {
    fontSize: 16,
    fontWeight: '900',
    color: '#ea580c',
  },
  statusBox: {},
  statusAdvanced: {
    backgroundColor: '#dcfce7',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusAdvancedText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#166534',
  },
  statusStopped: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusStoppedText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
  },
  statusPending: {
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusPendingText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#c2410c',
  },
  noRoundText: {
    fontSize: 12,
    color: '#64748b',
    fontStyle: 'italic',
    paddingVertical: 8,
  },
});
