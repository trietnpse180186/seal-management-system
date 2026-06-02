import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Users, UserPlus, Trash2, Calendar, FolderGit2, AlertTriangle, CheckCircle } from 'lucide-react';

interface MemberInput {
  email: string;
  fullName: string;
  githubUsername: string;
  studentId: string;
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

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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
    setMembers([...members, { email: '', fullName: '', githubUsername: '', studentId: '' }]);
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
    <div className="max-w-4xl mx-auto px-4 py-12">
      
      <div className="flex items-center gap-3 mb-8">
        <div className="bg-gradient-premium p-3 rounded-2xl text-white shadow-lg shadow-indigo-500/20">
          <Users size={28} />
        </div>
        <div>
          <h1 className="text-3xl font-extrabold text-white">Đăng ký Đội thi</h1>
          <p className="text-slate-400 text-sm">Thành lập nhóm và mời các thành viên tham gia SEAL Hackathon</p>
        </div>
      </div>

      {success ? (
        <div className="glass glow-blue p-8 rounded-3xl text-center mb-8 border-emerald-500/30">
          <div className="inline-flex bg-emerald-500/20 p-4 rounded-full text-emerald-400 mb-4 border border-emerald-500/30">
            <CheckCircle size={40} />
          </div>
          <h3 className="text-2xl font-bold text-white mb-2">Đăng ký Nhóm Thành công!</h3>
          <p className="text-slate-300 max-w-md mx-auto mb-6">{success}</p>
          <div className="inline-flex items-center gap-2 text-sm text-indigo-400 animate-pulse">
            <span>Đang chuyển hướng về Khu vực Đội thi...</span>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-8">
          
          {/* Step 1: Event & Team Info */}
          <div className="glass p-6 rounded-2xl space-y-6">
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2 border-b border-slate-800 pb-3">
              <Calendar size={18} className="text-indigo-400" />
              <span>1. Thông tin Chung</span>
            </h2>

            {error && (
              <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm px-4 py-3 rounded-xl flex items-center gap-2">
                <AlertTriangle size={18} className="text-rose-400 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Lựa chọn Học kỳ / Cuộc thi
                </label>
                <select
                  value={selectedEventId}
                  onChange={e => setSelectedEventId(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-sm"
                >
                  {events.map(e => (
                    <option key={e._id} value={e._id}>
                      {e.name} ({e.semester} {e.year})
                    </option>
                  ))}
                  {events.length === 0 && <option>Không có cuộc thi nào mở đăng ký</option>}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Bảng đấu / Lĩnh vực chuyên môn
                </label>
                <div className="w-full px-4 py-3 rounded-xl text-sm bg-slate-900/60 border border-slate-800 text-slate-400 font-mono select-none flex items-center gap-1.5">
                  <span>🎲 Tự động phân chia ngẫu nhiên</span>
                </div>
                <p className="text-[10px] text-slate-500 mt-1.5 font-sans">
                  * Ban tổ chức sẽ tự động chia bảng đấu ngẫu nhiên để đảm bảo công bằng sau khi các thành viên xác nhận email.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Tên Nhóm thi đấu
              </label>
              <input
                type="text"
                required
                placeholder="Nhập tên nhóm độc đáo của bạn"
                value={teamName}
                onChange={e => setTeamName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-sm"
              />
            </div>
          </div>

          {/* Step 1.5: Leader Profile Capture */}
          <div className="glass p-6 rounded-2xl space-y-6">
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2 border-b border-slate-800 pb-3">
              <Users size={18} className="text-indigo-400" />
              <span>1.5. Thông tin Trưởng nhóm (Bạn)</span>
            </h2>
            <p className="text-xs text-slate-400">
              * Điền chính xác thông tin cá nhân của bạn. <strong>GitHub Username</strong> bắt buộc phải đúng để hệ thống tự động mời bạn tham gia Repository của nhóm.
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
                  className="w-full px-4 py-3 rounded-xl text-sm"
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
                  className="w-full px-4 py-3 rounded-xl text-sm"
                  placeholder="MSSV (e.g. SE180186)"
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
                  className="w-full px-4 py-3 rounded-xl text-sm"
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
                  className="w-full px-4 py-3 rounded-xl text-sm"
                  placeholder="Tên trường đại học của bạn"
                />
              </div>
            </div>
          </div>

          {/* Step 2: Member invites */}
          <div className="glass p-6 rounded-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <FolderGit2 size={18} className="text-indigo-400" />
                <span>2. Thành viên nhóm</span>
              </h2>
              <button
                type="button"
                onClick={addMemberRow}
                className="flex items-center gap-1 text-xs font-semibold text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 px-3 py-1.5 rounded-lg border border-indigo-500/20 transition-all"
              >
                <UserPlus size={14} />
                <span>Thêm thành viên</span>
              </button>
            </div>

            <p className="text-xs text-slate-400">
              * Bạn (Trưởng nhóm) sẽ tự động được thêm vào danh sách và được xác nhận ngay. Điền email các thành viên còn lại dưới đây. Hệ thống sẽ gửi email yêu cầu xác nhận.
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

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">Email</label>
                      <input
                        type="email"
                        required
                        placeholder="member@student.edu.vn"
                        value={member.email}
                        onChange={e => handleMemberChange(index, 'email', e.target.value)}
                        className="w-full px-3 py-2 rounded-lg text-xs"
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
                        className="w-full px-3 py-2 rounded-lg text-xs"
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
                        className="w-full px-3 py-2 rounded-lg text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1">MSSV (Mã số sinh viên)</label>
                      <input
                        type="text"
                        placeholder="SE18XXXX"
                        value={member.studentId}
                        onChange={e => handleMemberChange(index, 'studentId', e.target.value)}
                        className="w-full px-3 py-2 rounded-lg text-xs"
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
              className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white font-semibold px-8 py-3 rounded-xl shadow-lg shadow-indigo-600/30 transition-all duration-200"
            >
              {loading ? 'Đang gửi thông tin...' : 'Xác nhận Đăng ký'}
            </button>
          </div>

        </form>
      )}

    </div>
  );
}
