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
import api from '../api/api';
import BottomTabs from '../components/BottomTabs';
import { BookOpen, Users, Save, RefreshCw, CheckCircle, Clock } from 'lucide-react-native';

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
              <View style={styles.sectionTitleRow}>
                <BookOpen size={16} color="#00f0ff" />
                <Text style={styles.sectionTitle}>[NỘP_ĐỀ_TÀI_&_TÀI_LIỆU]</Text>
              </View>

              <Text style={styles.label}>TÊN ĐỀ TÀI / DỰ ÁN</Text>
              <TextInput
                style={styles.input}
                placeholder="Nhập tên đề tài..."
                placeholderTextColor="#849495"
                value={topicTitle}
                onChangeText={setTopicTitle}
              />

              <Text style={styles.label}>MÔ TẢ NGẮN</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Mô tả dự án Hackathon của đội..."
                placeholderTextColor="#849495"
                value={topicDesc}
                onChangeText={setTopicDesc}
                multiline
                numberOfLines={4}
              />

              <Text style={styles.label}>LINK FILE TÀI LIỆU (DRIVE/PDF)</Text>
              <TextInput
                style={styles.input}
                placeholder="https://drive.google.com/..."
                placeholderTextColor="#849495"
                value={docLink}
                onChangeText={setDocLink}
                keyboardType="url"
                autoCapitalize="none"
              />

              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleSaveTopic}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#000" size="small" />
                ) : (
                  <>
                    <Save size={16} color="#000" />
                    <Text style={styles.saveBtnText}>LƯU THÔNG TIN ĐỀ TÀI</Text>
                  </>
                )}
              </TouchableOpacity>
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
  spin: {
    // Rotation is typically handled in JS animation, but here we can rely on standard spinner or simple state text
  },
});
