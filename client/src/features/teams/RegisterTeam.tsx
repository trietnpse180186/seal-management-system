import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Users, UserPlus, Trash2, Calendar, FolderGit2, CheckCircle } from 'lucide-react';
import CustomSelect from '../shared/CustomSelect';

interface MemberInput {
  email: string;
  fullName: string;
  githubUsername: string;
  studentId: string;
  university: string;
}

export default function RegisterTeam() {
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
  const [success, _setSuccess] = useState('');
  const setError = (msg: string) => {
    if (msg) toast.error(msg);
  };
  const setSuccess = (msg: string) => {
    _setSuccess(msg);
    if (msg) toast.success(msg);
  };

  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  useEffect(() => {
    // Fetch active events
    axios.get('http://localhost:5000/api/events')
      .then(res => {
        const activeEvents = res.data.filter((e: any) => e.status === 'registration');
        setEvents(activeEvents);
        if (activeEvents.length > 0) {
          setSelectedEventId(activeEvents[0]._id);
        }
      })
      .catch(err => console.error('Error fetching events:', err));
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

    setTeamName(team.name);

    if (team.members && Array.isArray(team.members)) {
      setMembers(team.members.map((m: any) => ({
        email: m.email || '',
        fullName: m.fullName || '',
        githubUsername: m.githubUsername || '',
        studentId: m.studentId || '',
        university: m.university || ''
      })));
    }

    setInfoMessage('Đã điền thông tin nhóm và thành viên từ đội cũ. Bạn có thể tự do chỉnh sửa nếu cần.');
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
          setLeaderUniversity(u.university || '');
        }
      })
      .catch(err => console.error('Error fetching user profile:', err));
  }, [token]);

  const handleMemberChange = (index: number, field: keyof MemberInput, value: string) => {
    const updated = [...members];
    updated[index][field] = value;
    setMembers(updated);
  };

  const addMemberRow = () => {
    setMembers([...members, { email: '', fullName: '', githubUsername: '', studentId: '', university: '' }]);
  };

  const removeMemberRow = (index: number) => {
    const updated = [...members];
    updated.splice(index, 1);
    setMembers(updated);
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

    try {
      const response = await axios.post(
        'http://localhost:5000/api/teams/register',
        {
          eventId: selectedEventId,
          trackId: undefined,
          teamName: teamName.trim(),
          membersList: members.filter(m => m.email.trim() !== ''),
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
        navigate('/team-area');
      }, 3000);

    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || 'Có lỗi xảy ra trong quá trình đăng ký.');
    } finally {
      setLoading(false);
    }
  };

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
                  onChange={(val) => setSelectedEventId(val)}
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
                      onChange={(val) => setSelectedPastTeamId(val)}
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
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Trường Đại học
                </label>
                <input
                  type="text"
                  required
                  value={leaderUniversity}
                  onChange={e => setLeaderUniversity(e.target.value)}
                  className="w-full bg-slate-900/50 border border-slate-800 text-white px-4 py-3 rounded-xl text-sm focus:outline-none focus:border-cyan-500/50 focus:shadow-[0_0_15px_rgba(0,240,255,0.05)] transition-all font-mono"
                  placeholder="Tên trường đại học của bạn"
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
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">Email</label>
                      <input
                        type="email"
                        required
                        placeholder="member@student.edu.vn"
                        value={member.email}
                        onChange={e => handleMemberChange(index, 'email', e.target.value)}
                        className="w-full bg-slate-900/50 border border-slate-800 text-white px-3 py-2 rounded-lg text-xs focus:outline-none focus:border-cyan-500/50 transition-all font-mono"
                      />
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
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">Trường Đại học</label>
                      <input
                        type="text"
                        required
                        placeholder="Tên trường đại học"
                        value={member.university}
                        onChange={e => handleMemberChange(index, 'university', e.target.value)}
                        className="w-full bg-slate-900/50 border border-slate-800 text-white px-3 py-2 rounded-lg text-xs focus:outline-none focus:border-cyan-500/50 transition-all font-mono"
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
