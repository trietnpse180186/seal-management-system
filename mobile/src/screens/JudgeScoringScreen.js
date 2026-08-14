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
import Svg, { Path, Line as SvgLine, Text as SvgText, G, Circle } from 'react-native-svg';
import api from '../api/api';
import {
  ArrowLeft,
  Save,
  Sparkles,
  AlertTriangle,
  Activity,
  ChevronLeft,
  ChevronRight,
  X,
  CheckCircle,
  XCircle,
  MinusCircle,
  BookOpen,
  Code2,
  Clock,
  UserCheck,
  ChevronDown,
  ChevronUp,
} from 'lucide-react-native';

// Component Biểu đồ Đường Real-time (SVG Line Chart) chuẩn 100% như trên Web
function DeviceLineChart({ series, metricsKeys, colors }) {
  const chartWidth = 320;
  const chartHeight = 160;
  const paddingLeft = 36;
  const paddingBottom = 24;
  const paddingTop = 16;
  const paddingRight = 16;

  const graphW = chartWidth - paddingLeft - paddingRight;
  const graphH = chartHeight - paddingTop - paddingBottom;

  if (!series || series.length < 2) {
    return (
      <View style={styles.emptyChartBox}>
        <ActivityIndicator size="small" color="#ea580c" />
        <Text style={styles.emptyChartText}>[ĐANG THU THẬP SỐ LIỆU LINE CHART...]</Text>
      </View>
    );
  }

  // Tìm min/max toàn cục của các thông số số liệu
  let globalMin = Infinity;
  let globalMax = -Infinity;

  metricsKeys.forEach((key) => {
    series.forEach((pt) => {
      const val = pt[key];
      if (typeof val === 'number' && !isNaN(val)) {
        if (val < globalMin) globalMin = val;
        if (val > globalMax) globalMax = val;
      }
    });
  });

  if (globalMin === Infinity) globalMin = 0;
  if (globalMax === -Infinity) globalMax = 10;
  if (globalMin === globalMax) {
    globalMin = globalMin - 1;
    globalMax = globalMax + 1;
  }

  const range = globalMax - globalMin;
  const n = series.length;

  return (
    <View style={styles.svgChartContainer}>
      <Svg width="100%" height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
        {/* Grid Lưới Tọa độ */}
        <SvgLine x1={paddingLeft} y1={paddingTop} x2={chartWidth - paddingRight} y2={paddingTop} stroke="#e2e8f0" strokeDasharray="3 3" />
        <SvgLine x1={paddingLeft} y1={paddingTop + graphH / 2} x2={chartWidth - paddingRight} y2={paddingTop + graphH / 2} stroke="#e2e8f0" strokeDasharray="3 3" />
        <SvgLine x1={paddingLeft} y1={paddingTop + graphH} x2={chartWidth - paddingRight} y2={paddingTop + graphH} stroke="#cbd5e1" />

        {/* Trục Y (Giá trị Min / Mid / Max) */}
        <SvgText x={paddingLeft - 6} y={paddingTop + 4} fontSize="9" fill="#64748b" textAnchor="end">
          {Math.round(globalMax)}
        </SvgText>
        <SvgText x={paddingLeft - 6} y={paddingTop + graphH / 2 + 3} fontSize="9" fill="#64748b" textAnchor="end">
          {Math.round((globalMax + globalMin) / 2)}
        </SvgText>
        <SvgText x={paddingLeft - 6} y={paddingTop + graphH + 3} fontSize="9" fill="#64748b" textAnchor="end">
          {Math.round(globalMin)}
        </SvgText>

        {/* Trục X (Thời gian bắt đầu & mới nhất) */}
        <SvgText x={paddingLeft} y={chartHeight - 6} fontSize="9" fill="#64748b" textAnchor="start">
          {series[0]?.t}
        </SvgText>
        <SvgText x={chartWidth - paddingRight} y={chartHeight - 6} fontSize="9" fill="#64748b" textAnchor="end">
          {series[n - 1]?.t}
        </SvgText>

        {/* Đường Biểu Đồ Line cho từng Metric */}
        {metricsKeys.map((key, mIdx) => {
          const strokeColor = colors[mIdx % colors.length];

          const points = series.map((pt, i) => {
            const x = paddingLeft + (i / (n - 1)) * graphW;
            const val = typeof pt[key] === 'number' ? pt[key] : globalMin;
            const y = paddingTop + graphH - ((val - globalMin) / range) * graphH;
            return `${x},${y}`;
          });

          const pathD = `M ${points.join(' L ')}`;

          const lastPt = series[n - 1];
          const lastVal = typeof lastPt[key] === 'number' ? lastPt[key] : globalMin;
          const lastX = paddingLeft + graphW;
          const lastY = paddingTop + graphH - ((lastVal - globalMin) / range) * graphH;

          return (
            <G key={key}>
              <Path d={pathD} fill="none" stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <Circle cx={lastX} cy={lastY} r="4" fill={strokeColor} />
            </G>
          );
        })}
      </Svg>

      {/* Chú thích thông số (Legend) bên dưới Biểu đồ */}
      <View style={styles.legendRow}>
        {metricsKeys.map((key, mIdx) => {
          const color = colors[mIdx % colors.length];
          const latestVal = series[series.length - 1]?.[key];

          return (
            <View key={key} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: color }]} />
              <Text style={styles.legendText}>
                {key}: <Text style={{ fontWeight: '800', color: '#0f172a' }}>{String(latestVal)}</Text>
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export default function JudgeScoringScreen({ route, navigation }) {
  const { teamId, roundId } = route.params || {};

  const [team, setTeam] = useState(null);
  const [rubric, setRubric] = useState(null);
  const [criteria, setCriteria] = useState([]);

  // Main Tabs: 'scoring' | 'ai_analysis'
  const [activeMainTab, setActiveMainTab] = useState('scoring');

  // Active Rubric Criterion Index (0-indexed)
  const [activeCriterionIndex, setActiveCriterionIndex] = useState(0);

  // State bảng điểm
  const [scores, setScores] = useState({}); // { [criterionId]: { scoreValue, comment } }
  const [overallComment, setOverallComment] = useState('');
  const [isGraded, setIsGraded] = useState(false);

  // Simulator & Live Data State (MQTT)
  const [isJudgeActive, setIsJudgeActive] = useState(false);
  const [togglingActive, setTogglingActive] = useState(false);
  const [liveDialogOpen, setLiveDialogOpen] = useState(false);
  const [scenariosMap, setScenariosMap] = useState({});
  const [currentScenario, setCurrentScenario] = useState('');
  const [liveData, setLiveData] = useState(null);
  const [historyData, setHistoryData] = useState({}); // { [deviceCode]: Array<{ t: string, [metric]: number }> }
  const [liveError, setLiveError] = useState(null);

  // State AI Analysis (Khớp 100% bản Web)
  const [allAiAnalyses, setAllAiAnalyses] = useState([]);
  const [commits, setCommits] = useState([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [expandedCommitIndex, setExpandedCommitIndex] = useState(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const pollIntervalRef = useRef(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Tải thông tin đội thi & thành viên
      const teamRes = await api.get(`/teams/${teamId}`);
      const teamObj = teamRes.data?.team || teamRes.data;
      const membersList = teamRes.data?.members || teamObj?.members || [];
      setTeam({ ...teamObj, members: membersList });

      setIsJudgeActive(!!teamObj?.isJudgeActive);
      if (teamObj?.currentScenario) {
        setCurrentScenario(teamObj.currentScenario);
      }

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

          (gradeRes.data.details || []).forEach((d) => {
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

      // 4. Tải danh sách kịch bản MQTT Simulator từ Backend
      try {
        const scenRes = await api.get('/teams/judge/scenarios');
        setScenariosMap(scenRes.data || {});
      } catch (e) {
        // ignore
      }

      // 5. Tải dữ liệu phân tích AI (gọi đúng API như bản Web)
      try {
        setAiLoading(true);
        const aiRes = await api.get(`/ai-analyses/team/${teamId}`);
        setAllAiAnalyses(aiRes.data || []);
      } catch (e) {
        setAllAiAnalyses([]);
      } finally {
        setAiLoading(false);
      }

      // 6. Tải lịch sử commits của đội thi
      try {
        const commitRes = await api.get(`/analytics/team/${teamId}/commits`);
        setCommits(commitRes.data || []);
      } catch (e) {
        setCommits([]);
      }
    } catch (err) {
      console.warn(err);
      Alert.alert('Thất bại', 'Không thể tải dữ liệu chấm điểm.');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [teamId, roundId]);

  // Handle Polling Live Data MQTT & History Line Chart Accumulation
  useEffect(() => {
    if (!liveDialogOpen) {
      setLiveData(null);
      setHistoryData({});
      setLiveError(null);
      return;
    }

    let lastEpoch = 0;
    const maxPoints = 30;

    const fetchLive = async () => {
      try {
        const targetId = teamId || team?._id;
        const res = await api.get(`/teams/judge/live?teamId=${targetId}`);
        const data = res.data;

        if (!data || !data.devices) {
          setLiveError('Chưa nhận được dữ liệu thiết bị từ Simulator.');
          return;
        }

        setLiveError(null);
        setLiveData(data);

        if (data.epoch && data.epoch === lastEpoch) return;
        if (data.epoch) lastEpoch = data.epoch;

        const label = new Date((data.epoch || Date.now() / 1000) * 1000).toLocaleTimeString('vi-VN', {
          hour12: false,
          minute: '2-digit',
          second: '2-digit',
        });

        setHistoryData((prev) => {
          const next = { ...prev };
          for (const d of data.devices) {
            const frame = { t: label };
            if (d.metrics) {
              for (const [k, v] of Object.entries(d.metrics)) {
                frame[k] = typeof v === 'boolean' ? (v ? 1 : 0) : typeof v === 'number' ? v : parseFloat(v) || 0;
              }
            }
            next[d.deviceCode] = [...(next[d.deviceCode] || []), frame].slice(-maxPoints);
          }
          return next;
        });
      } catch (e) {
        console.warn('Lỗi live telemetry:', e.message || e);
        const errMsg = e.response?.data?.message || 'Đội thi chưa được đồng bộ chìa khóa kết nối MQTT với Simulator.';
        setLiveError(errMsg);
      }
    };

    fetchLive();
    pollIntervalRef.current = setInterval(fetchLive, 1500);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [liveDialogOpen, teamId, team]);

  const handleToggleJudgeActive = async () => {
    const targetId = teamId || team?._id;
    if (!targetId) return;
    setTogglingActive(true);
    const newActive = !isJudgeActive;
    try {
      await api.patch(`/teams/${targetId}/judge`, { active: newActive });
      setIsJudgeActive(newActive);
      Alert.alert(
        'Thành công',
        newActive
          ? 'Đã kích hoạt môi trường chấm thi Simulator!'
          : 'Đã tắt môi trường chấm thi Simulator.'
      );
    } catch (err) {
      console.warn(err);
      Alert.alert('Lỗi', err.response?.data?.message || 'Không thể thay đổi trạng thái Simulator.');
    } finally {
      setTogglingActive(false);
    }
  };

  const handleChangeScenario = async (scenCode) => {
    const targetId = teamId || team?._id;
    if (!targetId) return;
    setCurrentScenario(scenCode);
    try {
      await api.patch(`/teams/${targetId}/judge-scenario`, { scenario: scenCode });
      Alert.alert('Thành công', `Đã cập nhật kịch bản giả lập MQTT: ${scenCode}`);
    } catch (err) {
      console.warn(err);
      Alert.alert('Lỗi', err.response?.data?.message || 'Không thể đổi kịch bản giả lập.');
    }
  };

  const handleScoreChange = (critId, field, val) => {
    setScores((prev) => ({
      ...prev,
      [critId]: {
        ...prev[critId],
        [field]: val,
      },
    }));
  };

  const handleQuickScoreSelect = (critId, scoreNum) => {
    handleScoreChange(critId, 'scoreValue', String(scoreNum));
  };

  const handleSubmitScores = async () => {
    if (!rubric) return;

    const details = criteria.map((c) => {
      const val = scores[c._id] || {};
      return {
        criterionId: c._id,
        scoreValue: parseFloat(val.scoreValue),
        comment: val.comment || '',
      };
    });

    if (details.some((d) => isNaN(d.scoreValue))) {
      Alert.alert('Lỗi', 'Vui lòng điền đầy đủ điểm số cho tất cả tiêu chí.');
      return;
    }

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
      Alert.alert('Nộp điểm thất bại', err.response?.data?.message || 'Có lỗi xảy ra khi nộp điểm.');
    } finally {
      setSaving(false);
    }
  };

  // Tính điểm tạm tính số liệu thực tế theo thời gian thực
  let currentRawScore = 0;
  let totalMaxRawScore = 0;
  let currentWeightedScore = 0;
  let scoredCriteriaCount = 0;

  const maxScale = rubric?.maxCriterionScore || (criteria.length > 0 ? criteria[0].maxScore : 5);
  const totalRubricWeight = rubric?.totalWeight || criteria.reduce((sum, c) => sum + (c.weight || 0), 0) || 100;

  criteria.forEach((c) => {
    const cMax = c.maxScore || maxScale || 5;
    totalMaxRawScore += cMax;

    const scoreValStr = scores[c._id]?.scoreValue;
    if (scoreValStr !== undefined && scoreValStr !== '' && !isNaN(parseFloat(scoreValStr))) {
      const scoreVal = parseFloat(scoreValStr);
      currentRawScore += scoreVal;
      scoredCriteriaCount += 1;

      const weight = c.weight || 1;
      const wScore = (scoreVal / cMax) * (weight / totalRubricWeight) * maxScale;
      currentWeightedScore += wScore;
    }
  });

  const formattedWeightedScore = (Math.round(currentWeightedScore * 100) / 100).toFixed(2);

  // Xác định danh sách kịch bản phù hợp theo môi trường thiết bị của đội thi
  const envCode = team?.environmentCode || '';
  let availScenarios = [];
  if (Array.isArray(scenariosMap)) {
    availScenarios = scenariosMap;
  } else if (scenariosMap && typeof scenariosMap === 'object') {
    availScenarios = scenariosMap[envCode] || Object.values(scenariosMap).flat() || [];
  }

  // Phân tích dữ liệu AI (khớp 100% bản Web)
  const latestCommitReview = allAiAnalyses.find(
    (r) => r.analysisType === 'commit_review' && r.status === 'completed'
  );
  const teamAggregateReview = allAiAnalyses.find(
    (r) =>
      r.analysisType === 'repository_review' &&
      r.status === 'completed' &&
      String(r.roundId || '') === String(roundId || '')
  );
  const commitReviews = allAiAnalyses.filter(
    (r) => r.analysisType === 'commit_review' && r.status === 'completed'
  );
  const hardConstraints =
    teamAggregateReview?.result?.hard_constraints_validation ||
    latestCommitReview?.result?.hard_constraints_validation;

  const techStack = latestCommitReview?.result?.tech_stack;
  const ragMaturity = latestCommitReview?.result?.rag_maturity;
  const agentIntel = latestCommitReview?.result?.agent_intelligence;
  const aiQuestions = latestCommitReview?.result?.suggested_questions_for_team || [];

  const hasAiData = latestCommitReview || teamAggregateReview || allAiAnalyses.length > 0;

  const getGradeStyle = (gradeStr) => {
    switch (gradeStr) {
      case 'Xuất sắc':
        return { bg: '#dcfce7', text: '#15803d', border: '#86efac' };
      case 'Tốt':
        return { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' };
      case 'Khá':
        return { bg: '#fff7ed', text: '#c2410c', border: '#fed7aa' };
      case 'Trung bình':
        return { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1' };
      default:
        return { bg: '#ffe4e6', text: '#be123c', border: '#fecdd3' };
    }
  };

  const renderConstraintItem = (title, checkObj) => {
    if (!checkObj) return null;
    const status = checkObj.status || 'UNKNOWN';

    let badgeBg = '#f1f5f9';
    let badgeText = '#475569';
    let icon = <MinusCircle size={15} color="#64748b" />;

    if (status === 'PASSED') {
      badgeBg = '#dcfce7';
      badgeText = '#15803d';
      icon = <CheckCircle size={15} color="#16a34a" />;
    } else if (status === 'FAILED') {
      badgeBg = '#fee2e2';
      badgeText = '#dc2626';
      icon = <XCircle size={15} color="#dc2626" />;
    } else if (status === 'NOT_APPLICABLE') {
      badgeBg = '#f1f5f9';
      badgeText = '#64748b';
      icon = <MinusCircle size={15} color="#94a3b8" />;
    }

    return (
      <View key={title} style={styles.constraintItemCard}>
        <View style={styles.constraintItemHeader}>
          {icon}
          <Text style={styles.constraintTitle}>{title}</Text>
          <View style={[styles.constraintStatusTag, { backgroundColor: badgeBg }]}>
            <Text style={[styles.constraintStatusTagText, { color: badgeText }]}>{status}</Text>
          </View>
        </View>
        <Text style={styles.constraintDesc}>
          {checkObj.details || 'Không có dữ liệu chi tiết.'}
        </Text>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#ea580c" />
          <Text style={styles.loadingText}>Đang tải bảng điểm và tiêu chí...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const currentCrit = criteria[activeCriterionIndex];
  const isFinalStep = activeCriterionIndex === criteria.length;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={styles.container}>
          {/* Header Bar */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <ArrowLeft size={20} color="#0f172a" />
            </TouchableOpacity>
            <View style={styles.headerTitleContainer}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {team?.name}
              </Text>
              <Text style={styles.headerSubTitle}>Chấm điểm dự án</Text>
            </View>
            <View style={[styles.badge, isGraded ? styles.badgeGraded : styles.badgePending]}>
              <Text style={[styles.badgeText, isGraded ? styles.badgeTextGraded : styles.badgeTextPending]}>
                {isGraded ? 'Đã chấm' : 'Chờ chấm'}
              </Text>
            </View>
          </View>

          {/* Sub-Header: Simulator & MQTT Live Control */}
          <View style={styles.simulatorBar}>
            <View style={styles.simulatorLeft}>
              <Activity size={18} color="#ea580c" />
              <View>
                <Text style={styles.simulatorTitle}>Môi trường Simulator (MQTT)</Text>
                <Text style={styles.simulatorSub}>
                  {isJudgeActive ? 'Đang BẬT luồng chấm thi' : 'Đang TẮT luồng chấm thi'}
                </Text>
              </View>
            </View>

            <View style={styles.simulatorRight}>
              <TouchableOpacity
                style={[
                  styles.toggleBtn,
                  isJudgeActive ? styles.toggleBtnOn : styles.toggleBtnOff,
                ]}
                onPress={handleToggleJudgeActive}
                disabled={togglingActive}
              >
                <Text style={styles.toggleBtnText}>{isJudgeActive ? 'ON' : 'OFF'}</Text>
              </TouchableOpacity>

              {isJudgeActive && (
                <TouchableOpacity
                  style={styles.liveBtn}
                  onPress={() => setLiveDialogOpen(true)}
                  activeOpacity={0.8}
                >
                  <Activity size={12} color="#ffffff" />
                  <Text style={styles.liveBtnText}>Dữ liệu LIVE</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Thẻ Thống Kê Điểm Tạm Tính Thời Gian Thực */}
          <View style={styles.liveScoreCard}>
            <View style={styles.scoreMainCol}>
              <Text style={styles.scoreCardTitle}>ĐIỂM QUY ĐỔI TẠM TÍNH</Text>
              <View style={styles.scoreBigRow}>
                <Text style={styles.scoreBigText}>{formattedWeightedScore}</Text>
                <Text style={styles.scoreMaxText}>/ {maxScale}đ</Text>
              </View>
            </View>

            <View style={styles.scoreCardDivider} />

            <View style={styles.scoreMetaCol}>
              <View style={styles.scoreMetaRow}>
                <Text style={styles.scoreMetaLabel}>Điểm thô:</Text>
                <Text style={styles.scoreMetaVal}>{currentRawScore} / {totalMaxRawScore} đ</Text>
              </View>
              <View style={[styles.scoreMetaRow, { marginTop: 4 }]}>
                <Text style={styles.scoreMetaLabel}>Đã chấm:</Text>
                <Text style={styles.scoreMetaVal}>{scoredCriteriaCount} / {criteria.length} tiêu chí</Text>
              </View>
            </View>
          </View>

          {/* Main Tabs Navigation */}
          <View style={styles.mainTabBar}>
            <TouchableOpacity
              style={[
                styles.mainTabItem,
                activeMainTab === 'scoring' && styles.mainTabItemActive,
              ]}
              onPress={() => setActiveMainTab('scoring')}
            >
              <Save size={16} color={activeMainTab === 'scoring' ? '#ea580c' : '#64748b'} />
              <Text
                style={[
                  styles.mainTabLabel,
                  activeMainTab === 'scoring' && styles.mainTabLabelActive,
                ]}
              >
                Bảng Chấm Điểm
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.mainTabItem,
                activeMainTab === 'ai_analysis' && styles.mainTabItemActive,
              ]}
              onPress={() => setActiveMainTab('ai_analysis')}
            >
              <Sparkles size={16} color={activeMainTab === 'ai_analysis' ? '#ea580c' : '#64748b'} />
              <Text
                style={[
                  styles.mainTabLabel,
                  activeMainTab === 'ai_analysis' && styles.mainTabLabelActive,
                ]}
              >
                Phân tích từ AI
              </Text>
            </TouchableOpacity>
          </View>

          {/* TAB 1: BẢNG CHẤM ĐIỂM (RUBRIC STEPPER) */}
          {activeMainTab === 'scoring' ? (
            rubric && criteria.length > 0 ? (
              <View style={{ flex: 1 }}>
                {/* Large Horizontal Rubric Step Selector */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.stepBarScroll}
                  contentContainerStyle={styles.stepBarContent}
                >
                  {criteria.map((c, idx) => {
                    const hasScore = !!scores[c._id]?.scoreValue;
                    const isActive = activeCriterionIndex === idx;

                    return (
                      <TouchableOpacity
                        key={c._id}
                        style={[
                          styles.stepChipLarge,
                          isActive && styles.stepChipActive,
                          hasScore && !isActive && styles.stepChipDone,
                        ]}
                        onPress={() => setActiveCriterionIndex(idx)}
                      >
                        <Text
                          style={[
                            styles.stepChipTextLarge,
                            isActive && styles.stepChipTextActive,
                            hasScore && !isActive && styles.stepChipTextDone,
                          ]}
                        >
                          {idx + 1}. {c.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}

                  <TouchableOpacity
                    style={[
                      styles.stepChipLarge,
                      isFinalStep && styles.stepChipActive,
                    ]}
                    onPress={() => setActiveCriterionIndex(criteria.length)}
                  >
                    <Text
                      style={[
                        styles.stepChipTextLarge,
                        isFinalStep && styles.stepChipTextActive,
                      ]}
                    >
                      ★ Tổng quan & Nộp
                    </Text>
                  </TouchableOpacity>
                </ScrollView>

                {/* Criterion Stepper View */}
                <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.stepperContainer}>
                  {!isFinalStep && currentCrit ? (
                    <View style={styles.critCard}>
                      <View style={styles.critHeaderRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.critCodeTag}>[{currentCrit.code}]</Text>
                          <Text style={styles.critNameTitle}>{currentCrit.name}</Text>
                        </View>
                        <View style={styles.maxScoreBadge}>
                          <Text style={styles.maxScoreBadgeText}>
                            Tối đa: {currentCrit.maxScore} đ
                          </Text>
                        </View>
                      </View>

                      <Text style={styles.critDescText}>{currentCrit.description}</Text>

                      {/* Quick 1-tap score selector buttons */}
                      <Text style={styles.fieldLabel}>CHỌN NHANH ĐIỂM SỐ:</Text>
                      <View style={styles.quickScoreRow}>
                        {[0, 1, 2, 3, 4, 5].map((num) => {
                          if (num > currentCrit.maxScore) return null;
                          const isSelected =
                            scores[currentCrit._id]?.scoreValue === String(num);

                          return (
                            <TouchableOpacity
                              key={num}
                              style={[
                                styles.quickScoreBtn,
                                isSelected && styles.quickScoreBtnSelected,
                              ]}
                              onPress={() => handleQuickScoreSelect(currentCrit._id, num)}
                            >
                              <Text
                                style={[
                                  styles.quickScoreBtnText,
                                  isSelected && styles.quickScoreBtnTextSelected,
                                ]}
                              >
                                {num}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>

                      {/* Full Width Custom Score Input */}
                      <Text style={styles.fieldLabel}>ĐIỂM NHẬP TÙY CHỈNH:</Text>
                      <TextInput
                        style={styles.customScoreInputFull}
                        keyboardType="numeric"
                        placeholder="Nhập số điểm..."
                        placeholderTextColor="#94a3b8"
                        value={scores[currentCrit._id]?.scoreValue}
                        onChangeText={(val) =>
                          handleScoreChange(currentCrit._id, 'scoreValue', val)
                        }
                      />

                      {/* Hướng dẫn chi tiết thang điểm (Text to hơn dễ đọc) */}
                      {currentCrit.gradingLevels && currentCrit.gradingLevels.length > 0 && (
                        <View style={styles.levelsBox}>
                          <Text style={styles.levelsBoxTitle}>HƯỚNG DẪN THANG ĐIỂM:</Text>
                          {currentCrit.gradingLevels.map((lvl, idx) => (
                            <View key={idx} style={styles.levelRow}>
                              <Text style={styles.levelLabel}>
                                • {lvl.label} ({lvl.minScore}-{lvl.maxScore}đ):
                              </Text>
                              <Text style={styles.levelDesc}>{lvl.description}</Text>
                            </View>
                          ))}
                        </View>
                      )}

                      {/* Nhận xét tiêu chí */}
                      <Text style={styles.fieldLabel}>NHẬN XÉT TIÊU CHÍ NÀY:</Text>
                      <TextInput
                        style={styles.commentInput}
                        placeholder="Nhận xét cụ thể cho tiêu chí này..."
                        placeholderTextColor="#94a3b8"
                        value={scores[currentCrit._id]?.comment}
                        onChangeText={(val) =>
                          handleScoreChange(currentCrit._id, 'comment', val)
                        }
                        multiline
                      />
                    </View>
                  ) : (
                    /* STEP CUỐI: NHẬN XÉT TỔNG QUAN & NỘP BẢNG ĐIỂM */
                    <View style={styles.finalStepCard}>
                      <Text style={styles.finalStepTitle}>NHẬN XÉT TỔNG QUAN DỰ ÁN</Text>
                      <Text style={styles.finalStepSub}>
                        Nhập đánh giá điểm mạnh, điểm yếu và lời khuyên cho đội thi.
                      </Text>

                      <TextInput
                        style={styles.overallTextArea}
                        placeholder="Lời khuyên và đánh giá tổng thể..."
                        placeholderTextColor="#94a3b8"
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
                          <ActivityIndicator color="#ffffff" size="small" />
                        ) : (
                          <>
                            <Save size={18} color="#ffffff" />
                            <Text style={styles.submitBtnText}>NỘP BẢNG ĐIỂM CHÍNH THỨC</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  )}
                </ScrollView>

                {/* Bottom Navigation Controls for Stepper */}
                <View style={styles.stepperFooter}>
                  <TouchableOpacity
                    style={[
                      styles.stepperNavBtn,
                      activeCriterionIndex === 0 && styles.stepperNavBtnDisabled,
                    ]}
                    disabled={activeCriterionIndex === 0}
                    onPress={() => setActiveCriterionIndex((prev) => Math.max(0, prev - 1))}
                  >
                    <ChevronLeft size={18} color={activeCriterionIndex === 0 ? '#cbd5e1' : '#1e293b'} />
                    <Text
                      style={[
                        styles.stepperNavBtnText,
                        activeCriterionIndex === 0 && styles.stepperNavBtnTextDisabled,
                      ]}
                    >
                      Tiêu chí trước
                    </Text>
                  </TouchableOpacity>

                  <Text style={styles.stepIndicatorText}>
                    {activeCriterionIndex + 1} / {criteria.length + 1}
                  </Text>

                  <TouchableOpacity
                    style={[
                      styles.stepperNavBtn,
                      isFinalStep && styles.stepperNavBtnDisabled,
                    ]}
                    disabled={isFinalStep}
                    onPress={() =>
                      setActiveCriterionIndex((prev) => Math.min(criteria.length, prev + 1))
                    }
                  >
                    <Text
                      style={[
                        styles.stepperNavBtnText,
                        isFinalStep && styles.stepperNavBtnTextDisabled,
                      ]}
                    >
                      Tiếp theo
                    </Text>
                    <ChevronRight size={18} color={isFinalStep ? '#cbd5e1' : '#1e293b'} />
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.centerBox}>
                <AlertTriangle size={32} color="#ea580c" />
                <Text style={styles.emptyText}>Bảng điểm của vòng đấu này chưa được mở.</Text>
              </View>
            )
          ) : (
            /* TAB 2: ĐÁNH GIÁ TỪ AI (HIỂN THỊ ĐẦY ĐỦ TẤT CẢ CÁC TRƯỜNG NHƯ WEB) */
            <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.aiTabContainer}>
              {aiLoading ? (
                <View style={styles.centerBox}>
                  <ActivityIndicator size="large" color="#ea580c" />
                  <Text style={styles.loadingText}>Đang tải báo cáo phân tích AI...</Text>
                </View>
              ) : hasAiData ? (
                <View style={{ gap: 12, paddingBottom: 24 }}>
                  {/* 1. TECH STACK CARD */}
                  <View style={styles.aiSectionCard}>
                    <View style={styles.aiCardHeaderRow}>
                      <Text style={styles.aiCardTitle}>TECH STACK</Text>
                      <View style={styles.aiGeminiBadge}>
                        <Text style={styles.aiGeminiBadgeText}>Gemini AI</Text>
                      </View>
                    </View>

                    {techStack ? (
                      <View style={styles.aiCardBody}>
                        {techStack.frameworks?.length > 0 && (
                          <Text style={styles.aiInfoLine}>
                            <Text style={styles.aiInfoLabel}>Frameworks: </Text>
                            {techStack.frameworks.join(', ')}
                          </Text>
                        )}
                        {techStack.llm_models?.length > 0 && (
                          <Text style={styles.aiInfoLine}>
                            <Text style={styles.aiInfoLabel}>LLM Models: </Text>
                            {techStack.llm_models.join(', ')}
                          </Text>
                        )}
                        {techStack.vector_db?.length > 0 && (
                          <Text style={styles.aiInfoLine}>
                            <Text style={styles.aiInfoLabel}>Vector DB: </Text>
                            {techStack.vector_db.join(', ')}
                          </Text>
                        )}
                        {techStack.agent_frameworks?.length > 0 && (
                          <Text style={styles.aiInfoLine}>
                            <Text style={styles.aiInfoLabel}>Agent Frameworks: </Text>
                            {techStack.agent_frameworks.join(', ')}
                          </Text>
                        )}
                        {techStack.third_party_tools?.length > 0 && (
                          <Text style={styles.aiInfoLine}>
                            <Text style={styles.aiInfoLabel}>Tools khác: </Text>
                            {techStack.third_party_tools.join(', ')}
                          </Text>
                        )}
                      </View>
                    ) : (
                      <Text style={styles.aiInfoEmpty}>Chưa có dữ liệu phân tích Tech Stack.</Text>
                    )}
                  </View>

                  {/* 2. RAG MATURITY CARD */}
                  <View style={styles.aiSectionCard}>
                    <View style={styles.aiCardHeaderRow}>
                      <Text style={styles.aiCardTitle}>RAG MATURITY</Text>
                      <View style={styles.aiGeminiBadge}>
                        <Text style={styles.aiGeminiBadgeText}>Gemini AI</Text>
                      </View>
                    </View>

                    {ragMaturity ? (
                      <View style={styles.aiCardBody}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                          <Text style={styles.aiInfoLabel}>Mức độ hoàn thiện:</Text>
                          <View style={styles.levelBadge}>
                            <Text style={styles.levelBadgeText}>{ragMaturity.level || 'ADVANCED'}</Text>
                          </View>
                        </View>

                        {ragMaturity.features_detected?.length > 0 && (
                          <View style={{ marginTop: 4 }}>
                            <Text style={[styles.aiInfoLabel, { marginBottom: 4 }]}>Features phát hiện:</Text>
                            <View style={styles.chipsRow}>
                              {ragMaturity.features_detected.map((f, idx) => (
                                <View key={idx} style={styles.chipTag}>
                                  <Text style={styles.chipTagText}>{f}</Text>
                                </View>
                              ))}
                            </View>
                          </View>
                        )}
                      </View>
                    ) : (
                      <Text style={styles.aiInfoEmpty}>Chưa có dữ liệu RAG Maturity.</Text>
                    )}
                  </View>

                  {/* 3. AGENT INTELLIGENCE CARD */}
                  <View style={styles.aiSectionCard}>
                    <View style={styles.aiCardHeaderRow}>
                      <Text style={styles.aiCardTitle}>AGENT INTELLIGENCE</Text>
                      <View style={styles.aiGeminiBadge}>
                        <Text style={styles.aiGeminiBadgeText}>Gemini AI</Text>
                      </View>
                    </View>

                    {agentIntel ? (
                      <View style={styles.aiCardBody}>
                        <Text style={styles.aiInfoLine}>
                          <Text style={styles.aiInfoLabel}>Động cơ suy luận (Reasoning): </Text>
                          <Text style={{ fontWeight: '800', color: '#ea580c' }}>
                            {agentIntel.reasoning_pattern || 'ReAct'}
                          </Text>
                        </Text>

                        <Text style={styles.aiInfoLine}>
                          <Text style={styles.aiInfoLabel}>File cấu hình Agent: </Text>
                          {agentIntel.has_agent_config_files ? 'Đã phát hiện' : 'Không có'}
                        </Text>

                        {agentIntel.detected_skills?.length > 0 && (
                          <View style={{ marginTop: 6 }}>
                            <Text style={[styles.aiInfoLabel, { marginBottom: 4 }]}>Kỹ năng phát hiện (Skills):</Text>
                            <View style={styles.chipsRow}>
                              {agentIntel.detected_skills.map((s, idx) => (
                                <View key={idx} style={styles.chipTagHighlight}>
                                  <Text style={styles.chipTagHighlightText}>{s}</Text>
                                </View>
                              ))}
                            </View>
                          </View>
                        )}
                      </View>
                    ) : (
                      <Text style={styles.aiInfoEmpty}>Chưa có dữ liệu Agent Intelligence.</Text>
                    )}
                  </View>

                  {/* 4. KIỂM ĐỊNH RÀNG BUỘC CỨNG (HARD CONSTRAINTS - HIỂN THỊ ĐỦ 3 PHẦN KHỚP 100% WEB) */}
                  {hardConstraints && (
                    <View style={styles.aiSectionCard}>
                      <View style={styles.aiCardHeaderRow}>
                        <Text style={styles.aiCardTitle}>KIỂM ĐỊNH RÀNG BUỘC CỨNG (HARD CONSTRAINTS)</Text>
                        <View style={styles.passedBadge}>
                          <Text style={styles.passedBadgeText}>
                            {hardConstraints.is_disqualified ? 'KHÔNG HỢP LỆ (0 ĐIỂM)' : 'ĐẠT YÊU CẦU'}
                          </Text>
                        </View>
                      </View>

                      <View style={{ gap: 8 }}>
                        {renderConstraintItem('Kiểm tra Thuật toán AI/LLM', hardConstraints.ai_algorithm_check)}
                        {renderConstraintItem('Kiểm tra Mức độ Nghiêm trọng & Chính xác', hardConstraints.severity_accuracy_check)}
                        {renderConstraintItem('Kiểm tra Tài liệu API & Bảo mật Key', hardConstraints.ux_and_devices_check)}
                      </View>
                    </View>
                  )}

                  {/* 5. TỔNG HỢP PHÂN TÍCH CẤP TEAM (TEAM AGGREGATE REVIEW) */}
                  {teamAggregateReview && (
                    <View style={styles.aiSectionCard}>
                      <View style={styles.aiCardHeaderRow}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <BookOpen size={16} color="#ea580c" />
                          <Text style={styles.aiCardTitle}>TỔNG HỢP PHÂN TÍCH CẤP TEAM</Text>
                        </View>
                      </View>

                      {/* Tóm tắt lịch sử phát triển */}
                      {teamAggregateReview.result?.overall_picture?.historical_synthesis ? (
                        <View style={{ marginBottom: 12 }}>
                          <Text style={styles.subSectionTitle}>TÓM TẮT LỊCH SỬ PHÁT TRIỂN:</Text>
                          <View style={styles.quoteBox}>
                            <Text style={styles.quoteText}>
                              {teamAggregateReview.result.overall_picture.historical_synthesis}
                            </Text>
                          </View>
                        </View>
                      ) : null}

                      {/* Đánh giá định tính theo tiêu chí Rubric */}
                      {teamAggregateReview.result?.criteria_comments && (
                        <View>
                          <Text style={styles.subSectionTitle}>ĐÁNH GIÁ ĐỊNH TÍNH THEO RUBRIC:</Text>
                          <View style={{ gap: 8, marginTop: 4 }}>
                            {Object.entries(teamAggregateReview.result.criteria_comments).map(([critKey, val], idx) => {
                              const gStyle = getGradeStyle(val?.grade);
                              return (
                                <View key={idx} style={styles.criteriaCommentBox}>
                                  <View style={styles.critCommentHeader}>
                                    <Text style={styles.critCommentKey}>[{critKey}]</Text>
                                    <View style={[styles.gradeTag, { backgroundColor: gStyle.bg, borderColor: gStyle.border }]}>
                                      <Text style={[styles.gradeTagText, { color: gStyle.text }]}>{val?.grade || 'Đạt'}</Text>
                                    </View>
                                  </View>
                                  {val?.comment ? (
                                    <Text style={styles.critCommentText}>{val.comment}</Text>
                                  ) : null}
                                </View>
                              );
                            })}
                          </View>
                        </View>
                      )}
                    </View>
                  )}

                  {/* 6. LỊCH SỬ PHÂN TÍCH THEO PUSH / COMMIT */}
                  {commitReviews.length > 0 && (
                    <View style={styles.aiSectionCard}>
                      <View style={styles.aiCardHeaderRow}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Code2 size={16} color="#ea580c" />
                          <Text style={styles.aiCardTitle}>PHÂN TÍCH ĐỢT PUSH/COMMIT ({commitReviews.length})</Text>
                        </View>
                      </View>

                      <View style={{ gap: 8 }}>
                        {commitReviews.map((r, idx) => {
                          const isExpanded = expandedCommitIndex === idx;
                          const cInfo = r.result?.commit_info || {};
                          const overall = r.result?.overall_picture || {};

                          return (
                            <View key={r._id || idx} style={styles.commitAccordionCard}>
                              <TouchableOpacity
                                style={styles.commitAccordionHeader}
                                onPress={() => setExpandedCommitIndex(isExpanded ? null : idx)}
                                activeOpacity={0.7}
                              >
                                <View style={{ flex: 1 }}>
                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <View style={styles.shaChip}>
                                      <Text style={styles.shaChipText}>
                                        {cInfo.commitSha ? cInfo.commitSha.substring(0, 7) : 'push-sync'}
                                      </Text>
                                    </View>
                                    <Text style={styles.commitMsgText} numberOfLines={1}>
                                      {cInfo.message || overall.push_summary || 'Đợt đẩy code mới'}
                                    </Text>
                                  </View>
                                  <Text style={styles.commitAuthorText}>
                                    Tác giả: @{cInfo.authorGithubUsername || cInfo.authorName || 'dev'} • {new Date(r.createdAt).toLocaleDateString('vi-VN')}
                                  </Text>
                                </View>
                                {isExpanded ? <ChevronUp size={16} color="#64748b" /> : <ChevronDown size={16} color="#64748b" />}
                              </TouchableOpacity>

                              {isExpanded && (
                                <View style={styles.commitAccordionBody}>
                                  {overall.push_summary ? (
                                    <View style={{ marginBottom: 6 }}>
                                      <Text style={styles.commitBodyLabel}>Tóm tắt thay đổi:</Text>
                                      <Text style={styles.commitBodyText}>{overall.push_summary}</Text>
                                    </View>
                                  ) : null}
                                  {overall.current_focus ? (
                                    <View>
                                      <Text style={styles.commitBodyLabel}>Tiêu điểm lập trình:</Text>
                                      <Text style={styles.commitBodyText}>{overall.current_focus}</Text>
                                    </View>
                                  ) : null}
                                </View>
                              )}
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  )}

                  {/* 7. GỢI Ý CÂU HỎI PHẢN BIỆN (GEMINI AI) */}
                  {aiQuestions.length > 0 && (
                    <View style={styles.aiQuestionCard}>
                      <View style={styles.aiTitleRow}>
                        <Sparkles size={16} color="#ea580c" />
                        <Text style={styles.aiQuestionTitle}>GỢI Ý CÂU HỎI PHẢN BIỆN (GEMINI AI)</Text>
                      </View>
                      {aiQuestions.map((q, idx) => (
                        <View key={idx} style={styles.questionItem}>
                          <Text style={styles.questionText}>• {q}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* 8. HOẠT ĐỘNG COMMIT LOGS */}
                  {commits.length > 0 && (
                    <View style={styles.aiSectionCard}>
                      <View style={styles.aiCardHeaderRow}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Clock size={16} color="#ea580c" />
                          <Text style={styles.aiCardTitle}>HOẠT ĐỘNG COMMIT ({commits.length})</Text>
                        </View>
                      </View>

                      <View style={{ gap: 8 }}>
                        {commits.slice(0, 10).map((c, idx) => (
                          <View key={c._id || idx} style={styles.commitLogRow}>
                            <Text style={styles.commitLogMsg} numberOfLines={1}>{c.message}</Text>
                            <View style={styles.commitLogMeta}>
                              <Text style={styles.commitLogAuthor}>@{c.authorGithubUsername || c.authorName}</Text>
                              <View style={{ flexDirection: 'row', gap: 6 }}>
                                <Text style={{ fontSize: 10, fontWeight: '700', color: '#16a34a' }}>+{c.additions || 0}</Text>
                                <Text style={{ fontSize: 10, fontWeight: '700', color: '#dc2626' }}>-{c.deletions || 0}</Text>
                              </View>
                            </View>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}
                </View>
              ) : (
                /* THÔNG BÁO KHI CHƯA CÓ BÁO CÁO PHÂN TÍCH AI */
                <View style={styles.aiEmptyCard}>
                  <Sparkles size={48} color="#cbd5e1" />
                  <Text style={styles.aiEmptyTitle}>Chưa có báo cáo phân tích AI</Text>
                  <Text style={styles.aiEmptySub}>
                    Dự án này chưa có báo cáo phân tích mã nguồn tự động từ Gemini AI. Hệ thống sẽ tự động quét kho lưu trữ khi đội thi thực hiện đẩy commit mới.
                  </Text>
                </View>
              )}
            </ScrollView>
          )}

          {/* MODAL XEM DỮ LIỆU LIVE & LINE CHART (MQTT SIMULATOR) */}
          <Modal visible={liveDialogOpen} animationType="slide" transparent>
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <View>
                    <Text style={styles.modalTitle}>SỐ LIỆU LIVE — {team?.name}</Text>
                    <Text style={styles.modalSub}>
                      {liveData ? `Cập nhật UTC: ${liveData.timestamp || 'Mới nhất'}` : 'Đang chờ dữ liệu...'}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => setLiveDialogOpen(false)} style={{ padding: 4 }}>
                    <X size={20} color="#0f172a" />
                  </TouchableOpacity>
                </View>

                {/* Scenario Selector Row */}
                {availScenarios.length > 0 && (
                  <View style={styles.scenarioSection}>
                    <Text style={styles.scenarioLabel}>KỊCH BẢN GIẢ LẬP SỰ CỐ (SIMULATOR):</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
                      {availScenarios.map((sc) => {
                        const scCode = sc.code || sc;
                        const scName = sc.name || scCode;
                        const isSelected = currentScenario === scCode;

                        return (
                          <TouchableOpacity
                            key={scCode}
                            style={[styles.scChip, isSelected && styles.scChipActive]}
                            onPress={() => handleChangeScenario(scCode)}
                          >
                            <Text style={[styles.scChipText, isSelected && styles.scChipTextActive]}>
                              {isSelected ? '✓ ' : ''}{scName}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}

                {/* Live Devices & Real-time SVG Line Charts Stream */}
                <ScrollView style={{ flex: 1, marginTop: 12 }} contentContainerStyle={{ paddingBottom: 20 }}>
                  {liveError ? (
                    <View style={styles.errBox}>
                      <AlertTriangle size={36} color="#ef4444" />
                      <Text style={styles.errTitle}>Chưa thể lấy dữ liệu Telemetry Live</Text>
                      <Text style={styles.errSub}>{liveError}</Text>
                    </View>
                  ) : !liveData || !liveData.devices ? (
                    <View style={styles.centerBox}>
                      <ActivityIndicator size="small" color="#ea580c" />
                      <Text style={styles.loadingText}>[ĐANG CHỜ DỮ LIỆU TELEMETRY TỪ SIMULATOR...]</Text>
                    </View>
                  ) : (
                    liveData.devices.map((d) => {
                      const isErr = d.status === 'error';
                      const series = historyData[d.deviceCode] || [];
                      const metricsKeys = d.metrics ? Object.keys(d.metrics) : [];
                      const colors = ['#ea580c', '#0284c7', '#16a34a', '#dc2626', '#eab308', '#9333ea'];

                      return (
                        <View key={d.deviceCode} style={[styles.deviceCard, isErr && styles.deviceCardErr]}>
                          <View style={styles.deviceHeader}>
                            <Text style={styles.deviceCodeText}>{d.deviceCode}</Text>
                            {isErr ? (
                              <View style={styles.statusErr}>
                                <Text style={styles.statusErrText}>⚠ LỖI / MẤT TÍN HIỆU</Text>
                              </View>
                            ) : (
                              <View style={styles.statusNormal}>
                                <Text style={styles.statusNormalText}>⚡ BÌNH THƯỜNG</Text>
                              </View>
                            )}
                          </View>

                          {/* SVG Line Chart (Chuẩn 100% như trên Web) */}
                          <View style={styles.lineChartBox}>
                            {isErr || metricsKeys.length === 0 ? (
                              <View style={styles.noDataBox}>
                                <Text style={styles.noDataText}>— KHÔNG CÓ SỐ LIỆU —</Text>
                              </View>
                            ) : (
                              <DeviceLineChart
                                series={series}
                                metricsKeys={metricsKeys}
                                colors={colors}
                              />
                            )}
                          </View>
                        </View>
                      );
                    })
                  )}
                </ScrollView>
              </View>
            </View>
          </Modal>
        </View>
      </KeyboardAvoidingView>
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: '#64748b',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  backBtn: {
    padding: 6,
  },
  headerTitleContainer: {
    flex: 1,
    marginHorizontal: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  headerSubTitle: {
    fontSize: 11,
    color: '#64748b',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeGraded: {
    backgroundColor: '#dcfce7',
  },
  badgePending: {
    backgroundColor: '#fff7ed',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  badgeTextGraded: {
    color: '#16a34a',
  },
  badgeTextPending: {
    color: '#ea580c',
  },
  simulatorBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff7ed',
    borderBottomWidth: 1,
    borderBottomColor: '#ffedd5',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  simulatorLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  simulatorTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#9a3412',
  },
  simulatorSub: {
    fontSize: 10,
    color: '#c2410c',
  },
  simulatorRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  toggleBtnOn: {
    backgroundColor: '#ea580c',
  },
  toggleBtnOff: {
    backgroundColor: '#0284c7',
  },
  toggleBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  liveBtn: {
    backgroundColor: '#0284c7',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  liveBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  liveScoreCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fed7aa',
    elevation: 2,
    shadowColor: '#ea580c',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  scoreMainCol: {
    alignItems: 'flex-start',
  },
  scoreCardTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#ea580c',
    letterSpacing: 0.5,
  },
  scoreBigRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginTop: 2,
  },
  scoreBigText: {
    fontSize: 24,
    fontWeight: '900',
    color: '#ea580c',
  },
  scoreMaxText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#94a3b8',
  },
  scoreCardDivider: {
    width: 1,
    height: '80%',
    backgroundColor: '#fed7aa',
    marginHorizontal: 16,
  },
  scoreMetaCol: {
    flex: 1,
    justifyContent: 'center',
  },
  scoreMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  scoreMetaLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
  },
  scoreMetaVal: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0f172a',
  },
  mainTabBar: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    marginTop: 6,
  },
  mainTabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  mainTabItemActive: {
    borderBottomColor: '#ea580c',
  },
  mainTabLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
  },
  mainTabLabelActive: {
    color: '#ea580c',
  },
  stepBarScroll: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    maxHeight: 56,
  },
  stepBarContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
  },
  stepChipLarge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  stepChipActive: {
    backgroundColor: '#ea580c',
    borderColor: '#c2410c',
  },
  stepChipDone: {
    backgroundColor: '#dcfce7',
    borderColor: '#86efac',
  },
  stepChipTextLarge: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
  },
  stepChipTextActive: {
    color: '#ffffff',
    fontWeight: '800',
  },
  stepChipTextDone: {
    color: '#15803d',
    fontWeight: '800',
  },
  stepperContainer: {
    padding: 16,
    paddingBottom: 24,
  },
  critCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  critHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  critCodeTag: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ea580c',
  },
  critNameTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 2,
  },
  maxScoreBadge: {
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#ffedd5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  maxScoreBadgeText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#c2410c',
  },
  critDescText: {
    fontSize: 13.5,
    color: '#475569',
    marginTop: 8,
    lineHeight: 19,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#475569',
    marginTop: 16,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  quickScoreRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  quickScoreBtn: {
    flex: 1,
    height: 44,
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  quickScoreBtnSelected: {
    backgroundColor: '#ea580c',
    borderColor: '#c2410c',
  },
  quickScoreBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#334155',
  },
  quickScoreBtnTextSelected: {
    color: '#ffffff',
  },
  customScoreInputFull: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    width: '100%',
    marginBottom: 10,
  },
  levelsBox: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 12,
    marginTop: 10,
  },
  levelsBoxTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: 6,
  },
  levelRow: {
    marginBottom: 8,
  },
  levelLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },
  levelDesc: {
    fontSize: 12.5,
    color: '#334155',
    lineHeight: 18,
    marginTop: 2,
  },
  commentInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0f172a',
    minHeight: 70,
  },
  finalStepCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  finalStepTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  finalStepSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
    marginBottom: 12,
  },
  overallTextArea: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0f172a',
    minHeight: 110,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  submitBtn: {
    backgroundColor: '#ea580c',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 10,
  },
  submitBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  stepperFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  stepperNavBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
  },
  stepperNavBtnDisabled: {
    opacity: 0.5,
  },
  stepperNavBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e293b',
  },
  stepperNavBtnTextDisabled: {
    color: '#94a3b8',
  },
  stepIndicatorText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 10,
    textAlign: 'center',
  },
  aiTabContainer: {
    padding: 16,
  },
  aiSectionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  aiCardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 8,
    marginBottom: 10,
  },
  aiCardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  aiGeminiBadge: {
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#ffedd5',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
  },
  aiGeminiBadgeText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#ea580c',
  },
  aiCardBody: {
    gap: 8,
  },
  aiInfoLine: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 20,
  },
  aiInfoLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  aiInfoEmpty: {
    fontSize: 13,
    color: '#94a3b8',
    fontStyle: 'italic',
  },
  levelBadge: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  levelBadgeText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#1d4ed8',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chipTag: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  chipTagText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  chipTagHighlight: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  chipTagHighlightText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#15803d',
  },
  passedBadge: {
    backgroundColor: '#dcfce7',
    borderWidth: 1,
    borderColor: '#86efac',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
  },
  passedBadgeText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#15803d',
  },
  constraintItemCard: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    padding: 12,
  },
  constraintItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  constraintTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  constraintStatusTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  constraintStatusTagText: {
    fontSize: 11,
    fontWeight: '800',
  },
  constraintDesc: {
    fontSize: 13.5,
    color: '#334155',
    marginTop: 6,
    lineHeight: 19.5,
  },
  subSectionTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#475569',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  quoteBox: {
    backgroundColor: '#f8fafc',
    borderLeftWidth: 4,
    borderLeftColor: '#ea580c',
    borderRadius: 6,
    padding: 12,
  },
  quoteText: {
    fontSize: 14,
    color: '#1e293b',
    lineHeight: 20,
  },
  criteriaCommentBox: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 12,
  },
  critCommentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  critCommentKey: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  gradeTag: {
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  gradeTagText: {
    fontSize: 12,
    fontWeight: '800',
  },
  critCommentText: {
    fontSize: 13.5,
    color: '#334155',
    marginTop: 6,
    lineHeight: 19,
  },
  commitAccordionCard: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    overflow: 'hidden',
  },
  commitAccordionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
  },
  shaChip: {
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#ffedd5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  shaChipText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#ea580c',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  commitMsgText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  commitAuthorText: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 3,
  },
  commitAccordionBody: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  commitBodyLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e293b',
  },
  commitBodyText: {
    fontSize: 13.5,
    color: '#334155',
    lineHeight: 19,
    marginTop: 3,
  },
  commitLogRow: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 12,
  },
  commitLogMsg: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  commitLogMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  commitLogAuthor: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#ea580c',
  },
  memberRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  memberName: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#0f172a',
  },
  memberSub: {
    fontSize: 12.5,
    color: '#64748b',
    marginTop: 2,
  },
  roleTag: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  roleTagLeader: {
    backgroundColor: '#fff7ed',
    borderColor: '#fed7aa',
  },
  roleTagMember: {
    backgroundColor: '#f1f5f9',
    borderColor: '#cbd5e1',
  },
  roleTagText: {
    fontSize: 11.5,
    fontWeight: '800',
  },
  roleTagLeaderText: {
    color: '#ea580c',
  },
  roleTagMemberText: {
    color: '#475569',
  },
  aiQuestionCard: {
    backgroundColor: '#fff7ed',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#ffedd5',
    gap: 10,
  },
  aiTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#ffedd5',
    paddingBottom: 8,
  },
  aiQuestionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ea580c',
  },
  questionItem: {
    paddingVertical: 3,
  },
  questionText: {
    fontSize: 14,
    color: '#7c2d12',
    lineHeight: 20,
    fontWeight: '600',
  },
  aiEmptyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 32,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  aiEmptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#334155',
    marginTop: 14,
    textAlign: 'center',
  },
  aiEmptySub: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 19,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '78%',
    padding: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 10,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  modalSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  scenarioSection: {
    marginTop: 10,
  },
  scenarioLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
  },
  scChip: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  scChipActive: {
    backgroundColor: '#ea580c',
    borderColor: '#c2410c',
  },
  scChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  scChipTextActive: {
    color: '#ffffff',
    fontWeight: '800',
  },
  errBox: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 20,
  },
  errTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#991b1b',
    marginTop: 10,
  },
  errSub: {
    fontSize: 12.5,
    color: '#b91c1c',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
  deviceCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  deviceCardErr: {
    backgroundColor: '#fff1f2',
    borderColor: '#fecaca',
  },
  deviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  deviceCodeText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  statusNormal: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusNormalText: {
    color: '#15803d',
    fontSize: 10,
    fontWeight: '800',
  },
  statusErr: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusErrText: {
    color: '#dc2626',
    fontSize: 10,
    fontWeight: '800',
  },
  lineChartBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  emptyChartBox: {
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyChartText: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 6,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  noDataBox: {
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noDataText: {
    fontSize: 12,
    color: '#94a3b8',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  svgChartContainer: {
    width: '100%',
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    color: '#64748b',
  },
});
