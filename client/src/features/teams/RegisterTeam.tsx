import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Users, UserPlus, Trash2, Calendar, FolderGit2, CheckCircle } from 'lucide-react';
import UniversityCombobox from '../shared/UniversityCombobox';
import CustomSelect from '../shared/CustomSelect';
import { Link, useSearchParams } from 'react-router-dom';

interface MemberInput {
  email: string;
  fullName: string;
  githubUsername: string;
  studentId: string;
  university: string;
  universityCustom?: string;
  isUniversityCustom?: boolean;
  checkingStatus?: 'idle' | 'checking' | 'eligible' | 'conflict';
  checkingMessage?: string;
}


export default function RegisterTeam() {
  const [searchParams] = useSearchParams();
  const eventIdParam = searchParams.get('eventId');
  const [events, setEvents] = useState<any[]>([]);
  const [selectedEventId, setSelectedEventId] = useState('');

  const [teamName, setTeamName] = useState('');

  // Leader info states (to capture missing profile info from Google OAuth)
  const [leaderFullName, setLeaderFullName] = useState('');
  const [leaderStudentId, setLeaderStudentId] = useState('');
  const [leaderGithubUsername, setLeaderGithubUsername] = useState('');
  const [leaderUniversity, setLeaderUniversity] = useState('');

  const [members, setMembers] = useState<MemberInput[]>([]);

  // History reuse states
  const [pastTeams, setPastTeams] = useState<any[]>([]);
  const [selectedPastTeamId, setSelectedPastTeamId] = useState('');
  const [infoMessage, setInfoMessage] = useState('');

  const [loading, setLoading] = useState(false);
  const [oldTeamName, setOldTeamName] = useState('');
  const [success, _setSuccess] = useState('');
  const [alreadyHasTeam, setAlreadyHasTeam] = useState(false);
  const [existingTeamName, setExistingTeamName] = useState('');
  const [checkingTeam, setCheckingTeam] = useState(true);
  const [loadingEvents, setLoadingEvents] = useState(true);

  const setError = (msg: string) => {
    if (msg) toast.error(msg);
  };
  const setSuccess = (msg: string) => {
    _setSuccess(msg);
    if (msg) toast.success(msg);
  };

  const token = localStorage.getItem('token');

  useEffect(() => {
    if (!token) {
      setCheckingTeam(false);
      return;
    }
    axios.get('http://localhost:5000/api/teams/my-team', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => {
        const team = res.data?.team;
        console.log('DEBUG [RegisterTeam]: team =', team);
        const isEventEnded = team && (
          team.eventId?.status === 'completed' || 
          team.eventId?.status === 'cancelled' ||
          (team.eventId?.contestEnd && new Date(team.eventId.contestEnd) <= new Date())
        );
        console.log('DEBUG [RegisterTeam]: isEventEnded =', isEventEnded, 'contestEnd =', team?.eventId?.contestEnd, 'status =', team?.eventId?.status);
        if (team && !isEventEnded) {
          setAlreadyHasTeam(true);
          setExistingTeamName(team.name);
        } else {
          setAlreadyHasTeam(false);
        }
      })
      .catch(_err => {
        setAlreadyHasTeam(false);
      })
      .finally(() => {
        setCheckingTeam(false);
      });
  }, [token]);

  useEffect(() => {
    // Fetch active events
    setLoadingEvents(true);
    axios.get('http://localhost:5000/api/events')
      .then(res => {
        const activeEvents = res.data.filter((e: any) => e.status === 'registration');
        setEvents(activeEvents);
        if (activeEvents.length > 0) {
          const matchedEvent = activeEvents.find((e: any) => e._id === eventIdParam);
          setSelectedEventId(matchedEvent ? matchedEvent._id : activeEvents[0]._id);
        }
      })
      .catch(err => console.error('Error fetching events:', err))
      .finally(() => {
        setLoadingEvents(false);
      });
  }, []);

  useEffect(() => {
    if (!token) return;
    axios.get('http://localhost:5000/api/teams/history', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => {
        setPastTeams(res.data || []);
      })
      .catch(err => console.error('Error fetching past teams:', err));
  }, [token]);

  const handleApplyPastTeam = () => {
    if (!selectedPastTeamId) return;
    const team = pastTeams.find(t => t._id === selectedPastTeamId);
    if (!team) return;

    setOldTeamName(team.name);
    setTeamName('');

    if (team.members && Array.isArray(team.members)) {
      setMembers(team.members.map((m: any) => ({
        email: m.email || '',
        fullName: m.fullName || '',
        githubUsername: m.githubUsername || '',
        studentId: m.studentId || '',
        university: m.university || ''
      })));
    }

    setInfoMessage('Đã tải thành viên từ nhóm cũ. Vui lòng nhập tên mới cho đội thi của bạn.');
    setTimeout(() => setInfoMessage(''), 5000);
  };

  useEffect(() => {
    if (!token) return;
    axios.get('http://localhost:5000/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => {
        const u = res.data.user;
        if (u) {
          setLeaderFullName(u.fullName || '');
          setLeaderStudentId(u.studentId || '');
          setLeaderGithubUsername(u.githubUsername || '');
          const univ = u.university || '';
          if (univ) {
            setLeaderUniversity(univ);
          }
        }
      })
      .catch(err => console.error('Error fetching user profile:', err));
  }, [token]);

  const handleMemberChange = (index: number, field: keyof MemberInput, value: any) => {
    const updated = [...members];
    (updated[index] as any)[field] = value;
    setMembers(updated);
  };

  const addMemberRow = () => {
    setMembers([...members, { 
      email: '', 
      fullName: '', 
      githubUsername: '', 
      studentId: '', 
      university: '', 
      universityCustom: '', 
      isUniversityCustom: false,
      checkingStatus: 'idle',
      checkingMessage: ''
    }]);
  };

  const removeMemberRow = (index: number) => {
    const updated = [...members];
    updated.splice(index, 1);
    setMembers(updated);
  };

  const handleCheckEligibility = async (index: number) => {
    const member = members[index];
    if (!member.email.trim()) {
      toast.warning('Vui lòng nhập email trước khi kiểm tra.');
      return;
    }
    
    const updated = [...members];
    updated[index].checkingStatus = 'checking';
    updated[index].checkingMessage = '';
    setMembers(updated);

    try {
      const res = await axios.get(
        `http://localhost:5000/api/teams/check-eligibility?email=${encodeURIComponent(member.email.trim())}&eventId=${selectedEventId}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      const nextUpdated = [...members];
      if (res.data.eligible) {
        nextUpdated[index].checkingStatus = 'eligible';
        nextUpdated[index].checkingMessage = res.data.message || 'Hợp lệ (Chưa có nhóm)';
        if (res.data.user) {
          const u = res.data.user;
          if (u.fullName) nextUpdated[index].fullName = u.fullName;
          if (u.studentId) nextUpdated[index].studentId = u.studentId;
          if (u.githubUsername) nextUpdated[index].githubUsername = u.githubUsername;
          if (u.university) nextUpdated[index].university = u.university;
        }
      } else {
        nextUpdated[index].checkingStatus = 'conflict';
        nextUpdated[index].checkingMessage = res.data.message || 'Đã có nhóm!';
      }
      setMembers(nextUpdated);
    } catch (err: any) {
      console.error(err);
      const nextUpdated = [...members];
      nextUpdated[index].checkingStatus = 'idle';
      nextUpdated[index].checkingMessage = err.response?.data?.message || 'Lỗi kiểm tra';
      setMembers(nextUpdated);
      toast.error(err.response?.data?.message || 'Lỗi khi kiểm tra email.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    if (!teamName.trim()) {
      setError('Tên nhóm không được để trống.');
      setLoading(false);
      return;
    }

    if (oldTeamName && teamName.trim().toLowerCase() === oldTeamName.toLowerCase()) {
      setError('Vui lòng đặt tên mới cho nhóm (không sử dụng lại tên của nhóm cũ).');
      setLoading(false);
      return;
    }

    try {
      const response = await axios.post(
        'http://localhost:5000/api/teams/register',
        {
          eventId: selectedEventId,
          trackId: undefined,
          teamName: teamName.trim(),
          membersList: members.filter(m => m.email.trim() !== '').map(m => ({
            email: m.email.trim(),
            fullName: m.fullName.trim(),
            githubUsername: m.githubUsername.trim(),
            studentId: m.studentId.trim(),
            university: m.university.trim()
          })),
          leaderInfo: {
            fullName: leaderFullName.trim(),
            studentId: leaderStudentId.trim(),
            githubUsername: leaderGithubUsername.trim(),
            university: leaderUniversity.trim()
          }
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      setSuccess(response.data.message || 'Đăng ký thành công! Vui lòng chờ các thành viên xác nhận email.');
      // Reset form
      setTeamName('');
      setMembers([]);

      setTimeout(() => {
        window.location.href = '/team-area';
      }, 3000);

    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || 'Có lỗi xảy ra trong quá trình đăng ký.');
    } finally {
      setLoading(false);
    }
  };

  if (checkingTeam || loadingEvents) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-24 text-center font-mono">
        <p className="text-slate-400 text-lg animate-pulse">Đang tải thông tin...</p>
      </div>
    );
  }

  if (alreadyHasTeam) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-24 text-center font-mono space-y-6">
        <div className="inline-flex bg-cyan-500/10 p-4 rounded-full text-cyan-400 mb-2 border border-cyan-500/20">
          <Users size={40} />
        </div>
        <h3 className="text-2xl font-bold text-white">Bạn đã tham gia đội thi "{existingTeamName}"</h3>
        <p className="text-slate-400 max-w-md mx-auto text-sm leading-relaxed">
          Hệ thống ghi nhận bạn đã là thành viên chính thức của một đội thi đang hoạt động.
        </p>
        <div>
          <Link
            to="/team-area"
            className="inline-flex items-center justify-center px-6 py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all"
          >
            Vào Khu vực Đội thi
          </Link>
        </div>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 font-mono">
        <div className="flex items-center gap-3 mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-white">
              <span className="text-cyan-400 text-cyan-glow font-mono-tech">ĐĂNG KÝ ĐỘI THI</span>
            </h1>
            <p className="text-slate-400 text-sm mt-1">Thành lập nhóm và mời các thành viên tham gia</p>
          </div>
        </div>
        <div className="glass glow-blue p-8 rounded-3xl text-center mb-8 border-cyan-500/30 font-mono space-y-4">
          <div className="inline-flex bg-cyan-500/10 p-4 rounded-full text-cyan-400 mb-2 border border-cyan-500/20">
            <Calendar size={40} />
          </div>
          <h3 className="text-xl font-bold text-white uppercase tracking-tight text-cyan-glow">
            Hiện đang không có cuộc thi nào mở đăng ký
          </h3>
          <p className="text-slate-400 max-w-md mx-auto text-sm leading-relaxed">
            Vui lòng theo dõi thông tin từ Ban tổ chức để cập nhật các sự kiện Hackathon mới nhất sắp diễn ra.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-12 font-mono">

      <div className="flex items-center gap-3 mb-8">

        <div>
          <h1 className="text-3xl font-extrabold text-white">
            <span className="text-cyan-400 text-cyan-glow font-mono-tech">ĐĂNG KÝ ĐỘI THI</span>
          </h1>
          <p className="text-slate-400 text-sm mt-1">Thành lập nhóm và mời các thành viên tham gia</p>
        </div>
      </div>

      {success ? (
        <div className="glass glow-blue p-8 rounded-3xl text-center mb-8 border-emerald-500/30 font-mono">
          <div className="inline-flex bg-emerald-500/20 p-4 rounded-full text-emerald-400 mb-4 border border-emerald-500/30">
            <CheckCircle size={40} />
          </div>
          <h3 className="text-2xl font-bold text-white mb-2">ĐĂNG KÝ NHÓM THÀNH CÔNG</h3>
          <p className="text-slate-300 max-w-md mx-auto mb-6">{success}</p>
          <div className="inline-flex items-center gap-2 text-sm text-cyan-400 animate-pulse">
            <span>Đang chuyển hướng về Khu vực Đội thi...</span>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-8">

          {/* Step 1: Event & Team Info */}
          <div className="glass p-6 rounded-2xl space-y-6 border border-slate-800 hover:border-cyan-500/30 transition-all">
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2 border-b border-slate-800 pb-3 font-mono-tech">
              <Calendar size={18} className="text-cyan-400" />
              <span className="text-cyan-400">1. THÔNG TIN CHUNG</span>
            </h2>



            <div className="grid grid-cols-1 gap-6">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Lựa chọn Cuộc thi
                </label>
                <CustomSelect
                  value={selectedEventId}
                  onChange={(val: any) => setSelectedEventId(val)}
                  options={events.map((e) => ({
                    value: e._id,
                    label: `${e.name} (${e.semester} ${e.year})`,
                  }))}
                  placeholder="Chọn cuộc thi..."
                  className="w-full font-mono"
                />
              </div>

              {pastTeams.length > 0 && (
                <div className="bg-cyan-500/5 p-4 rounded-xl border border-cyan-500/20 space-y-2">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-cyan-400">
                    Tái sử dụng thông tin đội cũ
                  </label>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <CustomSelect
                      value={selectedPastTeamId}
                      onChange={(val: any) => setSelectedPastTeamId(val)}
                      options={pastTeams.map((t) => ({
                        value: t._id,
                        label: `${t.name} (Sự kiện: ${t.event?.name || "Không rõ"})`,
                      }))}
                      placeholder="Chọn đội cũ..."
                      className="flex-1 font-mono"
                    />
                    <button
                      type="button"
                      onClick={handleApplyPastTeam}
                      disabled={!selectedPastTeamId}
                      className="bg-cyan-500 hover:bg-cyan-600 disabled:bg-slate-800 disabled:text-slate-500 disabled:border-transparent text-slate-950 font-bold px-4 py-2 rounded-lg text-xs transition-all uppercase tracking-wider cursor-pointer border border-cyan-400/30"
                    >
                      Áp dụng
                    </button>
                  </div>
                  {infoMessage && (
                    <p className="text-[10px] text-cyan-400 font-mono italic mt-1">{infoMessage}</p>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Tên Nhóm thi đấu
              </label>
              <input
                type="text"
                required
                placeholder="Nhập tên nhóm của bạn"
                value={teamName}
                onChange={e => setTeamName(e.target.value)}
                className="w-full bg-slate-900/50 border border-slate-800 text-white px-4 py-3 rounded-xl text-sm focus:outline-none focus:border-cyan-500/50 focus:shadow-[0_0_15px_rgba(0,240,255,0.05)] transition-all font-mono"
              />
            </div>
          </div>

          {/* Step 2: Leader Profile Capture */}
          <div className="glass p-6 rounded-2xl space-y-6 border border-slate-800 hover:border-cyan-500/30 transition-all">
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2 border-b border-slate-800 pb-3 font-mono-tech">
              <Users size={18} className="text-cyan-400" />
              <span className="text-cyan-400">2. THÔNG TIN TRƯỞNG NHÓM</span>
            </h2>
            <p className="text-xs text-slate-400">
              * Điền chính xác thông tin cá nhân của bạn. <strong>GitHub Username</strong> bắt buộc đúng để truy cập vào Repository của nhóm.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Họ và Tên
                </label>
                <input
                  type="text"
                  required
                  value={leaderFullName}
                  onChange={e => setLeaderFullName(e.target.value)}
                  className="w-full bg-slate-900/50 border border-slate-800 text-white px-4 py-3 rounded-xl text-sm focus:outline-none focus:border-cyan-500/50 focus:shadow-[0_0_15px_rgba(0,240,255,0.05)] transition-all font-mono"
                  placeholder="Họ và Tên của bạn"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  MSSV (Mã số sinh viên)
                </label>
                <input
                  type="text"
                  required
                  value={leaderStudentId}
                  onChange={e => setLeaderStudentId(e.target.value)}
                  className="w-full bg-slate-900/50 border border-slate-800 text-white px-4 py-3 rounded-xl text-sm focus:outline-none focus:border-cyan-500/50 focus:shadow-[0_0_15px_rgba(0,240,255,0.05)] transition-all font-mono"
                  placeholder="Ví dụ: SE1XXXXX"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  GitHub Username
                </label>
                <input
                  type="text"
                  required
                  value={leaderGithubUsername}
                  onChange={e => setLeaderGithubUsername(e.target.value)}
                  className="w-full bg-slate-900/50 border border-slate-800 text-white px-4 py-3 rounded-xl text-sm focus:outline-none focus:border-cyan-500/50 focus:shadow-[0_0_15px_rgba(0,240,255,0.05)] transition-all font-mono"
                  placeholder="github-username của bạn"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Trường Đại học
                </label>
                <UniversityCombobox
                  value={leaderUniversity}
                  onChange={setLeaderUniversity}
                  placeholder="Nhập hoặc chọn trường..."
                  className="w-full"
                  inputClassName="bg-slate-900/50 border border-slate-800 text-white px-4 py-3 rounded-xl text-sm focus:outline-none focus:border-cyan-500/50 transition-all font-mono"
                />
              </div>
            </div>
          </div>

          {/* Step 3: Member invites */}
          <div className="glass p-6 rounded-2xl space-y-6 border border-slate-800 hover:border-cyan-500/30 transition-all">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2 font-mono-tech">
                <FolderGit2 size={18} className="text-cyan-400" />
                <span className="text-cyan-400">3. THÀNH VIÊN NHÓM</span>
              </h2>
              <button
                type="button"
                onClick={addMemberRow}
                className="flex items-center gap-1 text-xs font-semibold text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10 px-3 py-1.5 rounded-lg border border-cyan-500/20 transition-all cursor-pointer"
              >
                <UserPlus size={14} />
                <span>Thêm thành viên</span>
              </button>
            </div>

            <p className="text-xs text-slate-400">
              * Điền thông tin thành viên dưới đây. Hệ thống sẽ gửi email yêu cầu xác nhận tham gia.
            </p>

            <div className="space-y-4">
              {members.map((member, index) => (
                <div key={index} className="glass-light p-4 rounded-xl border border-slate-800/80 relative">
                  <div className="absolute right-4 top-4">
                    {members.length > 0 && (
                      <button
                        type="button"
                        onClick={() => removeMemberRow(index)}
                        className="text-slate-500 hover:text-rose-400 p-1 rounded-md transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-slate-300">
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-slate-400">Email</label>
                      <div className="flex gap-2">
                        <input
                          type="email"
                          required
                          placeholder="member@student.edu.vn"
                          value={member.email}
                          onChange={e => {
                            handleMemberChange(index, 'email', e.target.value);
                            const updated = [...members];
                            updated[index].checkingStatus = 'idle';
                            updated[index].checkingMessage = '';
                            setMembers(updated);
                          }}
                          className="flex-1 bg-slate-900/50 border border-slate-800 text-white px-3 py-2 rounded-lg text-xs focus:outline-none focus:border-cyan-500/50 transition-all font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => handleCheckEligibility(index)}
                          disabled={member.checkingStatus === 'checking'}
                          className="bg-cyan-500 hover:bg-cyan-600 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-bold px-3 py-2 rounded-lg text-[10px] uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap"
                        >
                          {member.checkingStatus === 'checking' ? 'Đang check...' : 'Kiểm tra'}
                        </button>
                      </div>
                      {member.checkingMessage && (
                        <p className={`text-[10px] font-mono italic mt-1 ${
                          member.checkingStatus === 'eligible' ? 'text-emerald-400' : 
                          member.checkingStatus === 'conflict' ? 'text-rose-400' : 'text-slate-400'
                        }`}>
                          {member.checkingMessage}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">Họ Tên</label>
                      <input
                        type="text"
                        required
                        placeholder="Họ và Tên"
                        value={member.fullName}
                        onChange={e => handleMemberChange(index, 'fullName', e.target.value)}
                        className="w-full bg-slate-900/50 border border-slate-800 text-white px-3 py-2 rounded-lg text-xs focus:outline-none focus:border-cyan-500/50 transition-all font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">GitHub Username</label>
                      <input
                        type="text"
                        required
                        placeholder="github-username"
                        value={member.githubUsername}
                        onChange={e => handleMemberChange(index, 'githubUsername', e.target.value)}
                        className="w-full bg-slate-900/50 border border-slate-800 text-white px-3 py-2 rounded-lg text-xs focus:outline-none focus:border-cyan-500/50 transition-all font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">MSSV (Mã số sinh viên)</label>
                      <input
                        type="text"
                        placeholder="SE18XXXX"
                        value={member.studentId}
                        onChange={e => handleMemberChange(index, 'studentId', e.target.value)}
                        className="w-full bg-slate-900/50 border border-slate-800 text-white px-3 py-2 rounded-lg text-xs focus:outline-none focus:border-cyan-500/50 transition-all font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-slate-400">Trường Đại học</label>
                      <UniversityCombobox
                        value={member.university}
                        onChange={(val) => {
                          const updated = [...members];
                          updated[index].university = val;
                          setMembers(updated);
                        }}
                        placeholder="Nhập hoặc chọn trường..."
                        className="w-full"
                        inputClassName="bg-slate-900/50 border border-slate-800 text-white px-3 py-2 rounded-lg text-xs focus:outline-none focus:border-cyan-500/50 transition-all font-mono"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Submit button */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="btn-primary font-bold text-sm px-12 py-4 uppercase tracking-widest flex items-center gap-2 group"
            >
              {loading ? 'ĐANG GỬI THÔNG TIN...' : 'XÁC NHẬN ĐĂNG KÝ'}
            </button>
          </div>

        </form>
      )}

    </div>
  );
}
