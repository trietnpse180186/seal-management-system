import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../api/api';
import BottomTabs from '../components/BottomTabs';
import { UserPlus, Trash2, Calendar, ClipboardList } from 'lucide-react-native';

export default function RegisterTeamScreen({ navigation }) {
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [teamName, setTeamName] = useState('');
  const [showEventSelectModal, setShowEventSelectModal] = useState(false);

  // Leader info
  const [leaderFullName, setLeaderFullName] = useState('');
  const [leaderStudentId, setLeaderStudentId] = useState('');
  const [leaderGithubUsername, setLeaderGithubUsername] = useState('');
  const [leaderUniversity, setLeaderUniversity] = useState('');

  // Members list
  const [members, setMembers] = useState([]);

  const [loading, setLoading] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Tải các sự kiện đang mở đăng ký
    const fetchEvents = async () => {
      try {
        const res = await api.get('/events');
        const activeEvents = res.data.filter((e) => e.status === 'registration');
        setEvents(activeEvents);
        if (activeEvents.length > 0) {
          setSelectedEventId(activeEvents[0]._id);
        }
      } catch (err) {
        console.error('Lỗi tải sự kiện:', err);
      }
    };

    // Tải thông tin cá nhân của trưởng nhóm để điền trước
    const fetchProfile = async () => {
      try {
        const res = await api.get('/auth/me');
        const u = res.data.user;
        if (u) {
          setLeaderFullName(u.fullName || '');
          setLeaderStudentId(u.studentId || '');
          setLeaderGithubUsername(u.githubUsername || '');
          setLeaderUniversity(u.university || '');
        }
      } catch (err) {
        console.error('Lỗi tải thông tin trưởng nhóm:', err);
      } finally {
        setLoadingProfile(false);
      }
    };

    fetchEvents();
    fetchProfile();
  }, []);

  const addMemberRow = () => {
    setMembers([
      ...members,
      { email: '', fullName: '', githubUsername: '', studentId: '', university: '' },
    ]);
  };

  const removeMemberRow = (index) => {
    const updated = [...members];
    updated.splice(index, 1);
    setMembers(updated);
  };

  const handleMemberChange = (index, field, value) => {
    const updated = [...members];
    updated[index][field] = value;
    setMembers(updated);
  };

  const handleSubmit = async () => {
    if (!selectedEventId) {
      Alert.alert('Lỗi', 'Không có sự kiện đăng ký nào được chọn.');
      return;
    }
    if (!teamName.trim()) {
      Alert.alert('Lỗi', 'Tên đội thi không được để trống.');
      return;
    }
    if (!leaderFullName.trim() || !leaderStudentId.trim()) {
      Alert.alert('Lỗi', 'Họ tên và Mã số sinh viên của bạn (Trưởng nhóm) là bắt buộc.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        eventId: selectedEventId,
        teamName: teamName.trim(),
        membersList: members.filter((m) => m.email.trim() !== ''),
        leaderInfo: {
          fullName: leaderFullName.trim(),
          studentId: leaderStudentId.trim(),
          githubUsername: leaderGithubUsername.trim(),
          university: leaderUniversity.trim(),
        },
      };

      const res = await api.post('/teams/register', payload);
      setSuccess(true);
      Alert.alert('Thành công', res.data.message || 'Đăng ký đội thành công!');
      setTimeout(() => {
        navigation.replace('TeamArea');
      }, 2000);
    } catch (err) {
      console.error(err);
      const errMsg = err.response?.data?.message || 'Có lỗi xảy ra khi đăng ký đội.';
      Alert.alert('Thất bại', errMsg);
    } finally {
      setLoading(false);
    }
  };

  if (loadingProfile) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00f0ff" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={styles.container}>
          <ScrollView contentContainerStyle={styles.scrollContainer}>
            <View style={styles.header}>
              <ClipboardList size={22} color="#00f0ff" />
              <Text style={styles.headerTitle}>ĐĂNG KÝ ĐỘI THI</Text>
            </View>

            {events.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Calendar size={48} color="#849495" style={styles.lockIcon} />
                <Text style={styles.emptyText}>Hiện tại không có cuộc thi nào đang trong giai đoạn đăng ký nhóm.</Text>
              </View>
            ) : (
              <View style={styles.form}>
                {/* Chọn Sự kiện */}
                <Text style={styles.label}>CHỌN CUỘC THI DỰ THI</Text>
                <TouchableOpacity
                  style={styles.dropdownButton}
                  onPress={() => setShowEventSelectModal(true)}
                >
                  <Text style={styles.dropdownButtonText}>
                    {events.find(e => e._id === selectedEventId)?.name || 'Chọn cuộc thi...'}
                  </Text>
                  <Text style={styles.dropdownArrow}>▼</Text>
                </TouchableOpacity>

                {/* Modal Chọn Sự kiện */}
                <Modal
                  visible={showEventSelectModal}
                  transparent={true}
                  animationType="fade"
                  onRequestClose={() => setShowEventSelectModal(false)}
                >
                  <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setShowEventSelectModal(false)}
                  >
                    <View style={styles.modalContent}>
                      <Text style={styles.modalTitle}>CHỌN CUỘC THI DỰ THI</Text>
                      <ScrollView style={styles.modalList} maxScrollHeight={300}>
                        {events.map((e) => (
                          <TouchableOpacity
                            key={e._id}
                            style={[
                              styles.modalItem,
                              selectedEventId === e._id && styles.modalItemActive
                            ]}
                            onPress={() => {
                              setSelectedEventId(e._id);
                              setShowEventSelectModal(false);
                            }}
                          >
                            <Text
                              style={[
                                styles.modalItemText,
                                selectedEventId === e._id && styles.modalItemTextActive
                              ]}
                            >
                              {e.name}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                      
                      <TouchableOpacity
                        style={styles.modalCloseBtn}
                        onPress={() => setShowEventSelectModal(false)}
                      >
                        <Text style={styles.modalCloseBtnText}>ĐÓNG</Text>
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                </Modal>

                {/* Tên Đội */}
                <Text style={styles.label}>TÊN ĐỘI THI</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Nhập tên đội thi..."
                  placeholderTextColor="#849495"
                  value={teamName}
                  onChangeText={setTeamName}
                />

                {/* Thông tin Trưởng nhóm */}
                <Text style={styles.sectionHeader}>THÔNG TIN TRƯỞNG NHÓM (BẠN)</Text>
                <View style={styles.sectionBox}>
                  <Text style={styles.subLabel}>Họ và tên</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Họ tên trưởng nhóm..."
                    placeholderTextColor="#849495"
                    value={leaderFullName}
                    onChangeText={setLeaderFullName}
                  />

                  <Text style={styles.subLabel}>Mã số sinh viên</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="MSSV..."
                    placeholderTextColor="#849495"
                    value={leaderStudentId}
                    onChangeText={setLeaderStudentId}
                  />

                  <Text style={styles.subLabel}>Tài khoản Github (Username)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Github Username..."
                    placeholderTextColor="#849495"
                    value={leaderGithubUsername}
                    onChangeText={setLeaderGithubUsername}
                    autoCapitalize="none"
                  />

                  <Text style={styles.subLabel}>Trường đại học</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Đại học FPT..."
                    placeholderTextColor="#849495"
                    value={leaderUniversity}
                    onChangeText={setLeaderUniversity}
                  />
                </View>

                {/* Danh sách thành viên */}
                <View style={styles.membersHeader}>
                  <Text style={styles.sectionHeader}>THÀNH VIÊN ĐỘI THI ({members.length})</Text>
                  <TouchableOpacity style={styles.addBtn} onPress={addMemberRow}>
                    <UserPlus size={16} color="#00f0ff" />
                    <Text style={styles.addBtnText}>Thêm</Text>
                  </TouchableOpacity>
                </View>

                {members.map((member, index) => (
                  <View key={index} style={styles.memberBox}>
                    <View style={styles.memberBoxHeader}>
                      <Text style={styles.memberTitle}>Thành viên #{index + 1}</Text>
                      <TouchableOpacity onPress={() => removeMemberRow(index)}>
                        <Trash2 size={16} color="#ef4444" />
                      </TouchableOpacity>
                    </View>

                    <Text style={styles.subLabel}>Email thành viên</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="email@student.fpt.edu.vn..."
                      placeholderTextColor="#849495"
                      value={member.email}
                      onChangeText={(val) => handleMemberChange(index, 'email', val)}
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />

                    <Text style={styles.subLabel}>Họ và tên</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Họ và tên thành viên..."
                      placeholderTextColor="#849495"
                      value={member.fullName}
                      onChangeText={(val) => handleMemberChange(index, 'fullName', val)}
                    />

                    <Text style={styles.subLabel}>Mã số sinh viên</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="MSSV..."
                      placeholderTextColor="#849495"
                      value={member.studentId}
                      onChangeText={(val) => handleMemberChange(index, 'studentId', val)}
                    />

                    <Text style={styles.subLabel}>Tài khoản Github (Username)</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Github Username..."
                      placeholderTextColor="#849495"
                      value={member.githubUsername}
                      onChangeText={(val) => handleMemberChange(index, 'githubUsername', val)}
                      autoCapitalize="none"
                    />

                    <Text style={styles.subLabel}>Trường đại học</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Trường đại học..."
                      placeholderTextColor="#849495"
                      value={member.university}
                      onChangeText={(val) => handleMemberChange(index, 'university', val)}
                    />
                  </View>
                ))}

                <TouchableOpacity
                  style={styles.submitBtn}
                  onPress={handleSubmit}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#000" />
                  ) : (
                    <Text style={styles.submitBtnText}>ĐĂNG KÝ THÀNH LẬP ĐỘI</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>

          <BottomTabs activeTab="team" navigation={navigation} />
        </View>
      </KeyboardAvoidingView>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 4,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    marginLeft: 10,
    letterSpacing: 1.5,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 20,
  },
  lockIcon: {
    marginBottom: 16,
  },
  emptyText: {
    color: '#849495',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  form: {
    marginBottom: 20,
  },
  label: {
    color: '#849495',
    fontSize: 10,
    fontWeight: '800',
    marginBottom: 8,
    letterSpacing: 1,
  },
  eventList: {
    marginBottom: 16,
  },
  eventCard: {
    backgroundColor: '#131d25',
    borderColor: '#3b494b',
    borderWidth: 1,
    padding: 14,
    borderRadius: 4,
    marginBottom: 8,
  },
  eventCardActive: {
    borderColor: '#00f0ff',
    backgroundColor: 'rgba(0, 240, 255, 0.05)',
  },
  eventCardText: {
    color: '#b9cacb',
    fontSize: 13,
    fontWeight: '700',
  },
  eventCardTextActive: {
    color: '#00f0ff',
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
  dropdownButton: {
    backgroundColor: '#131d25',
    borderWidth: 1,
    borderColor: '#3b494b',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  dropdownButtonText: {
    color: '#dae3f0',
    fontSize: 14,
    fontWeight: '600',
  },
  dropdownArrow: {
    color: '#00f0ff',
    fontSize: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(6, 15, 23, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    backgroundColor: '#131d25',
    borderColor: '#00f0ff',
    borderWidth: 1,
    borderRadius: 4,
    padding: 20,
    maxHeight: '80%',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 16,
    letterSpacing: 1.5,
  },
  modalList: {
    marginBottom: 16,
  },
  modalItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  modalItemActive: {
    backgroundColor: 'rgba(0, 240, 255, 0.05)',
  },
  modalItemText: {
    color: '#b9cacb',
    fontSize: 14,
    fontWeight: '600',
  },
  modalItemTextActive: {
    color: '#00f0ff',
  },
  modalCloseBtn: {
    borderColor: '#00f0ff',
    borderWidth: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 4,
  },
  modalCloseBtnText: {
    color: '#00f0ff',
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 1,
  },
  sectionHeader: {
    color: '#00f0ff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: 10,
    marginBottom: 12,
  },
  sectionBox: {
    backgroundColor: 'rgba(19, 29, 37, 0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
    padding: 16,
    borderRadius: 4,
    marginBottom: 20,
  },
  subLabel: {
    color: '#849495',
    fontSize: 11,
    marginBottom: 4,
    fontWeight: '600',
  },
  membersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 12,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderColor: '#00f0ff',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  addBtnText: {
    color: '#00f0ff',
    fontSize: 11,
    fontWeight: '800',
    marginLeft: 6,
  },
  memberBox: {
    backgroundColor: '#131d25',
    borderColor: '#3b494b',
    borderWidth: 1,
    padding: 16,
    borderRadius: 4,
    marginBottom: 16,
  },
  memberBoxHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
    paddingBottom: 6,
  },
  memberTitle: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  submitBtn: {
    backgroundColor: '#00f0ff',
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 4,
    marginTop: 20,
    marginBottom: 30,
  },
  submitBtnText: {
    color: '#000',
    fontWeight: '800',
    letterSpacing: 1.5,
    fontSize: 14,
  },
});
