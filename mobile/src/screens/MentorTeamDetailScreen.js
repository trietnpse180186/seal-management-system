import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../api/api';
import {
  ArrowLeft,
  Users,
  GitBranch,
  Code2,
  MessageSquare,
  Mail,
  School,
  FileText,
  ExternalLink,
  CheckCircle,
  Clock,
} from 'lucide-react-native';

export default function MentorTeamDetailScreen({ route, navigation }) {
  const { teamId } = route.params || {};

  const [team, setTeam] = useState(null);
  const [members, setMembers] = useState([]);
  const [repo, setRepo] = useState(null);
  const [commits, setCommits] = useState([]);

  const [activeTab, setActiveTab] = useState('members'); // 'members' | 'commits'
  const [loading, setLoading] = useState(true);

  const fetchTeamDetails = async () => {
    setLoading(true);
    try {
      // 1. Tải thông tin chi tiết đội thi
      const resTeam = await api.get(`/teams/${teamId}`);
      const teamData = resTeam.data?.team || resTeam.data;
      const memberList = resTeam.data?.members || teamData?.members || [];
      setTeam(teamData);
      setMembers(memberList);

      // 2. Tải thông tin Repository GitHub
      try {
        const resRepo = await api.get(`/github-repositories/team/${teamId}`);
        setRepo(resRepo.data || null);
      } catch (err) {
        setRepo(null);
      }

      // 3. Tải danh sách Commits
      try {
        const resCommits = await api.get(`/commits/team/${teamId}`);
        setCommits(resCommits.data || []);
      } catch (err) {
        setCommits([]);
      }
    } catch (err) {
      console.warn('Lỗi khi tải chi tiết đội thi:', err.message || err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (teamId) {
      fetchTeamDetails();
    }
  }, [teamId]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#ea580c" />
          <Text style={styles.loadingText}>Đang tải chi tiết đội thi...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!team) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerBox}>
          <Text style={styles.emptyText}>Không tìm thấy thông tin đội thi này.</Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backBtnText}>Quay lại</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.container}>
        {/* Top Header */}
        <View style={styles.topHeader}>
          <TouchableOpacity
            style={styles.backIconButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <ArrowLeft size={20} color="#0f172a" />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 8 }}>
            <Text style={styles.topHeaderTitle} numberOfLines={1}>
              {team.name}
            </Text>
            <Text style={styles.topHeaderSub}>
              Bảng: {team.trackId?.name || 'Mặc định'}
            </Text>
          </View>
        </View>

        {/* Hero Banner Card */}
        <View style={styles.bannerCard}>
          <Text style={styles.teamNameTitle}>{team.name}</Text>
          {team.topicTitle ? (
            <Text style={styles.topicTitleText}>Đề tài: {team.topicTitle}</Text>
          ) : null}

          {repo?.repoUrl ? (
            <TouchableOpacity
              style={styles.repoLinkRow}
              onPress={() => Linking.openURL(repo.repoUrl)}
              activeOpacity={0.8}
            >
              <Code2 size={16} color="#0284c7" />
              <Text style={styles.repoLinkText} numberOfLines={1}>
                {repo.repoUrl}
              </Text>
              <ExternalLink size={14} color="#0284c7" />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Tab Navigation */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'members' && styles.tabItemActive]}
            onPress={() => setActiveTab('members')}
            activeOpacity={0.7}
          >
            <Users size={16} color={activeTab === 'members' ? '#ea580c' : '#64748b'} />
            <Text
              style={[
                styles.tabLabel,
                activeTab === 'members' && styles.tabLabelActive,
              ]}
            >
              Thành viên ({members.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'commits' && styles.tabItemActive]}
            onPress={() => setActiveTab('commits')}
            activeOpacity={0.7}
          >
            <GitBranch size={16} color={activeTab === 'commits' ? '#ea580c' : '#64748b'} />
            <Text
              style={[
                styles.tabLabel,
                activeTab === 'commits' && styles.tabLabelActive,
              ]}
            >
              Commits ({commits.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tab Content */}
        <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent}>
          {activeTab === 'members' ? (
            /* TAB THÀNH VIÊN */
            <View style={styles.membersList}>
              {members.map((m, idx) => {
                const userObj = m.userId || m;
                const name = userObj.fullName || 'Thành viên';
                const email = userObj.email || '';
                const studentId = userObj.studentId || '';
                const university = userObj.university || '';
                const githubUser = userObj.githubUsername || '';
                const isLeader = team.leaderId === userObj._id || team.leaderId?._id === userObj._id;

                return (
                  <View key={userObj._id || idx} style={styles.memberCard}>
                    <View style={styles.memberCardHeader}>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={styles.memberCardName}>{name}</Text>
                          {isLeader && (
                            <View style={styles.leaderChip}>
                              <Text style={styles.leaderChipText}>Đội trưởng</Text>
                            </View>
                          )}
                        </View>

                        {email ? (
                          <View style={styles.infoRow}>
                            <Mail size={12} color="#64748b" />
                            <Text style={styles.infoText}>{email}</Text>
                          </View>
                        ) : null}
                      </View>

                      <View style={styles.confirmedBadge}>
                        <CheckCircle size={12} color="#16a34a" />
                        <Text style={styles.confirmedBadgeText}>Đã xác nhận</Text>
                      </View>
                    </View>

                    <View style={styles.memberMetaRow}>
                      {studentId ? (
                        <View style={styles.metaChip}>
                          <FileText size={12} color="#475569" />
                          <Text style={styles.metaChipText}>{studentId}</Text>
                        </View>
                      ) : null}

                      {university ? (
                        <View style={styles.metaChip}>
                          <School size={12} color="#475569" />
                          <Text style={styles.metaChipText}>{university}</Text>
                        </View>
                      ) : null}

                      {githubUser ? (
                        <TouchableOpacity
                          style={styles.githubChip}
                          onPress={() => Linking.openURL(`https://github.com/${githubUser}`)}
                        >
                          <Code2 size={12} color="#0f172a" />
                          <Text style={styles.githubChipText}>@{githubUser}</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            /* TAB GITHUB COMMITS */
            <View style={styles.commitsSection}>
              {commits.length === 0 ? (
                <View style={styles.emptyCard}>
                  <GitBranch size={40} color="#cbd5e1" />
                  <Text style={styles.emptyTitle}>Chưa có Commit nào</Text>
                  <Text style={styles.emptySub}>
                    Đội thi chưa đẩy commit nào lên kho lưu trữ GitHub.
                  </Text>
                </View>
              ) : (
                commits.map((c, idx) => (
                  <View key={c._id || idx} style={styles.commitCard}>
                    <View style={styles.commitHeaderRow}>
                      <View style={styles.commitMessageRow}>
                        <GitBranch size={16} color="#ea580c" />
                        <Text style={styles.commitMessage} numberOfLines={2}>
                          {c.message || 'Không có mô tả commit'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.commitMetaRow}>
                      <Text style={styles.commitAuthor}>
                        Tác giả: <Text style={{ fontWeight: '700', color: '#1e293b' }}>{c.authorName || c.authorEmail || 'N/A'}</Text>
                      </Text>
                      {c.commitDate ? (
                        <View style={styles.commitTimeRow}>
                          <Clock size={12} color="#64748b" />
                          <Text style={styles.commitTime}>
                            {new Date(c.commitDate).toLocaleString('vi-VN')}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                ))
              )}
            </View>
          )}
        </ScrollView>

        {/* Fixed Action Button: Open Chat */}
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={styles.openChatBtn}
            onPress={() => navigation.navigate('Chat')}
            activeOpacity={0.85}
          >
            <MessageSquare size={18} color="#ffffff" />
            <Text style={styles.openChatBtnText}>Mở khung Chat hỗ trợ Đội thi</Text>
          </TouchableOpacity>
        </View>
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
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 10,
  },
  emptyText: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 12,
  },
  backBtn: {
    backgroundColor: '#ea580c',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  backBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  backIconButton: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
  },
  topHeaderTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  topHeaderSub: {
    fontSize: 11,
    color: '#64748b',
  },
  bannerCard: {
    backgroundColor: '#ffffff',
    margin: 16,
    marginBottom: 8,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  teamNameTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  topicTitleText: {
    fontSize: 13,
    color: '#475569',
    marginTop: 4,
  },
  repoLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#bae6fd',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 10,
  },
  repoLinkText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: '#0284c7',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 4,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
  },
  tabItemActive: {
    backgroundColor: '#fff7ed',
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
  tabLabelActive: {
    color: '#ea580c',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 80,
  },
  membersList: {
    gap: 10,
  },
  memberCard: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  memberCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  memberCardName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  leaderChip: {
    backgroundColor: '#ea580c',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  leaderChipText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '800',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  infoText: {
    fontSize: 11,
    color: '#64748b',
  },
  confirmedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#dcfce7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  confirmedBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#15803d',
  },
  memberMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  metaChipText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
  },
  githubChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  githubChipText: {
    fontSize: 11,
    color: '#0f172a',
    fontWeight: '700',
  },
  commitsSection: {
    gap: 8,
  },
  emptyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#334155',
    marginTop: 10,
  },
  emptySub: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 4,
  },
  commitCard: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  commitHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  commitMessageRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    flex: 1,
  },
  commitMessage: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
    lineHeight: 18,
  },
  commitMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  commitAuthor: {
    fontSize: 11,
    color: '#64748b',
  },
  commitTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  commitTime: {
    fontSize: 10,
    color: '#64748b',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  openChatBtn: {
    backgroundColor: '#ea580c',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
  },
  openChatBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
});
