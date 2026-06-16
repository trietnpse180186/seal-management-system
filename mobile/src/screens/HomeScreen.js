import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Terminal, Award, Clock, Users, Calendar, Play } from 'lucide-react-native';
import * as WebBrowser from 'expo-web-browser';
import api from '../api/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import BottomTabs from '../components/BottomTabs';

const { width } = Dimensions.get('window');

export default function HomeScreen({ navigation }) {
  const [events, setEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [hasTeam, setHasTeam] = useState(false);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const res = await api.get('/events');
        // Lọc các cuộc thi không phải draft
        setEvents(res.data.filter((e) => e.status !== 'draft'));
      } catch (err) {
        console.error('Lỗi khi fetch danh sách cuộc thi:', err);
      } finally {
        setLoadingEvents(false);
      }
    };

    const checkTeamStatus = async () => {
      try {
        const res = await api.get('/teams/my-team');
        if (res.data && res.data.team) {
          setHasTeam(true);
        } else {
          setHasTeam(false);
        }
      } catch (err) {
        setHasTeam(false);
      }
    };

    fetchEvents();
    checkTeamStatus();
  }, []);

  const handlePlayVideo = async () => {
    try {
      const videoUrl = 'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260328_115001_bcdaa3b4-03de-47e7-ad63-ae3e392c32d4.mp4';
      await WebBrowser.openBrowserAsync(videoUrl);
    } catch (error) {
      Alert.alert('Lỗi', 'Không thể mở video giới thiệu.');
    }
  };

  const timelineEvents = [
    {
      title: 'Hình thành Ý tưởng',
      date: 'Từ 01 đến 10 tháng 3',
      description: 'Định hình ý tưởng và xác nhận thành viên đội thi. Nộp đề án dự án thông qua cổng đăng ký bảo mật.',
    },
    {
      title: 'Lập trình & Phát triển',
      date: 'Từ 15 đến 17 tháng 3',
      description: 'Giai đoạn lập trình chính thức. Phát triển sản phẩm cường độ cao tại phòng máy FPT Campus.',
    },
    {
      title: 'Thuyết trình & Đánh giá',
      date: '20 tháng 3',
      description: 'Thuyết trình demo sản phẩm trước Hội đồng Giám khảo. Công bố kết quả chung cuộc và trao giải thưởng.',
    },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
          {/* Logo & Hero Header */}
          <View style={styles.heroSection}>
            <Text style={styles.logoText}>SEAL</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>HACKATHON</Text>
            </View>
            <Text style={styles.subtitle}>
              HỆ THỐNG QUẢN LÝ CHẤM ĐIỂM & THEO DÕI DỰ ÁN
            </Text>
            <View style={styles.divider} />
          </View>

          {/* Sứ mệnh */}
          <View style={styles.aboutCard}>
            <View style={styles.aboutHeader}>
              <Terminal size={18} color="#00f0ff" />
              <Text style={styles.aboutMeta}>SỨ MỆNH CUỘC THI</Text>
            </View>
            <Text style={styles.aboutTitle}>KIẾN TẠO SỰ SÁNG TẠO</Text>
            <Text style={styles.aboutDescription}>
              SEAL Hackathon là cuộc thi lập trình hàng đầu tại Đại học FPT, quy tụ những tài năng công nghệ xuất sắc nhất để giải quyết các thách thức thực tế thông qua sự sáng tạo và dòng code. Trong vòng 48 giờ đầy thử thách, các đội thi sẽ biến các ý tưởng thành các sản phẩm thực tế định hình tương lai.
            </Text>
          </View>

          {/* Video giới thiệu mockup */}
          <View style={styles.videoSection}>
            <Text style={styles.sectionTitle}>VIDEO GIỚI THIỆU</Text>
            <TouchableOpacity style={styles.videoCard} onPress={handlePlayVideo} activeOpacity={0.85}>
              <View style={styles.videoOverlay}>
                <View style={styles.playButtonGlow}>
                  <View style={styles.playButton}>
                    <Play size={20} color="#000" fill="#000" style={{ marginLeft: 2 }} />
                  </View>
                </View>
                <Text style={styles.videoTitle}>SEAL HACKATHON: KHỞI NGUỒN SÁNG TẠO</Text>
                <Text style={styles.videoSubtitle}>Nhấp để phát video giới thiệu cuộc thi (2:15)</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Thống kê nổi bật */}
          <Text style={styles.sectionTitle}>THÔNG SỐ NỔI BẬT</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Clock size={20} color="#00f0ff" style={styles.statIcon} />
              <Text style={styles.statValue}>48 GIỜ</Text>
              <Text style={styles.statLabel}>Lập trình liên tục</Text>
            </View>
            <View style={styles.statCard}>
              <Users size={20} color="#00f0ff" style={styles.statIcon} />
              <Text style={styles.statValue}>100+</Text>
              <Text style={styles.statLabel}>Thí sinh đăng ký</Text>
            </View>
            <View style={styles.statCard}>
              <Award size={20} color="#00f0ff" style={styles.statIcon} />
              <Text style={styles.statValue}>50 TR</Text>
              <Text style={styles.statLabel}>Tổng giải thưởng</Text>
            </View>
          </View>

          {/* Cuộc thi đang diễn ra */}
          <Text style={styles.sectionTitle}>CUỘC THI ĐANG DIỄN RA</Text>
          {loadingEvents ? (
            <ActivityIndicator size="small" color="#00f0ff" style={{ marginVertical: 20 }} />
          ) : events.length > 0 ? (
            <View style={styles.eventsContainer}>
              {events.map((evt) => {
                const maxTeams = evt.maxTeams || 10;
                const teamCount = evt.teamCount || 0;
                const percent = Math.min(100, (teamCount / maxTeams) * 100);

                let statusLabel = '';
                let statusColor = '#00f0ff';
                switch (evt.status) {
                  case 'registration':
                    statusLabel = '[MỞ ĐĂNG KÝ]';
                    statusColor = '#00f0ff';
                    break;
                  case 'ongoing':
                    statusLabel = '[ĐANG DIỄN RA]';
                    statusColor = '#f59e0b';
                    break;
                  case 'completed':
                    statusLabel = '[ĐÃ KẾT THÚC]';
                    statusColor = '#10b981';
                    break;
                  default:
                    statusLabel = `[${evt.status.toUpperCase()}]`;
                    statusColor = '#849495';
                }

                return (
                  <View key={evt._id} style={styles.eventCard}>
                    <View style={styles.eventHeader}>
                      <Text style={[styles.eventStatus, { color: statusColor }]}>{statusLabel}</Text>
                      <Text style={styles.eventSemester}>{evt.semester} {evt.year}</Text>
                    </View>

                    <Text style={styles.eventTitle}>{evt.name}</Text>
                    <Text style={styles.eventDesc} numberOfLines={3}>{evt.description || 'Chưa có mô tả chi tiết cho cuộc thi này.'}</Text>

                    <View style={styles.eventFooter}>
                      <View style={styles.teamProgressInfo}>
                        <Text style={styles.progressLabel}>Số đội đăng ký:</Text>
                        <Text style={styles.progressValue}>{teamCount} / {maxTeams}</Text>
                      </View>
                      
                      <View style={styles.progressBarBg}>
                        <View style={[styles.progressBarFill, { width: `${percent}%` }]} />
                      </View>

                      {evt.status === 'registration' && (
                        <TouchableOpacity
                          style={styles.actionBtn}
                          onPress={() => {
                            if (hasTeam) {
                              navigation.navigate('TeamArea');
                            } else {
                              navigation.navigate('RegisterTeam', { eventId: evt._id });
                            }
                          }}
                        >
                          <Text style={styles.actionBtnText}>
                            {hasTeam ? 'VÀO KHU VỰC ĐỘI' : 'ĐĂNG KÝ THAM GIA'}
                          </Text>
                        </TouchableOpacity>
                      )}

                      {evt.status === 'ongoing' && (
                        <TouchableOpacity
                          style={[styles.actionBtn, { borderColor: '#3b494b', backgroundColor: 'rgba(255, 255, 255, 0.02)' }]}
                          onPress={() => navigation.navigate('Leaderboard')}
                        >
                          <Text style={[styles.actionBtnText, { color: '#dae3f0' }]}>BẢNG XẾP HẠNG LIVE</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>[HIỆN_TẠI_CHƯA_CÓ_CUỘC_THI_NÀO_ĐƯỢC_CÔNG_BỐ]</Text>
            </View>
          )}

          {/* Lịch trình (Vertical Timeline) */}
          <View style={styles.timelineSection}>
            <View style={styles.timelineHeader}>
              <Calendar size={18} color="#00f0ff" />
              <Text style={styles.timelineHeaderTitle}>LỊCH TRÌNH CUỘC THI</Text>
            </View>
            <Text style={styles.timelineMeta}>CÁC_GIAI_ĐOẠN_THỰC_THI</Text>

            <View style={styles.timelineBody}>
              {/* Vertical line connector */}
              <View style={styles.verticalLine} />

              {timelineEvents.map((item, idx) => (
                <View key={idx} style={styles.timelineRow}>
                  {/* Timeline Dot */}
                  <View style={styles.nodeOutline}>
                    <View style={styles.nodeDot} />
                  </View>

                  {/* Timeline Content */}
                  <View style={styles.timelineContent}>
                    <Text style={styles.timelineEventTitle}>{item.title}</Text>
                    <Text style={styles.timelineEventDate}>{item.date}</Text>
                    <Text style={styles.timelineEventDesc}>{item.description}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>

        <BottomTabs activeTab="home" navigation={navigation} />
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
  scrollContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  heroSection: {
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 24,
  },
  logoText: {
    fontSize: 44,
    fontWeight: '900',
    color: '#00f0ff',
    textShadowColor: 'rgba(0, 240, 255, 0.4)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 15,
  },
  badge: {
    backgroundColor: '#131d25',
    borderColor: '#3b494b',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 2,
    marginTop: 4,
  },
  badgeText: {
    color: '#b9cacb',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 3,
  },
  subtitle: {
    color: '#849495',
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 16,
    letterSpacing: 1,
    lineHeight: 16,
  },
  divider: {
    width: 60,
    height: 2,
    backgroundColor: '#00f0ff',
    marginTop: 20,
    shadowColor: '#00f0ff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 5,
  },
  aboutCard: {
    backgroundColor: '#131d25',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    padding: 20,
    borderRadius: 4,
    marginBottom: 28,
  },
  aboutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  aboutMeta: {
    color: '#00f0ff',
    fontSize: 10,
    fontWeight: '800',
    marginLeft: 8,
    letterSpacing: 1,
  },
  aboutTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  aboutDescription: {
    color: '#b9cacb',
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '400',
  },
  sectionTitle: {
    color: '#00f0ff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 16,
    paddingLeft: 2,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 28,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#131d25',
    borderColor: '#3b494b',
    borderWidth: 1,
    borderRadius: 4,
    paddingVertical: 16,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  statIcon: {
    marginBottom: 8,
  },
  statValue: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  statLabel: {
    color: '#849495',
    fontSize: 9,
    fontWeight: '600',
    textAlign: 'center',
  },
  timelineSection: {
    backgroundColor: '#131d25',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    padding: 20,
    borderRadius: 4,
  },
  timelineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  timelineHeaderTitle: {
    color: '#00f0ff',
    fontSize: 11,
    fontWeight: '800',
    marginLeft: 8,
    letterSpacing: 1,
  },
  timelineMeta: {
    color: '#849495',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
    fontFamily: 'monospace',
    marginBottom: 24,
    paddingLeft: 2,
  },
  timelineBody: {
    position: 'relative',
    paddingLeft: 20,
  },
  verticalLine: {
    position: 'absolute',
    left: 4,
    top: 4,
    bottom: 24,
    width: 2,
    backgroundColor: 'rgba(0, 240, 255, 0.15)',
  },
  timelineRow: {
    flexDirection: 'row',
    marginBottom: 24,
    position: 'relative',
  },
  nodeOutline: {
    position: 'absolute',
    left: -21,
    top: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#00f0ff',
    backgroundColor: '#0a141d',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#00f0ff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  nodeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#00f0ff',
  },
  timelineContent: {
    flex: 1,
  },
  timelineEventTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  timelineEventDate: {
    color: '#00f0ff',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 6,
    fontFamily: 'monospace',
  },
  timelineEventDesc: {
    color: '#b9cacb',
    fontSize: 12,
    lineHeight: 18,
  },
  videoSection: {
    marginBottom: 28,
  },
  videoCard: {
    height: (width - 40) * 9 / 16,
    backgroundColor: '#0c151d',
    borderWidth: 1,
    borderColor: 'rgba(0, 240, 255, 0.25)',
    borderRadius: 6,
    overflow: 'hidden',
    position: 'relative',
  },
  videoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 20, 29, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  playButtonGlow: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(0, 240, 255, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    borderColor: 'rgba(0, 240, 255, 0.3)',
    borderWidth: 1,
  },
  playButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#00f0ff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#00f0ff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 4,
  },
  videoTitle: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  videoSubtitle: {
    color: '#00f0ff',
    fontSize: 9,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  eventsContainer: {
    marginBottom: 20,
  },
  eventCard: {
    backgroundColor: '#131d25',
    borderColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderRadius: 4,
    padding: 20,
    marginBottom: 16,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  eventStatus: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  eventSemester: {
    color: '#849495',
    fontSize: 10,
    fontWeight: '700',
  },
  eventTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  eventDesc: {
    color: '#b9cacb',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 16,
  },
  eventFooter: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
    paddingTop: 16,
  },
  teamProgressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressLabel: {
    color: '#849495',
    fontSize: 10,
    fontWeight: '700',
  },
  progressValue: {
    color: '#dae3f0',
    fontSize: 11,
    fontWeight: '800',
  },
  progressBarBg: {
    height: 6,
    backgroundColor: '#0a141d',
    borderRadius: 3,
    overflow: 'hidden',
    borderColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    marginBottom: 16,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#00f0ff',
    borderRadius: 3,
  },
  actionBtn: {
    borderColor: 'rgba(0, 240, 255, 0.3)',
    borderWidth: 1,
    backgroundColor: 'rgba(0, 240, 255, 0.05)',
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 4,
  },
  actionBtnText: {
    color: '#00f0ff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  emptyCard: {
    backgroundColor: '#131d25',
    borderColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderRadius: 4,
    padding: 24,
    alignItems: 'center',
    marginBottom: 28,
  },
  emptyText: {
    color: '#849495',
    fontSize: 11,
    fontStyle: 'italic',
    textAlign: 'center',
  },
});
