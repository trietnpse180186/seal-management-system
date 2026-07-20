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
import { Terminal, Award, Clock, Users, Play, MessageSquare, Zap, FileText, ShieldCheck, ChevronDown, ChevronUp } from 'lucide-react-native';
import * as WebBrowser from 'expo-web-browser';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../api/api';
import BottomTabs from '../components/BottomTabs';
import HeaderAvatar from '../components/HeaderAvatar';
import socketService from '../api/socketService';

const { width } = Dimensions.get('window');

const OFFICIAL_RULES = [
  {
    id: 1,
    title: 'Điều 1. Mục tiêu và sứ mệnh cuộc thi',
    points: [
      '• Xây dựng sản phẩm ứng dụng AI nâng cao năng lực vận hành thông minh.',
      '• Giám sát hệ thống, phát hiện bất thường và chẩn đoán sự cố theo thời gian thực.',
      '• Đề xuất giải pháp dự báo rủi ro và hỗ trợ người dùng ra quyết định tối ưu.',
    ],
  },
  {
    id: 2,
    title: 'Điều 2. Đối tượng tham gia',
    points: [
      '• Đối tượng: Sinh viên, học viên, nhóm nghiên cứu ngành CNTT, AI, Data, Tự động hóa...',
      '• Quy mô đội: Mỗi đội thi gồm từ 03 đến 05 thành viên.',
      '• Đơn vị: Thành viên có thể đến từ cùng hoặc khác trường/đơn vị.',
      '• Quy định: Mỗi cá nhân chỉ được đăng ký tham gia duy nhất 01 đội thi.',
    ],
  },
  {
    id: 3,
    title: 'Điều 3. Chủ đề và phạm vi thi đấu',
    points: [
      '• Phát triển ứng dụng AI tiếp nhận, xử lý & phân tích dữ liệu IoT thời gian thực.',
      '• Cuộc thi gồm 03 Track chuyên môn độc lập (bảo mật & bốc thăm trước ngày thi).',
      '• Sản phẩm phải thể hiện rõ vai trò AI (phát hiện bất thường, chẩn đoán, gợi ý hành động).',
      '• Các sản phẩm chỉ trực quan hóa dữ liệu hoặc cảnh báo điều kiện cố định sẽ không hợp lệ.',
    ],
  },
  {
    id: 4,
    title: 'Điều 4. Cấu trúc và lịch trình cuộc thi',
    points: [
      '• Ngày 1: Khai mạc, chọn Track chuyên môn, bốc thăm chủ đề và chia bảng thi đấu.',
      '• Ngày 2 - Thi đấu chính thức (07h00 - 15h00):',
      '   + Milestone 1: Nộp Slide ý tưởng (trước 10h00).',
      '   + Milestone 2: Thuyết trình ý tưởng (5-8 phút) & Hoàn thiện sản phẩm.',
      '   + Technical Review: Chấm sản phẩm trực tiếp tại bàn.',
      '   + Vòng chung kết: Top 3 đội trình diễn xuất sắc nhất.',
    ],
  },
  {
    id: 5,
    title: 'Điều 5. Quy định thi đấu',
    points: [
      '• Thời gian thi đấu: 07h00 – 15h00 (Trễ quá 60 phút sẽ bị loại trực tiếp).',
      '• Lưu trữ mã nguồn: Bắt buộc Push liên tục lên GitHub/GitLab do BTC cấp.',
      '• Quản lý dự án: Đăng ký tài liệu qua Jira, Confluence hoặc Notion.',
      '• Mô hình AI: Tự do sử dụng các model (XGBoost, LSTM, Transformer, GPT, Gemini, Claude, Llama...).',
      '• Thời lượng Pitching: Vòng bảng (5p + 3p Q&A) - Vòng chung kết (7p + 3p Q&A).',
    ],
  },
  {
    id: 6,
    title: 'Điều 6. Cơ cấu thi đấu và chia bảng',
    points: [
      '• Chia bảng: Sau khi chọn Track, BTC phân bảng tối đa 6 đội/bảng.',
      '• Số lượng bảng: Tùy thuộc vào tổng số đội đăng ký thực tế ở mỗi Track.',
    ],
  },
  {
    id: 7,
    title: 'Điều 7. Vòng chung kết và điều kiện xét chọn',
    points: [
      '• Tuyển chọn: Ban Tổ Chức lựa chọn 08 đội xuất sắc nhất vào Vòng chung kết.',
      '• Cân bằng: Mỗi bảng chọn số lượng đội bằng nhau để đảm bảo tính công bằng.',
      '• Xét chọn bổ sung: Dựa vào điểm số trung bình và có thể kiểm tra mini test (tối đa 10p).',
    ],
  },
  {
    id: 8,
    title: 'Điều 8. Tiêu chí chấm điểm',
    points: [
      '• Vòng bảng:',
      '   + Xử lý dữ liệu thực tế: 25%',
      '   + Hiệu quả mô hình AI: 25%',
      '   + Kiến trúc & Tích hợp: 20%',
      '   + Phù hợp Domain & UX: 15%',
      '   + Ý tưởng & Pitching: 15%',
      '• Vòng chung kết:',
      '   + Độ hoàn thiện sản phẩm: 25%',
      '   + Năng lực phân tích AI: 25%',
      '   + Độ tin cậy & An toàn: 20%',
      '   + Tính sáng tạo: 15%',
      '   + Demo & Phản biện: 15%',
    ],
  },
  {
    id: 9,
    title: 'Điều 9. Quy định về đạo đức và bản quyền',
    points: [
      '• Liêm chính: Nghiêm cấm mọi hành vi gian lận, đạo nhái, vi phạm bản quyền.',
      '• An toàn: Tuyên bố không can thiệp trái phép vào hệ thống thi đấu.',
      '• Bản quyền: Sản phẩm phải là kết quả làm việc thực tế của đội trong thời gian thi đấu.',
    ],
  },
  {
    id: 10,
    title: 'Điều 10. Quy định chung và hiệu lực',
    points: [
      '• Ban Tổ Chức có toàn quyền giải thích và điều chỉnh điều lệ khi cần thiết.',
      '• Mọi tình huống phát sinh ngoài quy định sẽ do BTC xem xét quyết định cuối cùng.',
      '• Điều lệ có hiệu lực kể từ ngày công bố chính thức.',
    ],
  },
];

export default function HomeScreen({ navigation }) {
  const [events, setEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [hasTeam, setHasTeam] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [user, setUser] = useState(null);
  const [expandedRuleId, setExpandedRuleId] = useState(1);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const userStr = await AsyncStorage.getItem('user');
        if (userStr) {
          setUser(JSON.parse(userStr));
        }
      } catch (err) {
        console.error('Lỗi khi tải user:', err);
      }
    };

    const fetchEvents = async () => {
      try {
        const res = await api.get('/events');
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

    fetchUser();
    fetchEvents();
    checkTeamStatus();

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

  const handlePlayVideo = async () => {
    try {
      const videoUrl =
        'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260328_115001_bcdaa3b4-03de-47e7-ad63-ae3e392c32d4.mp4';
      await WebBrowser.openBrowserAsync(videoUrl);
    } catch (error) {
      Alert.alert('Lỗi', 'Không thể mở video giới thiệu.');
    }
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

        <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>

          {/* Thẻ chào mừng User */}
          <View style={styles.welcomeCard}>
            <View style={styles.welcomeRow}>
              <View style={styles.welcomeLeft}>
                <Text style={styles.welcomeGreeting}>
                  Chào mừng, {user?.fullName || user?.email?.split('@')[0] || 'Thí sinh'}!
                </Text>
                <Text style={styles.welcomeSubtext}>
                  Chào mừng bạn đến với hệ thống SEAL HACKATHON 2026. Chúc bạn có trải nghiệm thi đấu xuất sắc!
                </Text>
              </View>
            </View>
          </View>

          {/* Cuộc thi đang diễn ra */}
          <Text style={styles.sectionTitle}>CUỘC THI ĐANG DIỄN RA</Text>
          {loadingEvents ? (
            <ActivityIndicator size="small" color="#ea580c" style={{ marginVertical: 20 }} />
          ) : events.length > 0 ? (
            <View style={styles.eventsContainer}>
              {events.slice(0, 1).map((evt) => {
                const maxTeams = evt.maxTeams || 10;
                const teamCount = evt.teamCount || 0;
                const percent = Math.min(100, (teamCount / maxTeams) * 100);

                let statusLabel = '';
                let statusBg = '#fff7ed';
                let statusColor = '#ea580c';
                switch (evt.status) {
                  case 'registration':
                    statusLabel = 'MỞ ĐĂNG KÝ';
                    statusBg = '#fff7ed';
                    statusColor = '#ea580c';
                    break;
                  case 'ongoing':
                    statusLabel = 'ĐANG DIỄN RA';
                    statusBg = '#e0f2fe';
                    statusColor = '#0284c7';
                    break;
                  case 'completed':
                    statusLabel = 'ĐÃ KẾT THÚC';
                    statusBg = '#dcfce7';
                    statusColor = '#166534';
                    break;
                  default:
                    statusLabel = evt.status.toUpperCase();
                    statusBg = '#f1f5f9';
                    statusColor = '#64748b';
                }

                return (
                  <View key={evt._id} style={styles.eventCard}>
                    <View style={styles.eventHeader}>
                      <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
                        <Text style={[styles.eventStatus, { color: statusColor }]}>{statusLabel}</Text>
                      </View>
                      <Text style={styles.eventSemester}>{evt.semester} {evt.year}</Text>
                    </View>

                    <Text style={styles.eventTitle}>{evt.name}</Text>
                    <Text style={styles.eventDesc} numberOfLines={3}>
                      {evt.description || 'Chưa có mô tả chi tiết cho cuộc thi này.'}
                    </Text>

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
                          activeOpacity={0.85}
                        >
                          <Text style={styles.actionBtnText}>
                            {hasTeam ? 'VÀO KHU VỰC ĐỘI' : 'ĐĂNG KÝ THAM GIA'}
                          </Text>
                        </TouchableOpacity>
                      )}

                      {evt.status === 'ongoing' && (
                        <TouchableOpacity
                          style={styles.actionBtn}
                          onPress={() => navigation.navigate('TeamArea')}
                          activeOpacity={0.85}
                        >
                          <Text style={styles.actionBtnText}>VÀO KHU VỰC THI DỰ ÁN</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.noEventsCard}>
              <Text style={styles.noEventsText}>Hiện chưa có cuộc thi nào mở đăng ký.</Text>
            </View>
          )}
          {/* Thống kê nổi bật */}
          <Text style={styles.sectionTitle}>THÔNG SỐ NỔI BẬT</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Clock size={22} color="#ea580c" style={styles.statIcon} />
              <Text style={styles.statValue}>2 Ngày</Text>
              <Text style={styles.statLabel}>Diễn ra cuộc thi</Text>
            </View>
            <View style={styles.statCard}>
              <Users size={22} color="#ea580c" style={styles.statIcon} />
              <Text style={styles.statValue}>3 - 5</Text>
              <Text style={styles.statLabel}>Thành viên mỗi đội</Text>
            </View>
            <View style={styles.statCard}>
              <Award size={22} color="#ea580c" style={styles.statIcon} />
              <Text style={styles.statValue}>16,5 Tr</Text>
              <Text style={styles.statLabel}>Tổng giải thưởng</Text>
            </View>
          </View>

          {/* Chi tiết các Điều lệ & Quy định (10 Điều) */}
          <Text style={styles.sectionTitle}>ĐIỀU LỆ & QUY ĐỊNH CUỘC THI (10 ĐIỀU)</Text>
          <View style={styles.rulesContainer}>
            {OFFICIAL_RULES.map((rule) => {
              const isExpanded = expandedRuleId === rule.id;
              return (
                <View key={rule.id} style={styles.ruleCard}>
                  <TouchableOpacity
                    style={styles.ruleHeader}
                    onPress={() => setExpandedRuleId(isExpanded ? null : rule.id)}
                    activeOpacity={0.75}
                  >
                    <View style={styles.ruleHeaderLeft}>
                      <FileText size={17} color="#ea580c" />
                      <Text style={styles.ruleTitle}>{rule.title}</Text>
                    </View>
                    {isExpanded ? (
                      <ChevronUp size={18} color="#ea580c" />
                    ) : (
                      <ChevronDown size={18} color="#94a3b8" />
                    )}
                  </TouchableOpacity>
                  {isExpanded && (
                    <View style={styles.ruleBody}>
                      {rule.points.map((pointText, pIdx) => (
                        <Text key={pIdx} style={styles.ruleTextPoint}>
                          {pointText}
                        </Text>
                      ))}
                    </View>
                  )}
                </View>
              );
            })}
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
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
  scrollContainer: {
    padding: 16,
    paddingBottom: 24,
  },
  subHeaderCard: {
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    alignItems: 'center',
  },
  subtitle: {
    color: '#ea580c',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  welcomeCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#fed7aa',
    marginBottom: 16,
    shadowColor: '#ea580c',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  welcomeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  welcomeLeft: {
    flex: 1,
    marginRight: 10,
  },
  welcomeGreeting: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4,
  },
  welcomeSubtext: {
    fontSize: 12,
    color: '#64748b',
    lineHeight: 18,
  },
  welcomeIconBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  aboutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  aboutMeta: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ea580c',
    marginLeft: 6,
    letterSpacing: 1,
  },
  aboutTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 8,
  },
  aboutDescription: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: 1,
    marginTop: 8,
    marginBottom: 10,
  },
  videoSection: {
    marginBottom: 16,
  },
  videoCard: {
    height: 160,
    backgroundColor: '#0f172a',
    borderRadius: 16,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoOverlay: {
    alignItems: 'center',
    padding: 16,
  },
  playButtonGlow: {
    marginBottom: 10,
  },
  playButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#ea580c',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  videoSubtitle: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  statIcon: {
    marginBottom: 6,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '900',
    color: '#ea580c',
  },
  statLabel: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
    textAlign: 'center',
  },
  eventsContainer: {
    gap: 14,
  },
  eventCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  eventStatus: {
    fontSize: 10,
    fontWeight: '800',
  },
  eventSemester: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 6,
  },
  eventDesc: {
    fontSize: 12,
    color: '#64748b',
    lineHeight: 18,
    marginBottom: 12,
  },
  eventFooter: {
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 12,
  },
  teamProgressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressLabel: {
    fontSize: 11,
    color: '#64748b',
  },
  progressValue: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0f172a',
  },
  progressBarBg: {
    height: 6,
    backgroundColor: '#f1f5f9',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#ea580c',
    borderRadius: 3,
  },
  actionBtn: {
    backgroundColor: '#ea580c',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  actionBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  noEventsCard: {
    backgroundColor: '#ea580c',
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  noEventsText: {
    fontSize: 13,
    color: '#64748b',
  },
  rulesContainer: {
    marginBottom: 24,
  },
  ruleCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 10,
  },
  ruleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ruleHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 8,
  },
  ruleTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginLeft: 8,
    flex: 1,
  },
  ruleBody: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  ruleTextPoint: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 20,
    marginBottom: 6,
  },
});
