import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { 
  Search, 
  Trophy, 
  Users, 
  Award, 
  Lock, 
  ShieldAlert, 
  BookOpen, 
  RefreshCw,
  ExternalLink,
  MessageSquare
} from 'lucide-react';

export default function AdminGradesView() {
  const token = localStorage.getItem('token');

  const [events, setEvents] = useState<any[]>([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [rounds, setRounds] = useState<any[]>([]);
  const [tracks, setTracks] = useState<any[]>([]);
  const [selectedRoundName, setSelectedRoundName] = useState('');
  const [selectedTrackId, setSelectedTrackId] = useState('');

  // Compute active round document based on selected track
  const selectedTrackObj = tracks.find((t: any) => t._id === selectedTrackId);
  const selectedRoundId = selectedTrackObj ? (selectedTrackObj.roundId?._id || selectedTrackObj.roundId) : '';
  const selectedRound = selectedRoundId ? rounds.find((r: any) => r._id === selectedRoundId) : null;

  const [teams, setTeams] = useState<any[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Grading details from coordinator viewpoint
  const [gradingsData, setGradingsData] = useState<any>(null);
  const [loadingGrades, setLoadingGrades] = useState(false);
  const [errorGrades, setErrorGrades] = useState('');

  const [loadingTeams, setLoadingTeams] = useState(false);

  const [activeJudgeIndex, setActiveJudgeIndex] = useState(0);

  // Reset active judge index when selection changes
  useEffect(() => {
    setActiveJudgeIndex(0);
  }, [selectedTeamId, selectedRoundId]);

  console.log('AdminGradesView State Log:', {
    roundsLength: rounds.length,
    tracksLength: tracks.length,
    selectedRoundName,
    selectedTrackId,
    selectedRoundId,
    selectedRound,
    selectedTeamId
  });

  // Keep selectedTrackId in sync with selectedRoundName
  useEffect(() => {
    if (!selectedRoundName || rounds.length === 0 || tracks.length === 0) return;

    const matchingRoundIds = rounds
      .filter((r: any) => r.name === selectedRoundName)
      .map((r: any) => r._id.toString());

    const currentTrack = tracks.find((t: any) => t._id === selectedTrackId);
    const currentTrackRoundId = currentTrack ? (currentTrack.roundId?._id || currentTrack.roundId)?.toString() : '';

    if (!currentTrackRoundId || !matchingRoundIds.includes(currentTrackRoundId)) {
      const firstMatchingTrack = tracks.find((t: any) => {
        const tRoundId = (t.roundId?._id || t.roundId)?.toString();
        return matchingRoundIds.includes(tRoundId);
      });
      if (firstMatchingTrack) {
        setSelectedTrackId(firstMatchingTrack._id);
      }
    }
  }, [selectedRoundName, rounds, tracks, selectedTrackId]);

  // Filter tracks to display only those belonging to the selected round name
  const filteredTracksForDropdown = tracks.filter((t: any) => {
    const tRoundId = (t.roundId?._id || t.roundId)?.toString();
    const matchingRounds = rounds.filter((r: any) => r.name === selectedRoundName);
    return matchingRounds.some((r: any) => r._id.toString() === tRoundId);
  });

  // Fetch events on mount
  useEffect(() => {
    axios.get('http://localhost:5000/api/events')
      .then((res: any) => {
        setEvents(res.data);
        if (res.data.length > 0) {
          setSelectedEventId(res.data[0]._id);
        }
      })
      .catch((err: any) => console.error('Error fetching events:', err));
  }, []);

  // Fetch event details (tracks & rounds)
  useEffect(() => {
    if (!selectedEventId) return;
    axios.get(`http://localhost:5000/api/events/${selectedEventId}`)
      .then((res: any) => {
        const fetchedTracks = res.data.tracks || [];
        const fetchedRounds = res.data.rounds || [];
        setTracks(fetchedTracks);
        setRounds(fetchedRounds);
        
        const uniqueNames = Array.from(new Set(fetchedRounds.map((r: any) => r.name))) as string[];
        if (uniqueNames.length > 0) {
          setSelectedRoundName(uniqueNames[0]);
        } else {
          setSelectedRoundName('');
        }
        
        if (fetchedTracks.length > 0) {
          setSelectedTrackId(fetchedTracks[0]._id);
        } else {
          setSelectedTrackId('');
        }
      })
      .catch((err: any) => console.error('Error fetching event details:', err));
  }, [selectedEventId]);

  // Fetch teams for the selected event and filter by selected track
  useEffect(() => {
    if (!selectedEventId || !selectedTrackId) {
      setTeams([]);
      setSelectedTeamId('');
      setGradingsData(null);
      return;
    }

    setLoadingTeams(true);
    axios.get(`http://localhost:5000/api/teams/all/${selectedEventId}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res: any) => {
        // Filter confirmed teams matching the selected track (handling populated trackId object)
        const matchedTeams = res.data.filter((t: any) => {
          const tTrackId = t.trackId && typeof t.trackId === 'object' ? t.trackId._id : t.trackId;
          return t.status === 'confirmed' && String(tTrackId) === String(selectedTrackId);
        });
        setTeams(matchedTeams);
        if (matchedTeams.length > 0) {
          setSelectedTeamId(matchedTeams[0]._id);
        } else {
          setSelectedTeamId('');
          setGradingsData(null);
        }
      })
      .catch((err: any) => console.error('Error fetching teams:', err))
      .finally(() => setLoadingTeams(false));
  }, [selectedEventId, selectedTrackId, token]);

  // Fetch detailed scores for the selected team
  const fetchDetailedScores = useCallback(async (teamId: string, roundId: string) => {
    if (!teamId || !roundId) {
      setGradingsData(null);
      return;
    }
    setLoadingGrades(true);
    setErrorGrades('');
    const selectedTeamObj = teams.find(t => t._id === teamId);
    try {
      const [gradesRes, rubricRes] = await Promise.all([
        axios.get(
          `http://localhost:5000/api/grades/team/${teamId}/round/${roundId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        ),
        axios.get(
          `http://localhost:5000/api/rubrics/round/${roundId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        ).catch(err => {
          console.warn('No active rubric found for this round:', err);
          return { data: { criteria: [] } };
        })
      ]);
      setGradingsData({
        team: selectedTeamObj,
        gradings: gradesRes.data.judgesScores || [],
        criteria: rubricRes.data?.criteria || []
      });
    } catch (err: any) {
      console.error('Error fetching grades:', err);
      setGradingsData(null);
      setErrorGrades(err.response?.data?.message || 'Không thể tải bảng điểm chi tiết.');
    } finally {
      setLoadingGrades(false);
    }
  }, [token, teams]);

  useEffect(() => {
    if (selectedTeamId && selectedRoundId) {
      fetchDetailedScores(selectedTeamId, selectedRoundId);
    } else {
      setGradingsData(null);
    }
  }, [selectedTeamId, selectedRoundId, fetchDetailedScores]);



  const filteredTeams = teams.filter(t => 
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (t.topicSubmission?.title && t.topicSubmission.title.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const calculateFinalAverage = () => {
    if (!gradingsData || !gradingsData.gradings || gradingsData.gradings.length === 0) return 0;
    const totalWeightedSum = gradingsData.gradings.reduce((sum: number, g: any) => sum + (g.score?.totalWeightedScore || 0), 0);
    return Math.round((totalWeightedSum / gradingsData.gradings.length) * 100) / 100;
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-10 space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="bg-gradient-premium p-3 rounded-2xl text-white shadow-lg shadow-indigo-500/20">
          <ShieldAlert size={28} />
        </div>
        <div>
          <h1 className="text-3xl font-extrabold text-white">
            Chi tiết Điểm số (Ban tổ chức)
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            Theo dõi chi tiết điểm số của từng giám khảo chấm cho từng đội thi
          </p>
        </div>
      </div>

      {/* Selectors Event & Round */}
      <div className="glass p-6 rounded-2xl flex flex-wrap gap-4 items-center">
        <div>
          <label className="block text-[10px] font-semibold uppercase text-slate-400 mb-1">
            Cuộc thi
          </label>
          <select
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs px-3 py-2 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none w-56 font-bold"
          >
            {events.map((e: any) => (
              <option key={e._id} value={e._id}>
                {e.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-semibold uppercase text-slate-400 mb-1">
            Vòng thi (Round)
          </label>
          <select
            value={selectedRoundName}
            onChange={(e) => setSelectedRoundName(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs px-3 py-2 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none w-56 font-bold"
          >
            {Array.from(new Set(rounds.map((r: any) => r.name))).map((name: any) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
            {rounds.length === 0 && <option>Không có vòng thi</option>}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-semibold uppercase text-slate-400 mb-1">
            Bảng đấu (Track)
          </label>
          <select
            value={selectedTrackId}
            onChange={(e) => setSelectedTrackId(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs px-3 py-2 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none w-64 font-bold"
          >
            {filteredTracksForDropdown.map((t: any) => (
              <option key={t._id} value={t._id}>
                {t.name}
              </option>
            ))}
            {filteredTracksForDropdown.length === 0 && <option>Không có bảng đấu</option>}
          </select>
        </div>
      </div>

      {/* Main 2-column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Teams Sidebar */}
        <div className="lg:col-span-4 space-y-4">
          <div className="glass p-5 rounded-2xl space-y-4">
            <h2 className="text-sm font-bold text-slate-200 flex items-center gap-1.5 border-b border-slate-800 pb-3">
              <Users size={16} className="text-indigo-400" />
              <span>Danh sách Đội thi ({filteredTeams.length})</span>
            </h2>

            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <Search size={14} />
              </span>
              <input
                type="text"
                placeholder="Tìm kiếm đội thi..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-slate-950/80 border border-slate-800 rounded-xl text-xs pl-9 pr-4 py-2 w-full text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>

            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              {loadingTeams ? (
                <div className="text-center py-10 text-slate-400 text-xs animate-pulse font-mono">[ĐANG TẢI...]</div>
              ) : filteredTeams.length > 0 ? (
                filteredTeams.map((t: any) => (
                  <button
                    key={t._id}
                    onClick={() => setSelectedTeamId(t._id)}
                    className={`w-full text-left p-3.5 rounded-xl border transition-all text-xs flex items-center gap-3 ${
                      selectedTeamId === t._id
                        ? 'bg-indigo-600/20 border-indigo-500/60 shadow-md text-white'
                        : 'bg-slate-900/30 border-slate-800/80 text-slate-400 hover:bg-slate-900/50 hover:text-slate-200'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold font-mono ${
                      selectedTeamId === t._id ? 'bg-indigo-500 text-white' : 'bg-slate-850 text-slate-400'
                    }`}>
                      {t.name.charAt(0)}
                    </div>
                    <div className="truncate flex-1">
                      <span className="font-bold block truncate">{t.name}</span>
                      <span className="text-[10px] text-slate-500 block truncate">
                        {t.topicSubmission?.title || 'Chưa đăng ký đề tài'}
                      </span>
                    </div>
                  </button>
                ))
              ) : (
                <div className="text-center py-10 text-slate-500 text-xs italic">
                  Không tìm thấy đội thi nào phù hợp.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Grading Details View */}
        <div className="lg:col-span-8 space-y-6">
          {loadingGrades ? (
            <div className="glass p-12 text-center text-slate-400 flex flex-col items-center justify-center min-h-[400px]">
              <RefreshCw size={32} className="animate-spin text-indigo-500 mb-3" />
              <p className="text-xs">Đang tải chi tiết bảng điểm...</p>
            </div>
          ) : errorGrades ? (
            <div className="bg-rose-500/10 border border-rose-500/20 p-6 rounded-2xl text-center">
              <p className="text-rose-400 text-xs">{errorGrades}</p>
            </div>
          ) : gradingsData && gradingsData.team ? (
            <div className="space-y-6">
              
              {/* Solution Summary */}
              <div className="glass p-6 rounded-3xl space-y-4">
                <div className="flex justify-between items-start flex-wrap gap-4 border-b border-slate-800 pb-4">
                  <div>
                    <span className="text-[9px] text-indigo-400 font-bold uppercase tracking-wider bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 rounded-md">
                      Thông tin đề tài
                    </span>
                    <h2 className="text-2xl font-black text-white mt-2 uppercase">{gradingsData.team.name}</h2>
                    <p className="text-xs font-semibold text-slate-300 mt-1">Đề tài: {gradingsData.team.topicSubmission?.title || 'Chưa đăng ký'}</p>
                  </div>
                  {gradingsData.team.topicSubmission?.demoUrl && (
                    <a
                      href={gradingsData.team.topicSubmission.demoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 text-xs font-bold text-slate-300 hover:text-white border border-slate-800 hover:border-slate-700 bg-slate-900/60 px-4 py-2 rounded-xl transition-all shadow-sm"
                    >
                      <ExternalLink size={14} />
                      <span>Xem Demo</span>
                    </a>
                  )}
                </div>

                {gradingsData.team.topicSubmission?.description && (
                  <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800/80">
                    <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mb-1.5 font-mono">Ý tưởng giải pháp:</p>
                    <p className="text-xs text-slate-300 leading-relaxed font-sans">{gradingsData.team.topicSubmission.description}</p>
                  </div>
                )}
                
                {/* Final calculated live average */}
                <div className="flex items-center gap-3 bg-indigo-600/10 border border-indigo-500/25 p-4 rounded-xl">
                  <Trophy className="text-indigo-400 shrink-0" size={24} />
                  <div>
                    <span className="text-xs font-semibold text-slate-300">Điểm trung bình chung cuộc: </span>
                    <span className="text-lg font-black text-indigo-300 font-mono ml-1">
                      {calculateFinalAverage()} / 10.0đ
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      Tính toán tự động từ {gradingsData.gradings?.length || 0} giám khảo đã nộp
                    </span>
                  </div>
                </div>
              </div>

              {/* Judges score breakdowns */}
              <div className="space-y-6">
                <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                  <Award size={18} className="text-indigo-400" />
                  <span>Chi tiết bảng điểm từ từng Giám khảo</span>
                </h3>

                {gradingsData.gradings && gradingsData.gradings.length > 0 ? (
                  <div className="space-y-6">
                    {/* Judge Tabs */}
                    <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-4">
                      {gradingsData.gradings.map((g: any, idx: number) => (
                        <button
                          key={g.score?._id || idx}
                          onClick={() => setActiveJudgeIndex(idx)}
                          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-2 ${
                            activeJudgeIndex === idx
                              ? 'bg-indigo-600/20 border-indigo-500/60 text-white shadow-md'
                              : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-900/70'
                          }`}
                        >
                          <div className={`w-2 h-2 rounded-full ${activeJudgeIndex === idx ? 'bg-indigo-400 animate-pulse' : 'bg-slate-600'}`} />
                          <span>{g.judge?.fullName || `Giám khảo ${idx + 1}`}</span>
                        </button>
                      ))}
                    </div>

                    {/* Selected Judge Card */}
                    {gradingsData.gradings[activeJudgeIndex] && (() => {
                      const g = gradingsData.gradings[activeJudgeIndex];
                      return (
                        <div key={g.score?._id || activeJudgeIndex} className="glass p-6 rounded-3xl space-y-4 border-l-4 border-l-indigo-500 animate-fadeIn">
                          
                          {/* Judge Header */}
                          <div className="flex justify-between items-start gap-4 border-b border-slate-800 pb-3 flex-wrap">
                            <div>
                              <span className="text-xs font-extrabold text-white block">
                                {g.judge?.fullName || 'Giám khảo ẩn danh'}
                              </span>
                              <span className="text-[10px] text-slate-500 font-mono">
                                {g.judge?.email}
                              </span>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="text-xs text-slate-450 block font-mono">Điểm trung bình:</span>
                              <span className="text-xl font-black text-indigo-400 font-mono">
                                {g.score?.totalWeightedScore || 0}
                              </span>
                              <span className="text-slate-550 text-xs font-bold font-mono"> / 10đ</span>
                            </div>
                          </div>

                          {/* Criteria Score Breakdown Table */}
                          <div className="overflow-x-auto border border-slate-800/80 rounded-xl">
                            <table className="w-full text-left text-xs border-collapse text-slate-350">
                              <thead>
                                <tr className="bg-slate-900/60 text-slate-450 font-mono text-[9px] font-bold uppercase border-b border-slate-800">
                                  <th className="p-3">Mã</th>
                                  <th className="p-3">Tiêu chí</th>
                                  <th className="p-3 text-center">Trọng số</th>
                                  <th className="p-3 text-center">Điểm số</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-850 bg-slate-950/30">
                                {gradingsData.criteria?.map((c: any) => {
                                  const detail = g.details?.find((d: any) => d.criterionId === c._id);
                                  return (
                                    <tr key={c._id} className="hover:bg-slate-900/10">
                                      <td className="p-3 font-mono font-bold text-indigo-400">{c.code}</td>
                                      <td className="p-3">
                                        <p className="font-bold text-slate-200">{c.name}</p>
                                        {detail?.comment && (
                                          <p className="text-[10px] text-slate-450 italic mt-0.5 flex items-center gap-1">
                                            <MessageSquare size={10} className="shrink-0" />
                                            <span>"{detail.comment}"</span>
                                          </p>
                                        )}
                                      </td>
                                      <td className="p-3 text-center font-mono">{c.weight}%</td>
                                      <td className="p-3 text-center font-mono font-bold text-slate-105">
                                        {detail ? detail.scoreValue : '-'}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>

                          {/* Overall Comment */}
                          {g.score?.overallComment && (
                            <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800 text-xs italic text-slate-300 leading-relaxed">
                              " {g.score.overallComment} "
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                ) : (
                  <div className="glass p-12 text-center text-slate-450 flex flex-col items-center justify-center min-h-[250px]">
                    <Lock size={32} className="text-slate-700 mb-2" />
                    <p className="text-xs italic text-slate-500">Chưa có giám khảo nào hoàn tất nộp điểm cho đội thi này.</p>
                  </div>
                )}
              </div>

            </div>
          ) : (
            <div className="glass p-12 text-center text-slate-400 flex flex-col items-center justify-center min-h-[400px]">
              <BookOpen size={48} className="text-slate-700 mb-3" />
              <p className="font-bold text-md text-slate-300">Vui lòng chọn đội thi</p>
              <p className="text-xs text-slate-500 max-w-sm mt-1">
                Chọn một đội thi ở danh sách bên trái để theo dõi chi tiết điểm số phân rã từ ban giám khảo.
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
