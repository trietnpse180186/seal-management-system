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
import { BookOpen, Users, Save, RefreshCw, CheckCircle, Clock, MessageSquare, Download, FileText } from 'lucide-react-native';

export default function TeamAreaScreen({ navigation }) {
  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState('project'); // 'project', 'members', 'github'

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
    const hours = Math.floor((diff / 1000 / 60 / 60));
    
    const pad = (num) => num.toString().padStart(2, '0');
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  };

  const handleOpenExamAccess = async () => {
    if (!round?.driveFileUrl) {
      Alert.alert('Thông báo', 'Đề bài chưa được mở.');
      return;
    }
    try {
      await WebBrowser.openBrowserAsync(round.driveFileUrl);
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
    Alert.alert(
      'Hỗ trợ từ Mentor',
      'Tính năng Chat trực tuyến hiện đang được phát triển cho ứng dụng Mobile. Vui lòng truy cập phiên bản Web để gửi tin nhắn hỗ trợ trực tiếp với Mentor của nhóm bạn!'
    );
  };

  const fetchTeamData = async () => {
    try {
      const res = await api.get('/teams/my-team');
      setData(res.data);
      
      const { team, repository } = res.data;
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
      Alert.alert(
        'Không tải được thông tin',
        err.response?.data?.message || 'Bạn chưa có đội thi hoặc đội thi chưa được duyệt.'
      );
      // Quay lại màn hình đăng ký đội thi nếu chưa có đội
      navigation.replace('RegisterTeam');
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
        <ActivityIndicator size="large" color="#00f0ff" />
      </View>
    );
  }

  const { team, members, repository } = data || {};

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00f0ff" />}
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
              {/* BTC Exam Materials Card */}
              <View style={styles.examCard}>
                <View style={styles.sectionTitleRow}>
                  <BookOpen size={16} color="#00f0ff" />
                  <Text style={styles.sectionTitle}>[ĐỀ_BÀI_&_TÀI_LIỆU_THI]</Text>
                </View>

                {round?.startTime && new Date(round.startTime) > currentTime ? (
                  <View style={styles.countdownContainer}>
                    <Text style={styles.countdownLabel}>Đề bài vòng "{round.name}" sẽ được mở sau:</Text>
                    <Text style={styles.countdownTime}>{getRemainingTimeText(round.startTime)}</Text>
                    <Text style={styles.countdownDetail}>Thời gian mở đề: {new Date(round.startTime).toLocaleString('vi-VN')}</Text>
                  </View>
                ) : round?.hasExamMaterial && round?.examOpened ? (
                  <View style={styles.examOpenContainer}>
                    <View style={styles.activeDotRow}>
                      <View style={styles.activeDot} />
                      <Text style={styles.activeLabel}>ĐỀ BÀI ĐÃ MỞ</Text>
                    </View>
                    <Text style={styles.examFileName}>{round.driveFileName || `Đề vòng ${round.name}`}</Text>
                    <Text style={styles.examSubText}>Nhấn nút bên dưới để mở tài liệu trên Google Drive.</Text>
                    <TouchableOpacity style={styles.openExamBtn} onPress={handleOpenExamAccess}>
                      <Text style={styles.openExamBtnText}>MỞ ĐỀ & TÀI LIỆU (GOOGLE DRIVE)</Text>
                    </TouchableOpacity>
                  </View>
                ) : round?.hasExamMaterial ? (
                  <Text style={styles.italicText}>Đề đã được gắn nhưng chưa đến giờ mở hoặc chưa cấu hình thời gian.</Text>
                ) : (
                  <Text style={styles.italicText}>Chưa có đề bài cho vòng thi của bạn.</Text>
                )}
              </View>

              {/* Chat with Mentor Card */}
              {team && team.eventId?.status === 'ongoing' && (
                <View style={styles.chatCard}>
                  <View style={styles.chatHeader}>
                    <View style={styles.chatIconBox}>
                      <MessageSquare size={18} color="#00f0ff" />
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
                  <FileText size={16} color="#00f0ff" />
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
                    <Download size={14} color="#00f0ff" />
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
                <Users size={16} color="#00f0ff" />
                <Text style={styles.sectionTitle}>[DANH_SÁCH_THÀNH_VIÊN]</Text>
              </View>

              {members?.map((m) => (
                <View key={m._id} style={styles.memberCard}>
                  <View style={styles.memberInfo}>
                    <Text style={styles.memberName}>{m.userId?.fullName}</Text>
                    <Text style={styles.memberEmail}>{m.userId?.email}</Text>
                    {m.userId?.studentId && (
                      <Text style={styles.memberSubText}>
                        MSSV: {m.userId.studentId} • Trường: {m.userId.university || 'Đại học FPT'}
                      </Text>
                    )}
                  </View>

                  <View style={[styles.confirmBadge, m.confirmStatus === 'confirmed' ? styles.confirmBadgeSuccess : styles.confirmBadgePending]}>
                    {m.confirmStatus === 'confirmed' ? (
                      <>
                        <CheckCircle size={10} color="#10b981" />
                        <Text style={styles.confirmBadgeTextSuccess}>Đã nhận</Text>
                      </>
                    ) : (
                      <>
                        <Clock size={10} color="#f59e0b" />
                        <Text style={styles.confirmBadgeTextPending}>Chờ...</Text>
                      </>
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
    backgroundColor: '#0a141d',
  },
  container: {
    flex: 1,
  },
  scrollContainer: {
    paddingGrow: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0a141d',
    alignItems: 'center',
    justifyContent: 'center',
  },
  banner: {
    backgroundColor: '#131d25',
    borderColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    padding: 20,
    borderRadius: 6,
    marginBottom: 20,
  },
  bannerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  trackBadge: {
    backgroundColor: 'rgba(0, 240, 255, 0.1)',
    borderColor: 'rgba(0, 240, 255, 0.3)',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 20,
  },
  trackBadgeText: {
    color: '#00f0ff',
    fontSize: 10,
    fontWeight: '700',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 20,
  },
  statusBadgeSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderWidth: 1,
  },
  statusBadgePending: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderColor: 'rgba(245, 158, 11, 0.3)',
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  teamName: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 6,
  },
  eventText: {
    color: '#849495',
    fontSize: 12,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
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
    borderBottomColor: '#00f0ff',
  },
  tabButtonText: {
    color: '#849495',
    fontSize: 13,
    fontWeight: '700',
  },
  tabButtonTextActive: {
    color: '#00f0ff',
  },
  tabContent: {
    marginBottom: 30,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    color: '#00f0ff',
    fontSize: 11,
    fontWeight: '800',
    marginLeft: 8,
    letterSpacing: 1,
  },
  label: {
    color: '#849495',
    fontSize: 10,
    fontWeight: '800',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: '#131d25',
    borderWidth: 1,
    borderColor: '#3b494b',
    color: '#dae3f0',
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    borderRadius: 4,
    marginBottom: 16,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  saveBtn: {
    flexDirection: 'row',
    backgroundColor: '#00f0ff',
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
    marginTop: 10,
  },
  saveBtnText: {
    color: '#000',
    fontWeight: '800',
    fontSize: 13,
    marginLeft: 8,
    letterSpacing: 1.5,
  },
  memberCard: {
    backgroundColor: '#131d25',
    borderColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    marginBottom: 12,
    borderRadius: 4,
  },
  memberInfo: {
    flex: 1,
    marginRight: 10,
  },
  memberName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  memberEmail: {
    color: '#849495',
    fontSize: 11,
  },
  memberSubText: {
    color: '#5c6d70',
    fontSize: 10,
    marginTop: 4,
  },
  confirmBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  confirmBadgeSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  confirmBadgePending: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
  },
  confirmBadgeTextSuccess: {
    color: '#10b981',
    fontSize: 10,
    fontWeight: '700',
    marginLeft: 4,
  },
  confirmBadgeTextPending: {
    color: '#f59e0b',
    fontSize: 10,
    fontWeight: '700',
    marginLeft: 4,
  },
  repoBox: {
    backgroundColor: '#131d25',
    borderColor: '#3b494b',
    borderWidth: 1,
    padding: 16,
    borderRadius: 4,
  },
  repoName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  repoUrl: {
    color: '#849495',
    fontSize: 12,
    marginTop: 4,
    marginBottom: 16,
  },
  syncBtn: {
    flexDirection: 'row',
    borderColor: '#00f0ff',
    borderWidth: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
    marginBottom: 24,
  },
  syncBtnText: {
    color: '#00f0ff',
    fontSize: 12,
    fontWeight: '800',
    marginLeft: 8,
    letterSpacing: 1,
  },
  commitsHeader: {
    color: '#b9cacb',
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    paddingBottom: 6,
  },
  commitItem: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
    paddingVertical: 10,
  },
  commitMsg: {
    color: '#fff',
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
    color: '#00f0ff',
    fontSize: 9,
    fontWeight: '700',
  },
  commitTime: {
    color: '#5c6d70',
    fontSize: 9,
  },
  noCommitsText: {
    color: '#849495',
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: 16,
  },
  noRepoBox: {
    backgroundColor: '#131d25',
    padding: 30,
    alignItems: 'center',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  noRepoIconText: {
    color: '#849495',
    fontWeight: '900',
    fontSize: 32,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginBottom: 12,
  },
  githubIconText: {
    color: '#00f0ff',
    fontWeight: '900',
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginRight: 6,
  },
  noRepoTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
  },
  noRepoText: {
    color: '#849495',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  examCard: {
    backgroundColor: '#131d25',
    borderColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    padding: 16,
    borderRadius: 6,
    marginBottom: 16,
  },
  countdownContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  countdownLabel: {
    color: '#f59e0b',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 6,
    textAlign: 'center',
  },
  countdownTime: {
    color: '#00f0ff',
    fontSize: 22,
    fontWeight: '900',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    backgroundColor: '#0a141d',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
    textAlign: 'center',
    letterSpacing: 2,
    overflow: 'hidden',
  },
  countdownDetail: {
    color: '#5c6d70',
    fontSize: 9,
    marginTop: 6,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
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
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
    marginRight: 6,
  },
  activeLabel: {
    color: '#10b981',
    fontSize: 10,
    fontWeight: '800',
  },
  examFileName: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  examSubText: {
    color: '#849495',
    fontSize: 10,
    marginBottom: 12,
  },
  openExamBtn: {
    backgroundColor: '#00f0ff',
    paddingVertical: 12,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#00f0ff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  openExamBtnText: {
    color: '#000',
    fontSize: 11,
    fontWeight: '850',
    letterSpacing: 0.5,
  },
  italicText: {
    color: '#849495',
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 10,
  },
  chatCard: {
    backgroundColor: '#131d25',
    borderColor: 'rgba(0, 240, 255, 0.15)',
    borderWidth: 1,
    padding: 16,
    borderRadius: 6,
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
    backgroundColor: 'rgba(0, 240, 255, 0.1)',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  chatTitleBox: {
    flex: 1,
  },
  chatCardTitle: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  chatCardDesc: {
    color: '#849495',
    fontSize: 10,
    marginTop: 2,
    lineHeight: 14,
  },
  chatBtn: {
    backgroundColor: '#00f0ff',
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatBtnText: {
    color: '#000',
    fontSize: 11,
    fontWeight: '800',
  },
  infoCard: {
    backgroundColor: '#131d25',
    borderColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    padding: 16,
    borderRadius: 6,
    marginBottom: 16,
  },
  infoBody: {
    paddingVertical: 4,
  },
  infoLabel: {
    color: '#849495',
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  infoValue: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '750',
  },
  infoSubText: {
    color: '#5c6d70',
    fontSize: 9,
    fontStyle: 'italic',
    marginTop: 1,
  },
  infoDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    marginVertical: 10,
  },
  infoBodyText: {
    color: '#cddce0',
    fontSize: 11,
    lineHeight: 16,
  },
  criteriaRow: {
    marginTop: 4,
    spaceY: 2,
  },
  criteriaText: {
    color: '#cddce0',
    fontSize: 11,
    lineHeight: 16,
  },
  criteriaHighlight: {
    color: '#00f0ff',
    fontWeight: '700',
  },
  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0a141d',
    borderColor: 'rgba(0, 240, 255, 0.2)',
    borderWidth: 1,
    paddingVertical: 10,
    borderRadius: 6,
    marginTop: 14,
    gap: 8,
  },
  downloadBtnText: {
    color: '#00f0ff',
    fontSize: 11,
    fontWeight: '800',
  },
  spin: {
    // Rotation is typically handled in JS animation, but here we can rely on standard spinner or simple state text
  },
});
