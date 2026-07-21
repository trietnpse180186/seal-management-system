import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import api from '../api/api';
import BottomTabs from '../components/BottomTabs';
import HeaderAvatar from '../components/HeaderAvatar';
import socketService from '../api/socketService';
import { BookOpen, Users, Save, RefreshCw, CheckCircle, Clock, MessageSquare, Download, FileText, Video, ExternalLink, Crown, ArrowLeft } from 'lucide-react-native';

export default function TeamAreaScreen({ navigation }) {
  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState('project'); // 'project', 'members', 'github'
  const [unreadCount, setUnreadCount] = useState(0);

  // Form state
  const [topicTitle, setTopicTitle] = useState('');
  const [topicDesc, setTopicDesc] = useState('');
  const [docLink, setDocLink] = useState('');

  // Commit history
  const [commits, setCommits] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Time state for exam countdown
  const [currentTime, setCurrentTime] = useState(new Date());

  const round = data?.team?.trackId?.roundId;
  const isExamVisible = !!(round?.startTime || round?.isExamManualOpen || data?.team?.trackId?.examAccess?.examOpened);

  const formatTimeStr = (date) => {
    if (!date) return '';
    const d = new Date(date);
    const pad = (n) => n.toString().padStart(2, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  };

  useEffect(() => {
    const startTimeStr = round?.startTime;
    if (!startTimeStr) return;

    const startTime = new Date(startTimeStr);
    if (startTime <= new Date()) return;

    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now);
      if (now >= startTime) {
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [round?.startTime]);

  const getRemainingTimeText = (startTimeStr) => {
    const diff = new Date(startTimeStr).getTime() - currentTime.getTime();
    if (diff <= 0) return '00:00:00';

    const seconds = Math.floor((diff / 1000) % 60);
    const minutes = Math.floor((diff / 1000 / 60) % 60);
    const hours = Math.floor((diff / 1000 / 60 / 60) % 24);
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    const pad = (num) => num.toString().padStart(2, '0');
    if (days > 0) {
      return `${days} ngày ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    }
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  };

  const handleOpenExamAccess = async () => {
    const fileUrl = data?.team?.trackId?.examAccess?.examDriveFileUrl || round?.driveFileUrl;
    if (!fileUrl) {
      Alert.alert('Thông báo', 'Đề bài chưa được mở.');
      return;
    }
    try {
      await WebBrowser.openBrowserAsync(fileUrl);
    } catch (error) {
      Alert.alert('Lỗi', 'Không thể mở liên kết Google Drive.');
    }
  };

  const handleOpenPdf = async () => {
    try {
      const pdfUrl = 'http://localhost:5000/THÔNG%20TIN%20VỀ%20CUỘC%20THI.pdf';
      await WebBrowser.openBrowserAsync(pdfUrl);
    } catch (error) {
      Alert.alert('Lỗi', 'Không thể mở tài liệu PDF.');
    }
  };

  const handleMentorChatPress = () => {
    navigation.navigate('Chat', { teamId: data?.team?._id });
  };

  const fetchTeamData = async () => {
    try {
      const res = await api.get('/teams/my-team');
      const team = res.data?.team;
      const isEventEnded = team && (
        team.eventId?.status === 'completed' ||
        team.eventId?.status === 'cancelled' ||
        (team.eventId?.contestEnd && new Date(team.eventId.contestEnd) <= new Date())
      );

      if (!team || isEventEnded) {
        navigation.replace('RegisterTeam');
        return;
      }

      setData(res.data);

      const { repository } = res.data;
      if (team?.topicSubmission) {
        setTopicTitle(team.topicSubmission.title || '');
        setTopicDesc(team.topicSubmission.description || '');
        setDocLink(team.topicSubmission.documentationLink || '');
      }

      if (repository) {
        fetchCommits(team._id);
      }
    } catch (err) {
      console.error(err);
      if (err.response?.status === 404) {
        navigation.replace('RegisterTeam');
      } else {
        Alert.alert(
          'Không tải được thông tin',
          err.response?.data?.message || 'Có lỗi xảy ra khi kết nối máy chủ.'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchCommits = async (teamId) => {
    try {
      const res = await api.get(`/analytics/team/${teamId}/commits`);
      setCommits(res.data || []);
    } catch (err) {
      console.error('Lỗi tải danh sách commits', err);
    }
  };

  useEffect(() => {
    fetchTeamData();

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

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchTeamData();
    setRefreshing(false);
  }, []);

  const handleSaveTopic = async () => {
    if (!topicTitle.trim()) {
      Alert.alert('Lỗi', 'Tên đề tài không được để trống.');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        teamId: data.team._id,
        title: topicTitle.trim(),
        description: topicDesc.trim(),
        documentationLink: docLink.trim(),
      };
      await api.post('/teams/submit-topic', payload);
      Alert.alert('Thành công', 'Đã lưu thông tin đề tài của đội!');
      await fetchTeamData();
    } catch (err) {
      console.error(err);
      Alert.alert('Thất bại', err.response?.data?.message || 'Chỉ có Trưởng nhóm mới được quyền cập nhật đề tài.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSyncRepo = async () => {
    if (!data?.repository) return;
    setSyncing(true);
    try {
      await api.post(`/analytics/repo/${data.repository._id}/sync`);
      Alert.alert('Thành công', 'Đồng bộ mã nguồn từ GitHub thành công!');
      await fetchCommits(data.team._id);
    } catch (err) {
      console.error(err);
      Alert.alert('Thất bại', err.response?.data?.message || 'Đồng bộ thất bại. Kiểm tra kết nối mạng.');
    } finally {
      setSyncing(false);
    }
  };

  const getStatusLabel = (status) => {
    switch (status?.toLowerCase()) {
      case 'confirmed':
        return 'ĐÃ XÁC NHẬN';
      case 'pending_confirm':
        return 'CHỜ DUYỆT';
      default:
        return status?.toUpperCase() || '';
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ea580c" />
      </View>
    );
  }

  const { team, members, repository } = data || {};

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.container}>
        {/* Header Bar với HeaderAvatar */}
        <View style={styles.headerBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBackBtn} activeOpacity={0.7}>
            <ArrowLeft size={22} color="#0f172a" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>KHU VỰC ĐỘI THI</Text>
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

        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ea580c" />}
        >
          {/* Header Banner Đội thi */}
          <View style={styles.banner}>
            <View style={styles.bannerHeader}>
              <View style={styles.trackBadge}>
                <Text style={styles.trackBadgeText}>{team?.trackId?.name || 'Bảng đấu'}</Text>
              </View>
              <View style={[styles.statusBadge, team?.status === 'confirmed' ? styles.statusBadgeSuccess : styles.statusBadgePending]}>
                <Text style={styles.statusBadgeText}>{getStatusLabel(team?.status)}</Text>
              </View>
            </View>
            <Text style={styles.teamName}>{team?.name}</Text>
            <Text style={styles.eventText}>Sự kiện: {team?.eventId?.name}</Text>
          </View>

          {/* Thanh Tab điều hướng */}
          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'project' && styles.tabButtonActive]}
              onPress={() => setActiveTab('project')}
            >
              <Text style={[styles.tabButtonText, activeTab === 'project' && styles.tabButtonTextActive]}>Dự án</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'members' && styles.tabButtonActive]}
              onPress={() => setActiveTab('members')}
            >
              <Text style={[styles.tabButtonText, activeTab === 'members' && styles.tabButtonTextActive]}>Thành viên</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'github' && styles.tabButtonActive]}
              onPress={() => setActiveTab('github')}
            >
              <Text style={[styles.tabButtonText, activeTab === 'github' && styles.tabButtonTextActive]}>GitHub</Text>
            </TouchableOpacity>
          </View>

          {/* Nội dung Tab 1: Đề tài & Dự án */}
          {activeTab === 'project' && (
            <View style={styles.tabContent}>
              {/* Seminar Card */}
              {(() => {
                const seminar = team?.eventId?.seminar;
                const showSeminar = !!(
                  seminar?.scheduledAt &&
                  !isExamVisible &&
                  team?.eventId?.status !== 'ongoing' &&
                  team?.eventId?.status !== 'completed' &&
                  !team?.isEliminated
                );
                if (!showSeminar) return null;
                const isUpcoming = new Date() < new Date(seminar.scheduledAt);
                return (
                  <View style={styles.seminarCard}>
                    <View style={styles.seminarHeader}>
                      <View style={styles.seminarIconBox}>
                        <Video size={18} color="#00f0ff" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 4 }}>
                          <Text style={styles.seminarTag}>[SEMINAR_HƯỚNG_DẪN]</Text>
                          <Text style={[styles.seminarStatusTag, isUpcoming ? styles.tagUpcoming : styles.tagOngoing]}>
                            {isUpcoming ? 'SẮP DIỄN RA' : 'ĐANG DIỄN RA'}
                          </Text>
                        </View>
                        <Text style={styles.seminarTitle}>{seminar.title}</Text>
                        {seminar.description && (
                          <Text style={styles.seminarDesc}>{seminar.description}</Text>
                        )}
                        <Text style={styles.seminarMetaText}>
                          Lịch: {formatTimeStr(seminar.scheduledAt)}
                        </Text>
                      </View>
                    </View>
                    {isUpcoming ? (
                      <View style={styles.countdownContainer}>
                        <Text style={styles.countdownLabel}>Seminar bắt đầu sau:</Text>
                        <Text style={styles.countdownTime}>{getRemainingTimeText(seminar.scheduledAt)}</Text>
                      </View>
                    ) : (
                      seminar.meetUrl && (
                        <TouchableOpacity
                          style={styles.meetBtn}
                          onPress={async () => {
                            try {
                              await WebBrowser.openBrowserAsync(seminar.meetUrl);
                            } catch (e) {
                              Alert.alert('Lỗi', 'Không thể mở phòng Google Meet.');
                            }
                          }}
                        >
                          <Text style={styles.meetBtnText}>THAM GIA GOOGLE MEET</Text>
                        </TouchableOpacity>
                      )
                    )}
                  </View>
                );
              })()}

              {/* BTC Exam Materials Card */}
              {isExamVisible && (
                <View style={styles.examCard}>
                  <View style={styles.sectionTitleRow}>
                    <BookOpen size={16} color="#00f0ff" />
                    <Text style={styles.sectionTitle}>[ĐỀ_BÀI_&_TÀI_LIỆU_THI]</Text>
                  </View>

                  {team?.eventId?.contestStart && new Date(team.eventId.contestStart) > currentTime ? (
                    <View style={styles.countdownContainer}>
                      <Text style={styles.countdownLabel}>Đề bài cuộc thi "{team.eventId.name}" sẽ được mở sau:</Text>
                      <Text style={styles.countdownTime}>{getRemainingTimeText(team.eventId.contestStart)}</Text>
                      <Text style={styles.countdownDetail}>Thời gian mở đề: {formatTimeStr(team.eventId.contestStart)}</Text>
                    </View>
                  ) : round?.startTime && new Date(round.startTime) > currentTime ? (
                    <View style={styles.countdownContainer}>
                      <Text style={styles.countdownLabel}>Đề bài vòng "{round.name}" sẽ được mở sau:</Text>
                      <Text style={styles.countdownTime}>{getRemainingTimeText(round.startTime)}</Text>
                      <Text style={styles.countdownDetail}>Thời gian mở đề: {formatTimeStr(round.startTime)}</Text>
                    </View>
                  ) : team?.trackId?.examAccess?.examOpened ? (
                    <View style={styles.examOpenContainer}>
                      <View style={styles.activeDotRow}>
                        <View style={styles.activeDot} />
                        <Text style={styles.activeLabel}>ĐỀ BÀI ĐÃ MỞ KHÓA — BẢNG {team.trackId.name?.toUpperCase()}</Text>
                      </View>
                      <Text style={styles.examFileName}>
                        {team.trackId.examAccess.examDriveFileName || `Đề thi & Tài liệu hướng dẫn — ${team.trackId.name}`}
                      </Text>
                      <Text style={styles.examSubText}>Nhấn nút bên dưới để mở tài liệu trên Google Drive.</Text>
                      <TouchableOpacity style={styles.openExamBtn} onPress={handleOpenExamAccess}>
                        <Text style={styles.openExamBtnText}>MỞ ĐỀ & TÀI LIỆU (GOOGLE DRIVE)</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <Text style={styles.italicText}>Chưa có đề bài hoặc đề chưa được mở cho bảng đấu của bạn.</Text>
                  )}
                </View>
              )}

              {/* Chat with Mentor Card */}
              {team && team.eventId?.status === 'ongoing' && (
                <View style={styles.chatCard}>
                  <View style={styles.chatHeader}>
                    <View style={styles.chatIconBox}>
                      <MessageSquare size={18} color="#ea580c" />
                    </View>
                    <View style={styles.chatTitleBox}>
                      <Text style={styles.chatCardTitle}>Hỗ trợ từ Mentor</Text>
                      <Text style={styles.chatCardDesc}>Bạn có câu hỏi hoặc cần sự giúp đỡ? Hãy nhắn tin trao đổi trực tiếp với Mentor.</Text>
                    </View>
                  </View>
                  <TouchableOpacity style={styles.chatBtn} onPress={handleMentorChatPress}>
                    <Text style={styles.chatBtnText}>NHẮN TIN NGAY</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Event Info Card */}
              <View style={styles.infoCard}>
                <View style={styles.sectionTitleRow}>
                  <FileText size={16} color="#ea580c" />
                  <Text style={styles.sectionTitle}>[THÔNG_TIN_CUỘC_THI]</Text>
                </View>
                <View style={styles.infoBody}>
                  <Text style={styles.infoLabel}>Chủ đề chính</Text>
                  <Text style={styles.infoValue}>AI-Driven Smart Operations</Text>
                  <Text style={styles.infoSubText}>Turning Real-Time IoT Data into Intelligent Actions</Text>

                  <View style={styles.infoDivider} />

                  <Text style={styles.infoLabel}>Cơ cấu & Lộ trình</Text>
                  <Text style={styles.infoBodyText}>
                    Gồm 3 Track chuyên môn. Vòng bảng chấm điểm AI &amp; thuyết trình 5 phút (QA 3 phút). 02 đội điểm cao nhất mỗi bảng sẽ bước vào Vòng chung kết (Tổng cộng 06 đội).
                  </Text>

                  <View style={styles.infoDivider} />

                  <Text style={styles.infoLabel}>Tiêu chí Vòng bảng</Text>
                  <View style={styles.criteriaRow}>
                    <Text style={styles.criteriaText}>• Xử lý dữ liệu thực tế: <Text style={styles.criteriaHighlight}>30%</Text></Text>
                    <Text style={styles.criteriaText}>• Hiệu quả ứng dụng AI: <Text style={styles.criteriaHighlight}>30%</Text></Text>
                    <Text style={styles.criteriaText}>• Phù hợp Domain &amp; UX: <Text style={styles.criteriaHighlight}>20%</Text></Text>
                    <Text style={styles.criteriaText}>• Ý tưởng &amp; Pitching: <Text style={styles.criteriaHighlight}>20%</Text></Text>
                  </View>

                  <TouchableOpacity style={styles.downloadBtn} onPress={handleOpenPdf}>
                    <Download size={14} color="#ea580c" />
                    <Text style={styles.downloadBtnText}>TẢI THỂ LỆ PDF</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {/* Nội dung Tab 2: Thành viên */}
          {activeTab === 'members' && (
            <View style={styles.tabContent}>
              <View style={styles.sectionTitleRow}>
                <Users size={16} color="#ea580c" />
                <Text style={styles.sectionTitle}>[DANH_SÁCH_THÀNH_VIÊN]</Text>
              </View>

              {members?.map((m) => (
                <View key={m._id} style={styles.memberCard}>
                  <View style={styles.memberInfo}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <Text style={styles.memberName}>{m.userId?.fullName}</Text>
                      {m.role === 'leader' && (
                        <Crown size={12} color="#f59e0b" style={{ marginTop: -1 }} />
                      )}
                    </View>
                    <Text style={styles.memberEmail}>{m.userId?.email}</Text>
                    {(m.userId?.studentId || m.userId?.university) && (
                      <Text style={styles.memberSubText}>
                        {m.userId?.studentId && `MSSV: ${m.userId.studentId}`}
                        {m.userId?.studentId && m.userId?.university && ' • '}
                        Trường: {m.userId?.university || 'Đại học FPT'}
                      </Text>
                    )}
                  </View>

                  <View style={styles.badgeContainer}>
                    {m.confirmStatus === 'confirmed' ? (
                      m.role === 'leader' ? (
                        <View style={styles.leaderBadge}>
                          <Text style={styles.leaderBadgeText}>LEADER</Text>
                        </View>
                      ) : (
                        <View style={styles.memberBadge}>
                          <Text style={styles.memberBadgeText}>MEMBER</Text>
                        </View>
                      )
                    ) : (
                      <View style={styles.pendingBadge}>
                        <Clock size={10} color="#849495" />
                        <Text style={styles.pendingBadgeText}>CHỜ DUYỆT</Text>
                      </View>
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Nội dung Tab 3: Github Integration */}
          {activeTab === 'github' && (
            <View style={styles.tabContent}>
              <View style={styles.sectionTitleRow}>
                <Text style={styles.githubIconText}>[Git]</Text>
                <Text style={styles.sectionTitle}>[KHO_LƯU_TRỮ_GITHUB]</Text>
              </View>

              {repository ? (
                <View style={styles.repoBox}>
                  <Text style={styles.repoName}>{repository.name || 'Kho lưu trữ'}</Text>
                  <Text style={styles.repoUrl} numberOfLines={1}>{repository.url}</Text>

                  <TouchableOpacity
                    style={styles.syncBtn}
                    onPress={handleSyncRepo}
                    disabled={syncing}
                  >
                    <RefreshCw size={14} color="#00f0ff" style={syncing && styles.spin} />
                    <Text style={styles.syncBtnText}>{syncing ? 'ĐANG ĐỒNG BỘ...' : 'ĐỒNG BỘ MÃ NGUỒN'}</Text>
                  </TouchableOpacity>

                  {/* Commits List */}
                  <Text style={styles.commitsHeader}>CÁC COMMITS GẦN NHẤT ({commits.length})</Text>
                  {commits.map((c) => (
                    <View key={c._id} style={styles.commitItem}>
                      <Text style={styles.commitMsg} numberOfLines={1}>{c.message}</Text>
                      <View style={styles.commitMeta}>
                        <Text style={styles.commitAuthor}>@{c.authorGithubUsername || 'developer'}</Text>
                        <Text style={styles.commitTime}>
                          {new Date(c.committedAt).toLocaleDateString()} {new Date(c.committedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      </View>
                    </View>
                  ))}
                  {commits.length === 0 ? (
                    <Text style={styles.noCommitsText}>Chưa có commits được đồng bộ.</Text>
                  ) : null}
                </View>
              ) : (
                <View style={styles.noRepoBox}>
                  <Text style={styles.noRepoIconText}>[GitHub]</Text>
                  <Text style={styles.noRepoTitle}>Chưa cấu hình Repo</Text>
                  <Text style={styles.noRepoText}>
                    Hệ thống sẽ tự động khởi tạo kho lưu trữ GitHub ngay khi tất cả thành viên trong nhóm xác nhận tham gia qua email.
                  </Text>
                </View>
              )}
            </View>
          )}
        </ScrollView>

        <BottomTabs activeTab="team" navigation={navigation} />
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerBackBtn: {
    padding: 4,
  },
  headerTitle: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '800',
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
  scrollContainer: {
    padding: 16,
    paddingBottom: 24,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  banner: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderWidth: 1,
    padding: 18,
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  bannerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  trackBadge: {
    backgroundColor: '#fff7ed',
    borderColor: '#fed7aa',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
  },
  trackBadgeText: {
    color: '#ea580c',
    fontSize: 10,
    fontWeight: '700',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
  },
  statusBadgeSuccess: {
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
    fontWeight: '700',
    color: '#0f172a',
  },
  teamName: {
    color: '#0f172a',
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 4,
  },
  eventText: {
    color: '#64748b',
    fontSize: 12,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    marginBottom: 16,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabButtonActive: {
    borderBottomColor: '#ea580c',
  },
  tabButtonText: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '700',
  },
  tabButtonTextActive: {
    color: '#ea580c',
  },
  tabContent: {
    marginBottom: 30,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    color: '#ea580c',
    fontSize: 12,
    fontWeight: '800',
    marginLeft: 8,
    letterSpacing: 0.5,
  },
  label: {
    color: '#475569',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    color: '#0f172a',
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    borderRadius: 10,
    marginBottom: 14,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  saveBtn: {
    flexDirection: 'row',
    backgroundColor: '#ea580c',
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    marginTop: 6,
    shadowColor: '#ea580c',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  saveBtnText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 13,
    marginLeft: 8,
    letterSpacing: 0.5,
  },
  memberCard: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
  },
  memberInfo: {
    flex: 1,
    marginRight: 10,
  },
  memberName: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  memberEmail: {
    color: '#64748b',
    fontSize: 11,
  },
  memberSubText: {
    color: '#94a3b8',
    fontSize: 10,
    marginTop: 4,
  },
  confirmBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  confirmBadgeSuccess: {
    backgroundColor: '#dcfce7',
  },
  confirmBadgePending: {
    backgroundColor: '#fff7ed',
  },
  confirmBadgeTextSuccess: {
    color: '#166534',
    fontSize: 10,
    fontWeight: '700',
    marginLeft: 4,
  },
  confirmBadgeTextPending: {
    color: '#c2410c',
    fontSize: 10,
    fontWeight: '700',
    marginLeft: 4,
  },
  repoBox: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderWidth: 1,
    padding: 16,
    borderRadius: 12,
  },
  repoName: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '800',
  },
  repoUrl: {
    color: '#ea580c',
    fontSize: 12,
    marginTop: 4,
  },
  syncBtn: {
    flexDirection: 'row',
    borderColor: '#ea580c',
    borderWidth: 1,
    backgroundColor: '#fff7ed',
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    marginBottom: 20,
    marginTop: 10,
  },
  syncBtnText: {
    color: '#ea580c',
    fontSize: 12,
    fontWeight: '800',
    marginLeft: 8,
  },
  commitsHeader: {
    color: '#0f172a',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingBottom: 6,
  },
  commitItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingVertical: 10,
  },
  commitMsg: {
    color: '#1e293b',
    fontSize: 12,
    fontWeight: '600',
  },
  commitMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  commitAuthor: {
    color: '#ea580c',
    fontSize: 10,
    fontWeight: '700',
  },
  commitTime: {
    color: '#94a3b8',
    fontSize: 10,
  },
  noCommitsText: {
    color: '#64748b',
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: 16,
  },
  noRepoBox: {
    backgroundColor: '#ffffff',
    padding: 30,
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  noRepoIconText: {
    color: '#94a3b8',
    fontWeight: '900',
    fontSize: 32,
    marginBottom: 12,
  },
  githubIconText: {
    color: '#ea580c',
    fontWeight: '900',
    fontSize: 14,
    marginRight: 6,
  },
  noRepoTitle: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
  },
  noRepoText: {
    color: '#64748b',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  examCard: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderWidth: 1,
    padding: 16,
    borderRadius: 14,
    marginBottom: 16,
  },
  countdownContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  countdownLabel: {
    color: '#ea580c',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 6,
    textAlign: 'center',
  },
  countdownTime: {
    color: '#ea580c',
    fontSize: 22,
    fontWeight: '900',
    backgroundColor: '#fff7ed',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fed7aa',
    textAlign: 'center',
    letterSpacing: 2,
    overflow: 'hidden',
  },
  countdownDetail: {
    color: '#64748b',
    fontSize: 10,
    marginTop: 6,
  },
  examOpenContainer: {
    paddingVertical: 4,
  },
  activeDotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10b981',
    marginRight: 6,
  },
  activeLabel: {
    color: '#10b981',
    fontSize: 11,
    fontWeight: '800',
  },
  examFileName: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  examSubText: {
    color: '#64748b',
    fontSize: 11,
    marginBottom: 12,
  },
  openExamBtn: {
    backgroundColor: '#ea580c',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#ea580c',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  openExamBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  italicText: {
    color: '#64748b',
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 10,
  },
  chatCard: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderWidth: 1,
    padding: 16,
    borderRadius: 14,
    marginBottom: 16,
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  chatIconBox: {
    width: 36,
    height: 36,
    backgroundColor: '#fff7ed',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  chatTitleBox: {
    flex: 1,
  },
  chatCardTitle: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '700',
  },
  chatCardDesc: {
    color: '#64748b',
    fontSize: 10,
    marginTop: 2,
    lineHeight: 14,
  },
  chatBtn: {
    backgroundColor: '#ea580c',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  infoCard: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderWidth: 1,
    padding: 16,
    borderRadius: 14,
    marginBottom: 16,
  },
  infoBody: {
    paddingVertical: 4,
  },
  infoLabel: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  infoValue: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '750',
  },
  infoSubText: {
    color: '#94a3b8',
    fontSize: 10,
    fontStyle: 'italic',
    marginTop: 1,
  },
  infoDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 10,
  },
  infoBodyText: {
    color: '#334155',
    fontSize: 12,
    lineHeight: 18,
  },
  criteriaRow: {
    marginTop: 4,
  },
  criteriaText: {
    color: '#334155',
    fontSize: 12,
    lineHeight: 18,
  },
  criteriaHighlight: {
    color: '#ea580c',
    fontWeight: '700',
  },
  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff7ed',
    borderColor: '#fed7aa',
    borderWidth: 1,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 14,
    gap: 8,
  },
  downloadBtnText: {
    color: '#ea580c',
    fontSize: 12,
    fontWeight: '800',
  },
  seminarCard: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderWidth: 1,
    padding: 16,
    borderRadius: 14,
    marginBottom: 16,
  },
  seminarHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  seminarIconBox: {
    width: 36,
    height: 36,
    backgroundColor: '#fff7ed',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  seminarTag: {
    color: '#ea580c',
    fontSize: 10,
    fontWeight: '800',
  },
  seminarStatusTag: {
    fontSize: 9,
    fontWeight: '800',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tagUpcoming: {
    backgroundColor: '#f1f5f9',
    color: '#64748b',
  },
  tagOngoing: {
    backgroundColor: '#dcfce7',
    color: '#166534',
  },
  seminarTitle: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  seminarDesc: {
    color: '#64748b',
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 8,
  },
  seminarMetaText: {
    color: '#334155',
    fontSize: 11,
    fontWeight: '600',
  },
  meetBtn: {
    backgroundColor: '#10b981',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  meetBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  leaderBadge: {
    backgroundColor: '#fff7ed',
    borderColor: '#fed7aa',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  leaderBadgeText: {
    color: '#ea580c',
    fontSize: 10,
    fontWeight: '800',
  },
  memberBadge: {
    backgroundColor: '#f1f5f9',
    borderColor: '#e2e8f0',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  memberBadgeText: {
    color: '#10b981',
    fontSize: 9,
    fontWeight: '800',
  },
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 4,
  },
  pendingBadgeText: {
    color: '#849495',
    fontSize: 9,
    fontWeight: '700',
  },
});
