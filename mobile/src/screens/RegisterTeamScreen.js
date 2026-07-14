import React, { useState, useEffect, useRef } from 'react';
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
import { SvgXml } from 'react-native-svg';
import api from '../api/api';
import BottomTabs from '../components/BottomTabs';
import GithubUserAutocomplete from '../components/GithubUserAutocomplete';
import UniversityCombobox from '../components/UniversityCombobox';
import { UserPlus, Trash2, Calendar, ClipboardList, RotateCw } from 'lucide-react-native';

export default function RegisterTeamScreen({ navigation }) {
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [teamName, setTeamName] = useState('');
  const [showEventSelectModal, setShowEventSelectModal] = useState(false);

  // Team Name check states
  const [teamNameCheckingStatus, setTeamNameCheckingStatus] = useState('idle');
  const [teamNameCheckingMessage, setTeamNameCheckingMessage] = useState('');
  const teamNameTimer = useRef(null);

  // Past teams (History reuse)
  const [pastTeams, setPastTeams] = useState([]);
  const [selectedPastTeamId, setSelectedPastTeamId] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [showPastTeamSelectModal, setShowPastTeamSelectModal] = useState(false);

  // Leader info
  const [leaderEmail, setLeaderEmail] = useState('');
  const [leaderFullName, setLeaderFullName] = useState('');
  const [leaderStudentId, setLeaderStudentId] = useState('');
  const [leaderGithubUsername, setLeaderGithubUsername] = useState('');
  const [leaderUniversity, setLeaderUniversity] = useState('');

  // Members list
  const [members, setMembers] = useState([]);
  const membersRef = useRef([]);
  useEffect(() => {
    membersRef.current = members;
  }, [members]);

  // Timers for debounced member check
  const checkTimers = useRef({});

  // Captcha states
  const [captchaId, setCaptchaId] = useState('');
  const [captchaSvg, setCaptchaSvg] = useState('');
  const [captchaValue, setCaptchaValue] = useState('');

  const [loading, setLoading] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [success, setSuccess] = useState(false);


  const fetchCaptcha = async () => {
    try {
      const res = await api.get('/auth/captcha');
      setCaptchaId(res.data.captchaId);
      
      let rawSvg = res.data.captchaSvg || '';
      
      // 1. Loại bỏ khoảng trắng và dòng mới thừa bên trong thẻ <text>...</text> để tránh lỗi bị thụt lề/lệch chữ trên mobile
      rawSvg = rawSvg.replace(/<text([^>]*)>[\s\n]*([^<]+?)[\s\n]*<\/text>/gi, '<text$1>$2</text>');
      
      // 2. Chuyển đổi HSL sang RGB để tránh việc react-native-svg không nhận diện được màu HSL và hiển thị thành màu đen ẩn vào nền
      const hslRegex = /hsl\(\s*(\d+)\s*,\s*(\d+)%\s*,\s*(\d+)%\s*\)/gi;
      const hslToRgb = (h, s, l) => {
        s /= 100;
        l /= 100;
        const k = n => (n + h / 30) % 12;
        const a = s * Math.min(l, 1 - l);
        const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
        return [Math.round(255 * f(0)), Math.round(255 * f(8)), Math.round(255 * f(4))];
      };
      
      const cleanedSvg = rawSvg.replace(hslRegex, (match, h, s, l) => {
        const [r, g, b] = hslToRgb(Number(h), Number(s), Number(l));
        return `rgb(${r},${g},${b})`;
      });

      setCaptchaSvg(cleanedSvg);
    } catch (err) {
      console.log('Error fetching captcha:', err);
    }
  };

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
        console.log('Lỗi tải sự kiện:', err);
      }
    };

    // Tải thông tin cá nhân của trưởng nhóm để điền trước
    const fetchProfile = async () => {
      try {
        const res = await api.get('/auth/me');
        const u = res.data.user;
        if (u) {
          setLeaderEmail(u.email || '');
          setLeaderFullName(u.fullName || '');
          setLeaderStudentId(u.studentId || '');
          setLeaderGithubUsername(u.githubUsername || '');
          setLeaderUniversity(u.university || '');
        }
      } catch (err) {
        console.log('Lỗi tải thông tin trưởng nhóm:', err);
      } finally {
        setLoadingProfile(false);
      }
    };

    // Tải lịch sử đội cũ
    const fetchHistory = async () => {
      try {
        const res = await api.get('/teams/history');
        setPastTeams(res.data || []);
      } catch (err) {
        console.log('Lỗi tải lịch sử đội cũ:', err);
      }
    };

    fetchEvents();
    fetchProfile();
    fetchHistory();
    fetchCaptcha();
  }, []);

  const handleApplyPastTeam = () => {
    if (!selectedPastTeamId) return;
    const team = pastTeams.find((t) => t._id === selectedPastTeamId);
    if (!team) return;

    setTeamName(team.name);

    if (team.members && Array.isArray(team.members)) {
      setMembers(
        team.members.map((m) => ({
          email: m.email || '',
          fullName: m.fullName || '',
          githubUsername: m.githubUsername || '',
          studentId: m.studentId || '',
          university: m.university || '',
          checkingStatus: 'idle',
          checkingMessage: '',
        }))
      );
    }

    setInfoMessage('Đã tải thông tin và tên nhóm từ đội thi cũ.');
    setTimeout(() => setInfoMessage(''), 5000);
  };

  const handleCheckTeamName = async (name) => {
    if (!name.trim() || !selectedEventId) return;
    setTeamNameCheckingStatus('checking');
    setTeamNameCheckingMessage('');
    try {
      const res = await api.get(`/teams/check-name?name=${encodeURIComponent(name.trim())}&eventId=${selectedEventId}`);
      if (res.data.exists) {
        setTeamNameCheckingStatus('conflict');
        setTeamNameCheckingMessage(res.data.message || 'Tên nhóm đã được sử dụng.');
      } else {
        setTeamNameCheckingStatus('eligible');
        setTeamNameCheckingMessage(res.data.message || 'Tên nhóm hợp lệ.');
      }
    } catch (err) {
      setTeamNameCheckingStatus('idle');
      setTeamNameCheckingMessage(err.response?.data?.message || 'Lỗi kiểm tra.');
    }
  };

  const handleCheckEligibility = async (index, emailVal) => {
    if (!emailVal.trim() || !selectedEventId) return;

    setMembers((prev) => {
      if (!prev[index]) return prev;
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        checkingStatus: 'checking',
        checkingMessage: '',
      };
      return updated;
    });

    try {
      const res = await api.get(`/teams/check-eligibility?email=${encodeURIComponent(emailVal.trim())}&eventId=${selectedEventId}`);
      setMembers((prev) => {
        if (!prev[index] || prev[index].email.trim() !== emailVal.trim()) {
          return prev;
        }
        const nextUpdated = [...prev];
        if (res.data.eligible) {
          nextUpdated[index].checkingStatus = 'eligible';
          nextUpdated[index].checkingMessage = res.data.message || 'Hợp lệ (Chưa có nhóm)';
          const u = res.data.user;
          if (u) {
            if (u.fullName) nextUpdated[index].fullName = u.fullName;
            if (u.studentId) nextUpdated[index].studentId = u.studentId;
            if (u.githubUsername) nextUpdated[index].githubUsername = u.githubUsername;
            if (u.university) nextUpdated[index].university = u.university;
          }
        } else {
          nextUpdated[index].checkingStatus = 'conflict';
          nextUpdated[index].checkingMessage = res.data.message || 'Đã có nhóm!';
        }
        return nextUpdated;
      });
    } catch (err) {
      setMembers((prev) => {
        if (!prev[index] || prev[index].email.trim() !== emailVal.trim()) {
          return prev;
        }
        const nextUpdated = [...prev];
        nextUpdated[index].checkingStatus = 'idle';
        nextUpdated[index].checkingMessage = err.response?.data?.message || 'Lỗi kiểm tra';
        return nextUpdated;
      });
    }
  };

  const handleEmailChange = (index, val) => {
    setMembers((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        email: val,
        checkingStatus: 'idle',
        checkingMessage: '',
      };
      return updated;
    });

    if (checkTimers.current[index]) {
      clearTimeout(checkTimers.current[index]);
    }

    const trimmed = val.trim();
    if (!trimmed) return;

    checkTimers.current[index] = setTimeout(() => {
      const currentEmail = membersRef.current[index]?.email || '';
      if (currentEmail.trim() === trimmed) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (emailRegex.test(trimmed)) {
          handleCheckEligibility(index, trimmed);
        }
      }
    }, 800);
  };

  const addMemberRow = () => {
    setMembers([
      ...members,
      {
        email: '',
        fullName: '',
        githubUsername: '',
        studentId: '',
        university: '',
        checkingStatus: 'idle',
        checkingMessage: '',
      },
    ]);
  };

  const removeMemberRow = (index) => {
    if (checkTimers.current[index]) {
      clearTimeout(checkTimers.current[index]);
      delete checkTimers.current[index];
    }
    const nextTimers = {};
    Object.keys(checkTimers.current).forEach((keyStr) => {
      const key = parseInt(keyStr);
      if (key > index) {
        nextTimers[key - 1] = checkTimers.current[key];
      } else if (key < index) {
        nextTimers[key] = checkTimers.current[key];
      }
    });
    checkTimers.current = nextTimers;

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
    if (teamNameCheckingStatus === 'conflict') {
      Alert.alert('Lỗi', 'Tên đội thi đã được sử dụng.');
      return;
    }
    if (!leaderFullName.trim() || !leaderGithubUsername.trim()) {
      Alert.alert('Lỗi', 'Họ tên và GitHub Username của bạn (Trưởng nhóm) là bắt buộc.');
      return;
    }

    // Validate members
    for (let i = 0; i < members.length; i++) {
      const m = members[i];
      if (!m.email.trim() || !m.fullName.trim() || !m.githubUsername.trim()) {
        Alert.alert('Lỗi', `Thành viên thứ ${i + 1} phải điền đầy đủ Email, Họ Tên và GitHub Username.`);
        return;
      }
      if (m.checkingStatus === 'conflict') {
        Alert.alert('Lỗi', `Thành viên thứ ${i + 1} (${m.email}) đã thuộc đội khác hoặc không hợp lệ.`);
        return;
      }
    }

    if (!captchaValue.trim()) {
      Alert.alert('Lỗi', 'Vui lòng nhập mã xác thực (CAPTCHA).');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        eventId: selectedEventId,
        trackId: undefined,
        teamName: teamName.trim(),
        membersList: members.map((m) => ({
          email: m.email.trim(),
          fullName: m.fullName.trim(),
          githubUsername: m.githubUsername.trim(),
          studentId: m.studentId.trim(),
          university: m.university.trim(),
        })),
        leaderInfo: {
          email: leaderEmail.trim(),
          fullName: leaderFullName.trim(),
          studentId: leaderStudentId.trim(),
          githubUsername: leaderGithubUsername.trim(),
          university: leaderUniversity.trim(),
        },
        captchaId,
        captchaValue,
      };

      const res = await api.post('/teams/register', payload);
      setSuccess(true);
      Alert.alert('Thành công', res.data.message || 'Đăng ký đội thành công!');
      setTimeout(() => {
        navigation.replace('TeamArea');
      }, 2000);
    } catch (err) {
      console.log('Error registering team:', err);
      fetchCaptcha();
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

  const selectedEvent = events.find((e) => e._id === selectedEventId);

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={styles.container}>
          <ScrollView
            contentContainerStyle={styles.scrollContainer}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled={true}
          >
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
                {/* Lựa chọn cuộc thi */}
                <Text style={styles.label}>LỰA CHỌN CUỘC THI</Text>
                <TouchableOpacity
                  style={styles.dropdownButton}
                  onPress={() => setShowEventSelectModal(true)}
                >
                  <Text style={styles.dropdownButtonText}>
                    {selectedEvent ? `${selectedEvent.name} (${selectedEvent.semester} ${selectedEvent.year})` : 'Chọn cuộc thi...'}
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
                      <ScrollView style={styles.modalList}>
                        {events.map((e) => (
                          <TouchableOpacity
                            key={e._id}
                            style={[
                              styles.modalItem,
                              selectedEventId === e._id && styles.modalItemActive,
                            ]}
                            onPress={() => {
                              setSelectedEventId(e._id);
                              setShowEventSelectModal(false);
                            }}
                          >
                            <Text
                              style={[
                                styles.modalItemText,
                                selectedEventId === e._id && styles.modalItemTextActive,
                              ]}
                            >
                              {e.name} ({e.semester} {e.year})
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

                {/* Tái sử dụng đội thi cũ */}
                {pastTeams.length > 0 && (
                  <View style={styles.historyContainer}>
                    <Text style={styles.historyLabel}>TÁI SỬ DỤNG THÔNG TIN ĐỘI CŨ</Text>
                    <View style={styles.historyRow}>
                      <TouchableOpacity
                        style={[styles.dropdownButton, { flex: 1, marginBottom: 0 }]}
                        onPress={() => setShowPastTeamSelectModal(true)}
                      >
                        <Text style={styles.dropdownButtonText} numberOfLines={1}>
                          {pastTeams.find((t) => t._id === selectedPastTeamId)?.name || 'Chọn đội cũ...'}
                        </Text>
                        <Text style={styles.dropdownArrow}>▼</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.applyBtn}
                        onPress={handleApplyPastTeam}
                        disabled={!selectedPastTeamId}
                      >
                        <Text style={styles.applyBtnText}>ÁP DỤNG</Text>
                      </TouchableOpacity>
                    </View>
                    {infoMessage ? (
                      <Text style={styles.infoMessage}>{infoMessage}</Text>
                    ) : null}
                  </View>
                )}

                {/* Modal Chọn Đội cũ */}
                <Modal
                  visible={showPastTeamSelectModal}
                  transparent={true}
                  animationType="fade"
                  onRequestClose={() => setShowPastTeamSelectModal(false)}
                >
                  <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setShowPastTeamSelectModal(false)}
                  >
                    <View style={styles.modalContent}>
                      <Text style={styles.modalTitle}>CHỌN ĐỘI THI CŨ</Text>
                      <ScrollView style={styles.modalList}>
                        {pastTeams.map((t) => (
                          <TouchableOpacity
                            key={t._id}
                            style={[
                              styles.modalItem,
                              selectedPastTeamId === t._id && styles.modalItemActive,
                            ]}
                            onPress={() => {
                              setSelectedPastTeamId(t._id);
                              setShowPastTeamSelectModal(false);
                            }}
                          >
                            <Text
                              style={[
                                styles.modalItemText,
                                selectedPastTeamId === t._id && styles.modalItemTextActive,
                              ]}
                            >
                              {t.name} (Sự kiện: {t.event?.name || 'Không rõ'})
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                      <TouchableOpacity
                        style={styles.modalCloseBtn}
                        onPress={() => setShowPastTeamSelectModal(false)}
                      >
                        <Text style={styles.modalCloseBtnText}>ĐÓNG</Text>
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                </Modal>

                {/* Bước 1: Thông tin chung */}
                <Text style={styles.sectionHeader}>1. THÔNG TIN CHUNG</Text>
                <View style={styles.sectionBox}>
                  <Text style={styles.subLabel}>Tên nhóm thi đấu *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Nhập tên nhóm của bạn..."
                    placeholderTextColor="#849495"
                    value={teamName}
                    onChangeText={(val) => {
                      setTeamName(val);
                      setTeamNameCheckingStatus('idle');
                      setTeamNameCheckingMessage('');

                      if (teamNameTimer.current) {
                        clearTimeout(teamNameTimer.current);
                      }

                      const trimmed = val.trim();
                      if (!trimmed) return;

                      teamNameTimer.current = setTimeout(() => {
                        handleCheckTeamName(trimmed);
                      }, 800);
                    }}
                  />
                  {teamNameCheckingStatus === 'checking' && (
                    <Text style={styles.checkMessage}>Đang check...</Text>
                  )}
                  {!!teamNameCheckingMessage && (
                    <Text
                      style={[
                        styles.checkMessage,
                        teamNameCheckingStatus === 'eligible' ? styles.msgEligible : styles.msgConflict,
                      ]}
                    >
                      {teamNameCheckingMessage}
                    </Text>
                  )}
                </View>

                {/* Bước 2: Thông tin trưởng nhóm */}
                <Text style={styles.sectionHeader}>2. THÔNG TIN TRƯỞNG NHÓM (BẠN)</Text>
                <View style={styles.sectionBox}>
                  <Text style={styles.subLabel}>Email Trưởng Nhóm *</Text>
                  <TextInput
                    style={[styles.input, { opacity: 0.6 }]}
                    placeholder="Email Trưởng nhóm..."
                    placeholderTextColor="#849495"
                    value={leaderEmail}
                    editable={false}
                  />

                  <Text style={styles.subLabel}>Họ và tên *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Họ tên trưởng nhóm..."
                    placeholderTextColor="#849495"
                    value={leaderFullName}
                    onChangeText={setLeaderFullName}
                  />

                  <Text style={styles.subLabel}>Mã số sinh viên (MSSV)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Ví dụ: SE1XXXXX"
                    placeholderTextColor="#849495"
                    value={leaderStudentId}
                    onChangeText={setLeaderStudentId}
                  />

                  <Text style={styles.subLabel}>GitHub Username *</Text>
                  <GithubUserAutocomplete
                    value={leaderGithubUsername}
                    onChange={setLeaderGithubUsername}
                    placeholder="github-username của bạn"
                  />

                  <Text style={styles.subLabel}>Trường đại học</Text>
                  <UniversityCombobox
                    value={leaderUniversity}
                    onChange={setLeaderUniversity}
                    placeholder="Nhập hoặc chọn trường..."
                  />
                </View>

                {/* Bước 3: Danh sách thành viên */}
                <View style={styles.membersHeader}>
                  <Text style={styles.sectionHeader}>3. THÀNH VIÊN ĐỘI THI ({members.length})</Text>
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

                    <Text style={styles.subLabel}>Email thành viên *</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="email@student.fpt.edu.vn..."
                      placeholderTextColor="#849495"
                      value={member.email}
                      onChangeText={(val) => handleEmailChange(index, val)}
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                    {member.checkingStatus === 'checking' && (
                      <Text style={styles.checkMessage}>Đang check...</Text>
                    )}
                    {!!member.checkingMessage && (
                      <Text
                        style={[
                          styles.checkMessage,
                          member.checkingStatus === 'eligible' ? styles.msgEligible : styles.msgConflict,
                        ]}
                      >
                        {member.checkingMessage}
                      </Text>
                    )}

                    <Text style={styles.subLabel}>Họ và tên *</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Họ và tên thành viên..."
                      placeholderTextColor="#849495"
                      value={member.fullName}
                      onChangeText={(val) => handleMemberChange(index, 'fullName', val)}
                    />

                    <Text style={styles.subLabel}>Mã số sinh viên (MSSV)</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="SE18XXXX..."
                      placeholderTextColor="#849495"
                      value={member.studentId}
                      onChangeText={(val) => handleMemberChange(index, 'studentId', val)}
                    />

                    <Text style={styles.subLabel}>GitHub Username *</Text>
                    <GithubUserAutocomplete
                      value={member.githubUsername}
                      onChange={(val) => handleMemberChange(index, 'githubUsername', val)}
                      placeholder="github-username"
                    />

                    <Text style={styles.subLabel}>Trường đại học</Text>
                    <UniversityCombobox
                      value={member.university}
                      onChange={(val) => handleMemberChange(index, 'university', val)}
                      placeholder="Nhập hoặc chọn trường..."
                    />
                  </View>
                ))}

                {/* CAPTCHA */}
                {captchaSvg ? (
                  <View style={styles.captchaContainer}>
                    <Text style={styles.label}>MÃ XÁC THỰC (CAPTCHA) *</Text>
                    <View style={styles.captchaRow}>
                      <View style={styles.captchaImageWrap}>
                        <SvgXml xml={captchaSvg} width="120" height="40" />
                      </View>
                      <TouchableOpacity style={styles.refreshBtn} onPress={fetchCaptcha}>
                        <RotateCw size={18} color="#00f0ff" />
                      </TouchableOpacity>
                    </View>
                    <TextInput
                      style={[styles.input, { marginTop: 10 }]}
                      placeholder="Nhập mã xác thực CAPTCHA..."
                      placeholderTextColor="#849495"
                      value={captchaValue}
                      onChangeText={setCaptchaValue}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                ) : null}

                <TouchableOpacity
                  style={styles.submitBtn}
                  onPress={handleSubmit}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#000" />
                  ) : (
                    <Text style={styles.submitBtnText}>XÁC NHẬN ĐĂNG KÝ ĐỘI</Text>
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
  historyContainer: {
    backgroundColor: 'rgba(0, 240, 255, 0.04)',
    borderColor: 'rgba(0, 240, 255, 0.2)',
    borderWidth: 1,
    padding: 14,
    borderRadius: 4,
    marginBottom: 16,
  },
  historyLabel: {
    color: '#00f0ff',
    fontSize: 10,
    fontWeight: '800',
    marginBottom: 8,
    letterSpacing: 1,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  applyBtn: {
    backgroundColor: '#00f0ff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 4,
  },
  applyBtnText: {
    color: '#000',
    fontSize: 11,
    fontWeight: '800',
  },
  infoMessage: {
    color: '#00f0ff',
    fontSize: 10,
    fontStyle: 'italic',
    marginTop: 6,
  },
  checkMessage: {
    color: '#dae3f0',
    fontSize: 11,
    fontStyle: 'italic',
    marginBottom: 10,
    marginTop: -8,
  },
  msgEligible: {
    color: '#10b981',
  },
  msgConflict: {
    color: '#ef4444',
  },
  captchaContainer: {
    backgroundColor: 'rgba(19, 29, 37, 0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
    padding: 16,
    borderRadius: 4,
    marginBottom: 20,
  },
  captchaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  captchaImageWrap: {
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderColor: 'rgba(6, 182, 212, 0.2)',
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  refreshBtn: {
    borderColor: '#3b494b',
    borderWidth: 1,
    padding: 10,
    borderRadius: 4,
    backgroundColor: '#131d25',
  },
});
