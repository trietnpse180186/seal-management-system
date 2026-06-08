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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../api/api';
import { ArrowLeft, Save, Sparkles, AlertTriangle } from 'lucide-react-native';

export default function JudgeScoringScreen({ route, navigation }) {
  const { teamId, roundId } = route.params;

  const [team, setTeam] = useState(null);
  const [rubric, setRubric] = useState(null);
  const [criteria, setCriteria] = useState([]);
  
  // State bảng điểm
  const [scores, setScores] = useState({}); // { [criterionId]: { scoreValue, comment } }
  const [overallComment, setOverallComment] = useState('');
  const [isGraded, setIsGraded] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Tải thông tin đội thi
      const teamRes = await api.get(`/teams/${teamId}`);
      setTeam(teamRes.data.team);

      // 2. Tải Rubric và các tiêu chí chấm điểm
      const rubricRes = await api.get(`/rubrics/round/${roundId}`);
      const rub = rubricRes.data.rubric;
      const critList = rubricRes.data.criteria || [];
      setRubric(rub);
      setCriteria(critList);

      // Khởi tạo state điểm trống
      const initialScores = {};
      critList.forEach((c) => {
        initialScores[c._id] = { scoreValue: '', comment: '' };
      });

      // 3. Tải điểm đã chấm trước đó (nếu có)
      try {
        const gradeRes = await api.get(`/grades/team/${teamId}/round/${roundId}`);
        if (gradeRes.data && gradeRes.data.score) {
          setIsGraded(true);
          setOverallComment(gradeRes.data.score.overallComment || '');
          
          gradeRes.data.details.forEach((d) => {
            initialScores[d.criterionId] = {
              scoreValue: String(d.scoreValue),
              comment: d.comment || '',
            };
          });
        } else {
          setIsGraded(false);
        }
      } catch (e) {
        setIsGraded(false);
      }

      setScores(initialScores);
    } catch (err) {
      console.error(err);
      Alert.alert('Thất bại', 'Không thể tải dữ liệu chấm điểm.');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [teamId, roundId]);

  const handleScoreChange = (critId, field, val) => {
    setScores((prev) => ({
      ...prev,
      [critId]: {
        ...prev[critId],
        [field]: val,
      },
    }));
  };

  const handleGetAiSuggestion = async () => {
    if (!rubric) return;
    setAiLoading(true);
    try {
      const res = await api.get(`/grades/suggestion?teamId=${teamId}&roundId=${roundId}&rubricId=${rubric._id}`);
      
      const updatedScores = { ...scores };
      res.data.forEach((item) => {
        if (item.criterionId) {
          updatedScores[item.criterionId] = {
            scoreValue: String(item.suggestedScore),
            comment: `[AI Gợi ý]: ${item.comment}`,
          };
        }
      });
      setScores(updatedScores);
      setOverallComment('Ý kiến tổng quan từ Gemini AI: Dự án hoàn thành tốt cấu trúc RAG, phân chia công việc Git rõ ràng giữa các thành viên.');
      Alert.alert('Thành công', 'Đã tự động điền điểm số gợi ý từ Gemini AI!');
    } catch (err) {
      console.error(err);
      Alert.alert('Lỗi', 'Không thể lấy gợi ý điểm số từ Gemini AI.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleSubmitScores = async () => {
    if (!rubric) return;

    // Chuẩn bị dữ liệu gửi lên API
    const details = criteria.map((c) => {
      const val = scores[c._id] || {};
      return {
        criterionId: c._id,
        scoreValue: parseFloat(val.scoreValue),
        comment: val.comment || '',
      };
    });

    // Kiểm tra điểm số hợp lệ
    if (details.some((d) => isNaN(d.scoreValue))) {
      Alert.alert('Lỗi', 'Vui lòng điền đầy đủ điểm số cho tất cả tiêu chí.');
      return;
    }

    // Kiểm tra giới hạn điểm tối đa
    let outOfBounds = false;
    criteria.forEach((c) => {
      const scoreVal = parseFloat(scores[c._id]?.scoreValue);
      if (scoreVal < 0 || scoreVal > c.maxScore) {
        outOfBounds = true;
      }
    });

    if (outOfBounds) {
      Alert.alert('Lỗi', 'Điểm nhập vào phải lớn hơn 0 và nhỏ hơn điểm tối đa quy định.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        teamId,
        roundId,
        rubricId: rubric._id,
        overallComment,
        details,
      };

      const res = await api.post('/grades/submit', payload);
      Alert.alert(
        'Thành công',
        `Nộp điểm thành công! Tổng điểm quy đổi: ${res.data.totalWeightedScore}/10`
      );
      navigation.goBack();
    } catch (err) {
      console.error(err);
      Alert.alert('Nộp điểm thất bại', err.response?.data?.message || 'Có lỗi xảy ra khi nộp điểm.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
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
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <ArrowLeft size={20} color="#00f0ff" />
            </TouchableOpacity>
            <View style={styles.headerTitleContainer}>
              <Text style={styles.headerTitle} numberOfLines={1}>{team?.name}</Text>
              <Text style={styles.headerSubTitle}>Chấm điểm dự án</Text>
            </View>
            <View style={[styles.badge, isGraded ? styles.badgeGraded : styles.badgePending]}>
              <Text style={[styles.badgeText, isGraded ? styles.badgeTextGraded : styles.badgeTextPending]}>
                {isGraded ? 'Đã chấm' : 'Chưa chấm'}
              </Text>
            </View>
          </View>

          <ScrollView contentContainerStyle={styles.scrollContainer}>
            {/* Chi tiết đề tài */}
            <View style={styles.detailsBox}>
              <Text style={styles.detailsLabel}>ĐỀ TÀI DỰ ÁN</Text>
              <Text style={styles.detailsTitle}>{team?.topicSubmission?.title || 'Chưa đăng ký'}</Text>
              {team?.topicSubmission?.description ? (
                <Text style={styles.detailsDesc}>{team.topicSubmission.description}</Text>
              ) : null}
            </View>

            {/* AI Assist button */}
            {rubric && (
              <TouchableOpacity
                style={styles.aiBtn}
                onPress={handleGetAiSuggestion}
                disabled={aiLoading}
              >
                {aiLoading ? (
                  <ActivityIndicator color="#000" size="small" />
                ) : (
                  <>
                    <Sparkles size={16} color="#000" />
                    <Text style={styles.aiBtnText}>GỢI Ý ĐIỂM BẰNG GEMINI AI</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {/* Rubric Criteria Form */}
            {rubric ? (
              <View style={styles.form}>
                {criteria.map((c) => (
                  <View key={c._id} style={styles.criterionCard}>
                    <View style={styles.critHeader}>
                      <View style={styles.critTitleCol}>
                        <Text style={styles.critCode}>[{c.code}]</Text>
                        <Text style={styles.critName}>{c.name}</Text>
                      </View>
                      <View style={styles.critScoreContainer}>
                        <TextInput
                          style={styles.scoreInput}
                          keyboardType="numeric"
                          placeholder="0"
                          placeholderTextColor="#5c6d70"
                          value={scores[c._id]?.scoreValue}
                          onChangeText={(val) => handleScoreChange(c._id, 'scoreValue', val)}
                        />
                        <Text style={styles.maxScoreLabel}>/ {c.maxScore}</Text>
                      </View>
                    </View>

                    <Text style={styles.critDesc}>{c.description}</Text>

                    {/* Hướng dẫn tiêu chí điểm */}
                    {c.gradingLevels && c.gradingLevels.length > 0 && (
                      <View style={styles.levelsContainer}>
                        {c.gradingLevels.map((lvl, idx) => (
                          <View key={idx} style={styles.levelRow}>
                            <Text style={styles.levelLabel}>{lvl.label} ({lvl.minScore}-{lvl.maxScore}đ):</Text>
                            <Text style={styles.levelDesc}>{lvl.description}</Text>
                          </View>
                        ))}
                      </View>
                    )}

                    {/* Nhận xét tiêu chí */}
                    <TextInput
                      style={styles.commentInput}
                      placeholder="Nhận xét cụ thể cho tiêu chí này..."
                      placeholderTextColor="#849495"
                      value={scores[c._id]?.comment}
                      onChangeText={(val) => handleScoreChange(c._id, 'comment', val)}
                    />
                  </View>
                ))}

                {/* Nhận xét chung */}
                <Text style={styles.label}>NHẬN XÉT TỔNG QUAN</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Điểm mạnh, điểm yếu và lời khuyên dành cho đội thi..."
                  placeholderTextColor="#849495"
                  value={overallComment}
                  onChangeText={setOverallComment}
                  multiline
                  numberOfLines={4}
                />

                <TouchableOpacity
                  style={styles.submitBtn}
                  onPress={handleSubmitScores}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color="#000" size="small" />
                  ) : (
                    <>
                      <Save size={16} color="#000" />
                      <Text style={styles.submitBtnText}>NỘP BẢNG ĐIỂM CHÍNH THỨC</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <AlertTriangle size={32} color="#ef4444" style={styles.lockIcon} />
                <Text style={styles.emptyText}>Bảng điểm của vòng đấu này chưa được mở hoặc đã khóa.</Text>
              </View>
            )}
          </ScrollView>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  backBtn: {
    padding: 6,
    marginRight: 8,
  },
  headerTitleContainer: {
    flex: 1,
    marginRight: 10,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  headerSubTitle: {
    color: '#849495',
    fontSize: 11,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  badgeGraded: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  badgePending: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  badgeTextGraded: {
    color: '#10b981',
  },
  badgeTextPending: {
    color: '#f59e0b',
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
  detailsBox: {
    backgroundColor: '#131d25',
    borderColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    padding: 16,
    borderRadius: 4,
    marginBottom: 20,
  },
  detailsLabel: {
    color: '#00f0ff',
    fontSize: 9,
    fontWeight: '850',
    letterSpacing: 1,
    marginBottom: 6,
  },
  detailsTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 8,
  },
  detailsDesc: {
    color: '#b9cacb',
    fontSize: 12,
    lineHeight: 18,
  },
  aiBtn: {
    flexDirection: 'row',
    backgroundColor: '#00f0ff',
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
    marginBottom: 24,
  },
  aiBtnText: {
    color: '#000',
    fontWeight: '800',
    fontSize: 12,
    marginLeft: 8,
    letterSpacing: 1,
  },
  form: {
    marginBottom: 30,
  },
  criterionCard: {
    backgroundColor: '#131d25',
    borderColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    padding: 16,
    borderRadius: 4,
    marginBottom: 16,
  },
  critHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  critTitleCol: {
    flex: 1,
    marginRight: 10,
  },
  critCode: {
    color: '#00f0ff',
    fontSize: 11,
    fontWeight: '800',
  },
  critName: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  critScoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(6, 15, 23, 0.8)',
    borderWidth: 1,
    borderColor: '#3b494b',
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  scoreInput: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
    width: 36,
    textAlign: 'center',
    paddingVertical: 6,
  },
  maxScoreLabel: {
    color: '#5c6d70',
    fontSize: 11,
    fontWeight: '700',
  },
  critDesc: {
    color: '#849495',
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 12,
  },
  levelsContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
    padding: 10,
    borderRadius: 4,
    marginBottom: 12,
  },
  levelRow: {
    marginBottom: 6,
  },
  levelLabel: {
    color: '#b9cacb',
    fontSize: 10,
    fontWeight: '700',
  },
  levelDesc: {
    color: '#5c6d70',
    fontSize: 9.5,
    marginTop: 1,
    lineHeight: 14,
  },
  commentInput: {
    backgroundColor: 'rgba(6, 15, 23, 0.6)',
    borderColor: '#3b494b',
    borderWidth: 1,
    color: '#dae3f0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 12,
    borderRadius: 4,
  },
  label: {
    color: '#849495',
    fontSize: 10,
    fontWeight: '800',
    marginBottom: 6,
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
  textArea: {
    height: 100,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  submitBtn: {
    flexDirection: 'row',
    backgroundColor: '#00f0ff',
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
    marginTop: 10,
  },
  submitBtnText: {
    color: '#000',
    fontWeight: '800',
    fontSize: 14,
    marginLeft: 8,
    letterSpacing: 1.5,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  lockIcon: {
    marginBottom: 12,
  },
  emptyText: {
    color: '#849495',
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
});
