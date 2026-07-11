import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { io } from 'socket.io-client';
import { CheckCircle, Clock, FileDiff, BookOpen, Users, MessageSquare, Cpu, Copy, RefreshCw, Crown, Trophy, Edit3, ExternalLink } from 'lucide-react';
import RegisterTeam from './RegisterTeam';
import GithubUserAutocomplete from '../shared/GithubUserAutocomplete';

const Github = ({ size = 20, className = "" }: { size?: number; className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
    <path d="M9 18c-4.51 2-5-2-7-2" />
  </svg>
);

interface SeminarWidgetProps {
  seminar: {
    scheduledAt?: string;
    scheduledEnd?: string;
    meetUrl?: string;
    title?: string;
    description?: string;
    attendanceFormUrl?: string;
  };
}

function SeminarWidget({ seminar }: SeminarWidgetProps) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  if (!seminar || !seminar.scheduledAt) return null;

  const start = new Date(seminar.scheduledAt);
  const end = seminar.scheduledEnd ? new Date(seminar.scheduledEnd) : null;

  const isUpcoming = now < start;
  const isOngoing = now >= start && (!end || now <= end);
  const isEnded = end ? now > end : false;

  const formatTimeStr = (d: Date) => {
    return d.toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const getCountdownText = () => {
    const diff = start.getTime() - now.getTime();
    if (diff <= 0) return '00:00:00';

    const seconds = Math.floor((diff / 1000) % 60);
    const minutes = Math.floor((diff / 1000 / 60) % 60);
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    const pad = (num: number) => num.toString().padStart(2, '0');

    if (days > 0) {
      return `${days} ngày ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    }
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  };

  return (
    <div className={`glass p-6 rounded-3xl border transition-all relative overflow-hidden flex flex-col md:flex-row items-stretch md:items-center justify-between gap-6 ${isOngoing
      ? 'border-cyan-500/40 glow-cyan bg-slate-900/10 shadow-[inset_0_0_20px_rgba(0,240,255,0.02)] animate-pulse'
      : 'border-slate-800 hover:border-cyan-500/30'
      }`}>
      {isOngoing && <div className="absolute inset-0 pointer-events-none laser-scan-effect opacity-10"></div>}

      {/* Left side: Icon, title, description, time */}
      <div className="flex-1 flex flex-col sm:flex-row items-start gap-4">
        <div className={`p-4 rounded-2xl bg-cyan-950/50 border border-cyan-800/30 shrink-0 ${isOngoing ? 'animate-pulse' : ''}`}>
          <BookOpen size={24} className="text-cyan-400" />
        </div>
        <div className="space-y-2 min-w-0 text-left">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] text-cyan-400 font-bold border border-cyan-500/30 px-2 py-0.5 rounded bg-cyan-950/20 tracking-widest uppercase">
              [SEMINAR_HƯỚNG_DẪN]
            </span>
            {isOngoing ? (
              <span className="flex items-center gap-1 text-[9px] font-extrabold px-2.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-450 uppercase tracking-wider animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                Đang diễn ra
              </span>
            ) : isUpcoming ? (
              <span className="text-[9px] font-bold px-2.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400 uppercase tracking-wider">
                Sắp diễn ra
              </span>
            ) : (
              <span className="text-[9px] font-bold px-2.5 py-0.5 rounded bg-slate-950 border border-slate-900 text-slate-650 uppercase tracking-wider">
                Đã kết thúc
              </span>
            )}
          </div>
          <div>
            <h3 className="text-lg font-bold text-white leading-snug">{seminar.title}</h3>
            {seminar.description && (
              <p className="text-xs text-slate-400 mt-1 font-sans leading-relaxed">{seminar.description}</p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-350 font-sans pt-1">
            <span className="flex items-center gap-1.5">
              <Clock size={12} className="text-slate-500" />
              <strong>Lịch:</strong> {formatTimeStr(start)} {end ? ` - ${formatTimeStr(end)}` : ''}
            </span>
          </div>
        </div>
      </div>

      {/* Right side: Countdown or Action button */}
      <div className="w-full md:w-auto flex flex-col justify-center items-center md:items-end gap-3 shrink-0">
        {isUpcoming && (
          <div className="bg-slate-950/60 border border-slate-900 p-3.5 rounded-2xl flex flex-col items-center justify-center min-w-[200px] text-center shadow-inner">
            <span className="text-[8px] text-slate-500 uppercase tracking-wider font-bold">Thời gian đếm ngược</span>
            <div className="text-xl font-black text-cyan-400 font-mono tracking-widest text-cyan-glow mt-0.5">
              {getCountdownText()}
            </div>
          </div>
        )}

        {isOngoing && seminar.meetUrl && (
          <a
            href={seminar.meetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full md:w-auto inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold uppercase py-3.5 px-6 rounded-xl transition-all shadow-lg shadow-emerald-600/20 text-center cursor-pointer hover:-translate-y-0.5 duration-150 whitespace-nowrap font-sans"
          >
            <BookOpen size={16} />
            Tham gia Google Meet
          </a>
        )}

        {isEnded && (
          <div className="text-xs text-slate-500 italic bg-slate-950/30 px-4 py-2 border border-slate-900 rounded-xl text-center">
            Đã kết thúc
          </div>
        )}
      </div>
    </div>
  );
}

export default function TeamArea() {
  const [searchParams] = useSearchParams();
  const eventIdParam = searchParams.get('eventId');
  const token = localStorage.getItem('token');
  const [data, setData] = useState<any>(null);



  const [currentTime, setCurrentTime] = useState(new Date());
  const [syncingMqtt, setSyncingMqtt] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const [showEditModal, setShowEditModal] = useState(false);
  const [savingBasicInfo, setSavingBasicInfo] = useState(false);
  const [editMembers, setEditMembers] = useState<any[]>([]);
  const editMembersRef = useRef<any[]>([]);
  const checkTimers = useRef<{ [key: number]: any }>({});

  useEffect(() => {
    editMembersRef.current = editMembers;
  }, [editMembers]);

  const handleCheckEligibility = async (index: number, emailToCheck?: string) => {
    const targetEmail = emailToCheck !== undefined ? emailToCheck : (editMembersRef.current[index]?.email || '');
    if (!targetEmail.trim()) {
      return;
    }
    const currentEventId = data?.team?.eventId?._id;
    if (!currentEventId) return;

    setEditMembers(prev => {
      if (!prev[index]) return prev;
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        checkingStatus: 'checking',
        checkingMessage: ''
      };
      return updated;
    });

    try {
      const res = await axios.get(
        `http://localhost:5000/api/teams/check-eligibility?email=${encodeURIComponent(targetEmail.trim())}&eventId=${currentEventId}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      setEditMembers(prev => {
        if (!prev[index]) return prev;
        const nextUpdated = [...prev];
        if (nextUpdated[index].email.trim() !== targetEmail.trim()) {
          return prev;
        }

        if (res.data.eligible) {
          nextUpdated[index] = {
            ...nextUpdated[index],
            checkingStatus: 'eligible',
            checkingMessage: res.data.message || 'Hợp lệ (Chưa có nhóm)'
          };
          const u = res.data.user;
          if (u) {
            if (u.fullName) nextUpdated[index].fullName = u.fullName;
            if (u.studentId) nextUpdated[index].studentId = u.studentId;
            if (u.githubUsername) nextUpdated[index].githubUsername = u.githubUsername;
            if (u.university) nextUpdated[index].university = u.university;
          }
        } else {
          nextUpdated[index] = {
            ...nextUpdated[index],
            checkingStatus: 'conflict',
            checkingMessage: res.data.message || 'Đã có nhóm!'
          };
        }
        return nextUpdated;
      });
    } catch (err: any) {
      console.error(err);
      setEditMembers(prev => {
        if (!prev[index]) return prev;
        const nextUpdated = [...prev];
        if (nextUpdated[index].email.trim() !== targetEmail.trim()) {
          return prev;
        }
        nextUpdated[index] = {
          ...nextUpdated[index],
          checkingStatus: 'idle',
          checkingMessage: err.response?.data?.message || 'Lỗi kiểm tra'
        };
        return nextUpdated;
      });
      toast.error(err.response?.data?.message || 'Lỗi khi kiểm tra email.');
    }
  };

  const handleOpenEditModal = () => {
    if (data?.members) {
      setEditMembers(data.members.map((m: any) => ({
        userId: m.userId?._id,
        email: m.userId?.email,
        role: m.role,
        fullName: m.userId?.fullName || '',
        githubUsername: m.userId?.githubUsername || '',
        studentId: m.userId?.studentId || '',
        university: m.userId?.university || ''
      })));
    }
    setShowEditModal(true);
  };



  const track = data?.team?.trackId;
  const round = track?.roundId;
  const showMqttCard = !!(data?.team && data.team.eventId?.status === 'ongoing' && ((round?.startTime && new Date(round.startTime) <= currentTime) || round?.isExamManualOpen) && track?.environmentId);
  const isExamVisible = !!(round?.startTime || round?.isExamManualOpen);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);



  const getRemainingTimeText = (startTimeStr: string) => {
    const diff = new Date(startTimeStr).getTime() - currentTime.getTime();
    if (diff <= 0) return '00:00:00';

    const seconds = Math.floor((diff / 1000) % 60);
    const minutes = Math.floor((diff / 1000 / 60) % 60);
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    const pad = (num: number) => num.toString().padStart(2, '0');

    if (days > 0) {
      return `${days} ngày ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    }
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  };

  const getRoundCountdown = () => {
    const startVal = track?.startTime || round?.startTime;
    const endVal = track?.endTime || round?.endTime;

    if (!startVal || !endVal) {
      return {
        text: "Chưa cấu hình thời gian làm bài",
        color: "text-slate-500"
      };
    }

    const start = new Date(startVal);
    const end = new Date(endVal);

    if (currentTime < start) {
      const diffMs = start.getTime() - currentTime.getTime();
      const seconds = Math.floor((diffMs / 1000) % 60);
      const minutes = Math.floor((diffMs / 1000 / 60) % 60);
      const hours = Math.floor((diffMs / (1000 * 60 * 60)) % 24);
      const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      const pad = (num: number) => num.toString().padStart(2, '0');
      const timeStr = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
      const text = days > 0 ? `Bắt đầu sau: ${days} ngày ${timeStr}` : `Bắt đầu sau: ${timeStr}`;

      return {
        text,
        color: "text-amber-400 font-bold"
      };
    } else if (currentTime >= start && currentTime <= end) {
      const diffMs = end.getTime() - currentTime.getTime();
      const seconds = Math.floor((diffMs / 1000) % 60);
      const minutes = Math.floor((diffMs / 1000 / 60) % 60);
      const hours = Math.floor((diffMs / (1000 * 60 * 60)) % 24);
      const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      const pad = (num: number) => num.toString().padStart(2, '0');
      const timeStr = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
      const text = days > 0 ? `Còn lại: ${days} ngày ${timeStr}` : `Còn lại: ${timeStr}`;

      const isUrgent = diffMs < 1000 * 60 * 60; // < 1 hour
      return {
        text,
        color: isUrgent ? "text-rose-500 animate-pulse font-extrabold" : "text-cyan-400 font-bold"
      };
    } else {
      return {
        text: "Đã hết thời gian làm bài",
        color: "text-slate-500 font-semibold"
      };
    }
  };

  const getTeamStatusText = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'confirmed': return 'ĐÃ XÁC NHẬN';
      case 'pending_confirm': return 'ĐANG CHỜ DUYỆT';
      default: return status?.toUpperCase() || '';
    }
  };


  // Git commits & AI report
  const [commits, setCommits] = useState<any[]>([]);
  const [selectedCommit, setSelectedCommit] = useState<any>(null);



  // Status indicators
  const [loading, setLoading] = useState(true);
  const [error, _setError] = useState('');
  const setError = (msg: string) => {
    _setError(msg);
    if (msg) toast.error(msg);
  };

  const fetchTeamData = async () => {
    try {
      setLoading(true);
      setError('');
      const url = eventIdParam
        ? `http://localhost:5000/api/teams/my-team?eventId=${eventIdParam}`
        : 'http://localhost:5000/api/teams/my-team';
      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const team = res.data?.team;
      console.log('DEBUG [TeamArea]: team =', team);
      const isEventEnded = team && (
        team.eventId?.status === 'completed' ||
        team.eventId?.status === 'cancelled' ||
        (team.eventId?.contestEnd && new Date(team.eventId.contestEnd) <= new Date())
      );
      console.log('DEBUG [TeamArea]: isEventEnded =', isEventEnded, 'contestEnd =', team?.eventId?.contestEnd, 'status =', team?.eventId?.status);
      if (isEventEnded) {
        setData({ team: null });
      } else {
        setData(res.data);




        // Fetch commits if repo exists
        if (res.data.repository) {
          fetchCommits(res.data.team._id);
        }
      }
    } catch (err: any) {
      console.error(err);
      if (err.response?.status === 404) {
        setData({ team: null });
      } else {
        setError(err.response?.data?.message || 'Lỗi tải thông tin đội thi.');
      }
    } finally {
      setLoading(false);
    }
  };



  const fetchCommits = async (teamId: string) => {
    try {
      const res = await axios.get(`http://localhost:5000/api/analytics/team/${teamId}/commits`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCommits(res.data);
      if (res.data.length > 0) {
        handleSelectCommit(res.data[0]);
      }
    } catch (err: any) {
      console.error('Error fetching commits:', err);
    }
  };

  const handleSaveBasicInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data?.team?._id) return;

    setSavingBasicInfo(true);
    try {
      const res = await axios.put(
        `http://localhost:5000/api/teams/${data.team._id}/basic-info`,
        {
          members: editMembers.map(m => ({
            userId: m.userId,
            fullName: m.fullName,
            githubUsername: m.githubUsername,
            studentId: m.studentId || '',
            university: m.university || ''
          }))
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      toast.success(res.data.message || 'Cập nhật thông tin thành công!');
      setShowEditModal(false);
      await fetchTeamData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Lỗi khi cập nhật thông tin.');
    } finally {
      setSavingBasicInfo(false);
    }
  };

  const handleCopy = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
    toast.success(`Đã sao chép ${fieldName}!`);
  };

  const handleSyncMqtt = async () => {
    const team = data?.team;
    if (!team?._id) return;
    setSyncingMqtt(true);
    try {
      const res = await axios.post(`http://localhost:5000/api/teams/${team._id}/sync-mqtt`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(res.data.message || "Đồng bộ MQTT thành công!");
      await fetchTeamData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Lỗi khi đồng bộ MQTT.");
    } finally {
      setSyncingMqtt(false);
    }
  };

  const handleSelectCommit = (commitObj: any) => {
    setSelectedCommit(commitObj);
  };



  useEffect(() => {
    fetchTeamData();
  }, []);

  useEffect(() => {
    const teamId = data?.team?._id;
    if (!token || !teamId) return;

    const socketUrl = import.meta.env.VITE_API_URL || (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' ? window.location.origin : 'http://localhost:5000');
    const socket = io(socketUrl, { query: { token } });

    socket.on('connect', () => {
      console.log('DEBUG [TeamArea] Connected to socket server');
    });

    socket.on('judge_active_toggled', (payload: any) => {
      console.log('DEBUG [TeamArea] judge_active_toggled:', payload);
      if (payload.teamId === teamId) {
        setData((prev: any) => {
          if (!prev || !prev.team) return prev;
          return {
            ...prev,
            team: {
              ...prev.team,
              isJudgeActive: payload.isJudgeActive,
              judgeApiKey: payload.judgeApiKey,
              judgeTopic: payload.judgeTopic
            }
          };
        });

        if (payload.isJudgeActive) {
          toast.info('Môi trường chấm thi đã được kích hoạt! Hãy sao chép API Key và Topic kết nối.');
        } else {
          toast.warning('Môi trường chấm thi đã bị tắt.');
        }
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [token, data?.team?._id]);





  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-24 text-center">
        <p className="text-slate-400 text-lg animate-pulse">Đang tải thông tin đội thi...</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="max-w-md mx-auto px-4 py-24 text-center">
        <div className="glass p-8 rounded-3xl border-rose-500/20">
          <p className="text-rose-400 font-semibold mb-4">{error}</p>
          <button onClick={() => window.location.reload()} className="bg-indigo-600 px-5 py-2.5 rounded-xl text-sm font-semibold">Tải lại</button>
        </div>
      </div>
    );
  }

  const { team, members, repository, isLeader } = data || {};


  const isEventEnded = team && (
    team.eventId?.status === 'completed' ||
    team.eventId?.status === 'cancelled' ||
    (team.eventId?.contestEnd && new Date(team.eventId.contestEnd) <= new Date())
  );

  if (!team || isEventEnded) {
    return <RegisterTeam />;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-12 space-y-8 font-mono">

      {/* Top Banner team details */}
      <div className="glass p-8 rounded-3xl relative overflow-hidden border border-slate-800 hover:border-cyan-500/30 transition-all">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none"></div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">

          {/* Main Info (Col 5): Team name & Status */}
          <div className="lg:col-span-5 space-y-4">
            <div className="flex items-center gap-2.5">
              <span className="text-[10px] text-cyan-400 font-bold border border-cyan-500/30 px-2 py-0.5 rounded bg-cyan-950/20 tracking-widest uppercase">
                [ĐỘI THI]
              </span>
              <span className={`text-[10px] px-2.5 py-0.5 rounded font-extrabold tracking-wider ${team?.status?.toLowerCase() === 'confirmed'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                }`}>
                {getTeamStatusText(team?.status)}
              </span>

            </div>

            <div>
              <h1 className="text-3xl sm:text-4xl font-black text-white uppercase tracking-tight text-cyan-glow">
                Tên đội: {team?.name}
              </h1>
            </div>
          </div>

          {/* Vertical Divider (Hidden on mobile) */}
          <div className="hidden lg:block lg:col-span-1 h-16 border-l border-slate-800/80 mx-auto"></div>

          {/* Contest Metadata (Col 3): Event & Semester */}
          <div className="lg:col-span-3 space-y-3 font-sans">
            <div>
              <span className="text-[9px] text-slate-500 block uppercase font-mono tracking-wider font-bold">CUỘC THI</span>
              <span className="text-xl font-extrabold text-white font-mono uppercase truncate block">
                {team?.eventId?.name || '---'}
              </span>
            </div>
            <div>
              <span className="text-[9px] text-slate-500 block uppercase font-mono tracking-wider font-bold">HỌC KỲ</span>
              <span className="text-xl font-bold text-slate-300 font-mono">
                {team?.eventId?.semester ? `${team.eventId.semester} ${team.eventId.year}` : '---'}
              </span>
            </div>
          </div>

          {/* Track & Size Info (Col 3): Bảng đấu & Thành viên */}
          <div className="lg:col-span-3 space-y-3 font-sans">
            <div>
              <span className="text-[9px] text-slate-500 block uppercase font-mono tracking-wider font-bold">BẢNG ĐẤU</span>
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-cyan-400 bg-cyan-950/40 border border-cyan-800/60 px-3 py-1 rounded-full mt-1">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse"></span>
                {team?.trackId?.name || 'Chờ phân bảng'}
              </span>
            </div>
            <div>
              <span className="text-[9px] text-slate-500 block uppercase font-mono tracking-wider font-bold">THÀNH VIÊN</span>
              <span className="text-xl font-semibold text-slate-300 flex items-center gap-1.5 mt-1 font-mono">
                <Users size={14} className="text-slate-400" />
                <span>{members?.length || 0} Thành viên</span>
              </span>
            </div>
          </div>

        </div>
      </div>

      {/* Active Round Banner */}
      {team?.currentEventRound && (() => {
        const countdown = getRoundCountdown();
        return (
          <div className="glass p-5 rounded-2xl border border-cyan-500/20 bg-gradient-to-r from-cyan-950/40 via-slate-900/40 to-cyan-950/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-[0_0_15px_rgba(6,182,212,0.05)]">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></div>
              <div>
                <span className="text-[10px] text-slate-500 block uppercase font-mono tracking-wider font-bold">Trạng thái giải đấu</span>
                <p className="text-xs sm:text-sm font-bold text-slate-200">
                  Vòng thi hiện tại: <span className="text-cyan-400 font-extrabold uppercase font-mono">{team.currentEventRound}</span>
                </p>
              </div>
            </div>
            {/* Timer section */}
            {countdown && (
              <div className="flex items-center gap-2 bg-slate-950/60 px-4 py-2 rounded-xl border border-slate-800 self-start sm:self-auto">
                <Clock size={14} className="text-cyan-400" />
                <div className="text-xs font-mono">
                  <span className="text-slate-500 uppercase tracking-wider text-[9px] block">Thời gian làm bài</span>
                  <span className={`${countdown.color} font-bold`}>{countdown.text}</span>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Seminar Widget */}
      {team?.eventId?.seminar?.scheduledAt && !isExamVisible && team?.eventId?.status !== 'ongoing' && team?.eventId?.status !== 'completed' && !team?.isEliminated && (
        <SeminarWidget seminar={team.eventId.seminar} />
      )}

      {/* Chat Section */}
      {team && team.eventId?.status === 'ongoing' && !team.isEliminated && (
        <div className="glass p-6 rounded-2xl border border-slate-800 hover:border-cyan-500/30 transition-all mb-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-cyan-950 text-cyan-400 rounded-xl">
              <MessageSquare size={20} />
            </div>
            <div>
              <h3 className="text-white font-bold">Hỗ trợ từ Mentor</h3>
              <p className="text-xs text-slate-400 font-sans">Bạn có câu hỏi hoặc cần sự giúp đỡ? Hãy nhắn tin trao đổi trực tiếp với Mentor hướng dẫn.</p>
            </div>
          </div>
          <button
            onClick={() => {
              window.dispatchEvent(new CustomEvent('open_chat_room', { detail: { teamId: team._id } }));
            }}
            className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold uppercase rounded-xl transition-all shadow-lg shadow-cyan-600/25 whitespace-nowrap cursor-pointer font-sans"
          >
            Nhắn tin ngay
          </button>
        </div>
      )}

      {/* Row 1: Exam, MQTT Connection & Members */}
      {team && !team.isEliminated && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-8">

          {/* Left: Exam & Materials Card */}
          {isExamVisible && (
            <div className={`${showMqttCard ? 'lg:col-span-4' : 'lg:col-span-8'
              } glass p-6 rounded-2xl border border-slate-800 hover:border-cyan-500/30 transition-all relative overflow-hidden`}>
              {(round?.hasExamMaterial && round?.examOpened) || team?.trackId?.examAccess?.examOpened ? (
                <div className="absolute inset-0 pointer-events-none laser-scan-effect opacity-10"></div>
              ) : null}
              <div>
                <div className="flex justify-between items-center border-b border-slate-800 pb-3 mb-5">
                  <h2 className="text-sm font-bold text-white flex items-center gap-2 font-mono-tech">
                    <BookOpen size={18} className="text-cyan-400" />
                    <span className="text-cyan-400">[ĐỀ_BÀI_&amp;_TÀI_LIỆU_THI]</span>
                  </h2>
                  {round && (
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400 font-mono uppercase tracking-wider">
                      Vòng: {round.name}
                    </span>
                  )}
                </div>

                {team?.eventId?.contestStart && new Date(team.eventId.contestStart) > currentTime ? (
                  <div className="flex flex-col items-center justify-center py-6 space-y-4">
                    <div className="space-y-1.5 text-center">
                      <p className="text-xs text-amber-500 font-sans font-semibold uppercase tracking-wider">
                        Đề bài cuộc thi &quot;{team.eventId.name}&quot; sẽ được mở sau:
                      </p>
                      <p className="text-[9px] text-slate-500 font-mono">
                        Thời gian mở đề: {new Date(team.eventId.contestStart).toLocaleString('vi-VN')}
                      </p>
                    </div>
                    <div className="text-2xl sm:text-3xl font-black text-cyan-400 font-mono bg-slate-950/70 px-6 py-3.5 rounded-xl border border-slate-900 tracking-widest text-cyan-glow">
                      {getRemainingTimeText(team.eventId.contestStart)}
                    </div>
                  </div>
                ) : round?.startTime && new Date(round.startTime) > currentTime ? (
                  <div className="flex flex-col items-center justify-center py-6 space-y-4">
                    <div className="space-y-1.5 text-center">
                      <p className="text-xs text-amber-500 font-sans font-semibold uppercase tracking-wider">
                        Đề bài vòng thi &quot;{round.name}&quot; sẽ được mở sau:
                      </p>
                      <p className="text-[9px] text-slate-500 font-mono">
                        Thời gian mở đề: {new Date(round.startTime).toLocaleString('vi-VN')}
                      </p>
                    </div>
                    <div className="text-2xl sm:text-3xl font-black text-cyan-400 font-mono bg-slate-950/70 px-6 py-3.5 rounded-xl border border-slate-900 tracking-widest text-cyan-glow">
                      {getRemainingTimeText(round.startTime)}
                    </div>
                  </div>
                ) : team?.trackId?.examAccess?.examOpened ? (
                  <div className="space-y-6 py-2">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        <p className="text-[10px] font-bold text-emerald-400 uppercase font-mono tracking-wider">ĐỀ BÀI ĐÃ MỞ KHÓA — BẢNG {team.trackId.name?.toUpperCase()}</p>
                      </div>
                      <h3 className="text-sm sm:text-base font-extrabold text-white leading-snug font-sans flex items-center gap-2" title={team.trackId.examAccess.examDriveFileName || `Đề bảng ${team.trackId.name}`}>
                        <BookOpen size={18} className="text-cyan-400 shrink-0" />
                        {team.trackId.examAccess.examDriveFileName || `Đề thi & Tài liệu hướng dẫn — ${team.trackId.name}`}
                      </h3>
                      <p className="text-xs text-slate-400 font-sans leading-relaxed">
                        Tài liệu đề bài, sơ đồ kiến trúc hệ thống và dữ liệu mẫu được lưu trữ trên thư mục Google Drive riêng của bảng {team.trackId.name}. Thí sinh vui lòng tải về để bắt đầu nghiên cứu và thiết lập thiết bị làm bài.
                      </p>
                    </div>

                    <div className="pt-2">
                      <a
                        href={team.trackId.examAccess.examDriveFileUrl || "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold uppercase py-2.5 px-4 rounded-xl transition-all shadow-md shadow-cyan-900/20 text-center cursor-pointer hover:-translate-y-0.5 duration-150 animate-pulse-subtle"
                      >
                        <BookOpen size={14} />
                        Mở đề thi bảng {team.trackId.name}
                      </a>
                    </div>
                  </div>
                ) : team?.trackId?.examAccess?.hasExamMaterial ? (
                  <div className="text-center py-6 text-slate-450 font-sans text-xs">
                    <Clock size={32} className="mx-auto text-amber-500 mb-2 animate-pulse" />
                    <p className="font-semibold text-slate-300">Đề thi đang được chuẩn bị</p>
                    <p className="text-[10px] text-slate-550 mt-1">Đề đã được gắn nhưng chưa đến giờ mở khóa hoặc chưa cấu hình thời gian mở đề.</p>
                  </div>
                ) : (
                  <div className="text-center py-6 text-slate-500 italic font-sans text-xs">
                    <BookOpen size={32} className="mx-auto text-slate-650 mb-2" />
                    <p>Hiện chưa có đề bài hoặc tài liệu thi được phân phối cho vòng này.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Middle: MQTT Connection Card (Col 4) */}
          {showMqttCard && (
            <div className={`${isExamVisible ? 'lg:col-span-4' : 'lg:col-span-6'} glass p-6 rounded-2xl border border-cyan-500/40 glow-cyan transition-all relative overflow-hidden bg-slate-900/10 shadow-[inset_0_0_20px_rgba(0,240,255,0.02)]`}>
              <div className="absolute inset-0 pointer-events-none laser-scan-effect opacity-10"></div>
              <div>
                <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                  <h2 className="text-sm font-bold text-white flex items-center gap-2 font-mono-tech">
                    <Cpu size={16} className="text-cyan-400 animate-pulse" />
                    <span className="text-cyan-400">[MQTT_CREDENTIALS]</span>
                  </h2>
                  <button
                    onClick={handleSyncMqtt}
                    disabled={syncingMqtt}
                    className="text-slate-400 hover:text-cyan-400 disabled:opacity-50 p-1 cursor-pointer transition-colors"
                    title="Lấy Key"
                  >
                    <RefreshCw size={12} className={syncingMqtt ? "animate-spin text-cyan-400" : ""} />
                  </button>
                </div>

                {!team.mqttUsername || !team.testApiKey ? (
                  <div className="text-center py-4 space-y-3">
                    <p className="text-xs text-amber-500 font-sans font-semibold">
                      Khóa kết nối MQTT chưa được đồng bộ từ Simulator.
                    </p>
                    <button
                      onClick={handleSyncMqtt}
                      disabled={syncingMqtt}
                      className="w-full bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold text-xs py-2 rounded-xl uppercase tracking-wider transition-colors cursor-pointer"
                    >
                      {syncingMqtt ? "Đang đồng bộ..." : "Đồng bộ kết nối"}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2.5 text-xs sm:text-[13px] font-mono">
                    {team.isJudgeActive && (
                      <div className="space-y-2 border border-emerald-500/30 bg-emerald-500/5 p-3 rounded-xl animate-pulse">
                        <span className="text-[10px] text-emerald-400 font-bold block uppercase tracking-wider animate-pulse">
                          [MÔI TRƯỜNG CHẤM THI ĐANG BẬT]
                        </span>

                        <div className="space-y-1 bg-slate-950/40 p-2.5 rounded-xl border border-slate-900">
                          <span className="text-[10px] text-emerald-400 font-bold block uppercase tracking-wider">JUDGE API Key</span>
                          <div className="flex justify-between items-center text-emerald-300 font-mono">
                            <span className="truncate max-w-[85%]">{team.judgeApiKey || '---'}</span>
                            <button onClick={() => handleCopy(team.judgeApiKey || "", "JUDGE API Key")} className="text-slate-500 hover:text-emerald-400 cursor-pointer p-1" title="Sao chép JUDGE API Key">
                              {copiedField === "JUDGE API Key" ? <CheckCircle size={13} className="text-emerald-400" /> : <Copy size={13} />}
                            </button>
                          </div>
                        </div>

                        <div className="space-y-1 bg-slate-950/40 p-2.5 rounded-xl border border-slate-900">
                          <span className="text-[10px] text-emerald-400 font-bold block uppercase tracking-wider">JUDGE Topic</span>
                          <div className="flex justify-between items-center text-emerald-300 font-mono">
                            <span className="truncate max-w-[85%]">{team.judgeTopic || '---'}</span>
                            <button onClick={() => handleCopy(team.judgeTopic || "", "JUDGE Topic")} className="text-slate-500 hover:text-emerald-400 cursor-pointer p-1" title="Sao chép JUDGE Topic">
                              {copiedField === "JUDGE Topic" ? <CheckCircle size={13} className="text-emerald-400" /> : <Copy size={13} />}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="space-y-1 bg-slate-950/40 p-2.5 rounded-xl border border-slate-900">
                      <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">Access Code (Simulator)</span>
                      <div className="flex justify-between items-center text-cyan-400 font-bold">
                        <span>{team.accessCode || '---'}</span>
                        <button onClick={() => handleCopy(team.accessCode || "", "Access Code")} className="text-slate-500 hover:text-cyan-400 cursor-pointer p-1" title="Sao chép Access Code">
                          {copiedField === "Access Code" ? <CheckCircle size={13} className="text-emerald-400" /> : <Copy size={13} />}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1 bg-cyan-500/10 p-2.5 rounded-xl border border-cyan-500/35 shadow-[0_0_15px_rgba(6,182,212,0.12)]">
                      <span className="text-[10px] text-cyan-400 font-bold block uppercase tracking-wider">Test Key</span>
                      <div className="flex justify-between items-center text-slate-200 font-semibold">
                        <span className="truncate max-w-[85%]">{team.testApiKey || '---'}</span>
                        <button onClick={() => handleCopy(team.testApiKey || "", "Test Key")} className="text-slate-400 hover:text-cyan-400 cursor-pointer p-1" title="Sao chép Test Key">
                          {copiedField === "Test Key" ? <CheckCircle size={13} className="text-emerald-400" /> : <Copy size={13} />}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1 bg-cyan-500/10 p-2.5 rounded-xl border border-cyan-500/35 shadow-[0_0_15px_rgba(6,182,212,0.12)]">
                      <span className="text-[10px] text-cyan-400 font-bold block uppercase tracking-wider">TEST Topic</span>
                      <div className="flex justify-between items-center text-slate-200 font-semibold">
                        <span className="truncate max-w-[85%]">{team.testTopic || '---'}</span>
                        <button onClick={() => handleCopy(team.testTopic || "", "TEST Topic")} className="text-slate-400 hover:text-cyan-400 cursor-pointer p-1" title="Sao chép TEST Topic">
                          {copiedField === "TEST Topic" ? <CheckCircle size={13} className="text-emerald-400" /> : <Copy size={13} />}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1 bg-slate-950/40 p-2.5 rounded-xl border border-slate-900">
                      <span className="text-[10px] text-slate-550 font-bold block uppercase tracking-wider">Username</span>
                      <div className="flex justify-between items-center text-slate-300">
                        <span>{team.mqttUsername}</span>
                        <button onClick={() => handleCopy(team.mqttUsername, "Username")} className="text-slate-500 hover:text-cyan-400 cursor-pointer p-1">
                          {copiedField === "Username" ? <CheckCircle size={13} className="text-emerald-400" /> : <Copy size={13} />}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1 bg-slate-950/40 p-2.5 rounded-xl border border-slate-900">
                      <span className="text-[10px] text-slate-550 font-bold block uppercase tracking-wider">Password</span>
                      <div className="flex justify-between items-center text-slate-300">
                        <span>••••••••</span>
                        <button onClick={() => handleCopy(team.mqttPassword, "Password")} className="text-slate-500 hover:text-cyan-400 cursor-pointer p-1">
                          {copiedField === "Password" ? <CheckCircle size={13} className="text-emerald-400" /> : <Copy size={13} />}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Right: Members Card (Col 4) */}
          <div className={`${isExamVisible ? 'lg:col-span-4' : showMqttCard ? 'lg:col-span-6' : 'lg:col-span-6'} space-y-6`}>
            <div className="glass p-6 rounded-2xl border border-slate-800 hover:border-cyan-500/30 transition-all text-left">
              <div>
                <h2 className="text-sm font-bold text-white mb-4 flex items-center justify-between font-mono-tech border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Users size={18} className="text-cyan-400" />
                    <span className="text-cyan-400">[THÀNH_VIÊN_NHÓM]</span>
                  </div>
                  {isLeader && (
                    <button
                      onClick={handleOpenEditModal}
                      className="inline-flex items-center gap-1.5 text-[10px] font-bold text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10 px-2.5 py-1 rounded border border-cyan-500/25 transition-all cursor-pointer font-sans uppercase tracking-wider"
                    >
                      <Edit3 size={10} />
                      Sửa thông tin
                    </button>
                  )}
                </h2>
                <div className="space-y-3.5 max-h-[300px] overflow-y-auto pr-1">
                  {members?.map((m: any) => (
                    <div key={m._id} className={`flex items-center justify-between p-3 bg-slate-900/30 rounded-xl border text-xs ${m.role === 'leader' ? 'border-amber-500/30 hover:border-amber-500/50' : 'border-slate-800'
                      }`}>
                      <div className="min-w-0 flex-1 pr-2">
                        <div className="flex items-center gap-1.5">
                          <p className={`font-bold truncate ${m.role === 'leader' ? 'text-amber-400' : 'text-slate-200'}`}>
                            {m.userId?.fullName}
                          </p>
                          {m.role === 'leader' && (
                            <Crown size={12} className="text-amber-400 shrink-0 fill-amber-400/20 animate-pulse" />
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400 truncate">{m.userId?.email}</p>
                        {(m.userId?.studentId || m.userId?.university) && (
                          <p className="text-[10px] text-slate-550 font-mono mt-0.5 truncate">
                            {m.userId?.studentId && `MSSV: ${m.userId.studentId}`}
                            {m.userId?.studentId && m.userId?.university && ' • '}
                            Đại học {m.userId?.university}
                          </p>
                        )}
                      </div>
                      <div className="shrink-0 flex items-center gap-1">
                        {m.confirmStatus === 'confirmed' ? (
                          m.role === 'leader' ? (
                            <span className="flex items-center gap-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-0.5 rounded text-[9px] font-extrabold uppercase">
                              Leader
                            </span>
                          ) : (
                            <span className="flex items-center gap-0.5 bg-emerald-500/10 text-emerald-450 border border-emerald-500/20 px-2.5 py-0.5 rounded text-[9px] font-extrabold uppercase">
                              Member
                            </span>
                          )
                        ) : (
                          <span className="flex items-center gap-0.5 bg-slate-800 text-slate-400 px-2.5 py-0.5 rounded text-[9px] font-bold">
                            <Clock size={8} /> Chờ duyệt
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Zalo Card */}
            {team.eventId?.zaloUrl && (
              <div className="glass p-5 rounded-2xl border border-slate-800 hover:border-cyan-500/30 transition-all relative overflow-hidden shadow-lg text-left">
                <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl pointer-events-none"></div>
                <div className="flex items-start gap-3.5">
                  <div className="p-2.5 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400 shrink-0">
                    <MessageSquare size={20} />
                  </div>
                  <div className="space-y-3 flex-1 min-w-0">
                    <div>
                      <h3 className="text-xs font-bold text-white font-mono uppercase tracking-wide">
                        KÊNH ZALO HỖ TRỢ ĐỘI THI
                      </h3>
                      <p className="text-[10px] text-slate-400 mt-1 leading-relaxed font-sans">
                        Tham gia nhóm Zalo hỗ trợ kỹ thuật và nhận thông báo khẩn cấp từ BTC.
                      </p>
                    </div>
                    <a
                      href={team.eventId.zaloUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-[10px] uppercase rounded-xl transition-all shadow-md shadow-blue-600/10 tracking-wider font-mono cursor-pointer border border-blue-400/20"
                    >
                      <span>Tham gia ngay</span>
                      <ExternalLink size={12} />
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Project Topic Card */}
          <div className={`${
            isExamVisible || showMqttCard ? 'lg:col-span-12' : 'lg:col-span-6'
          } glass p-6 rounded-2xl border border-slate-800 hover:border-cyan-500/30 transition-all`}>
            <div>
              <div className="flex justify-between items-center border-b border-slate-800 pb-3 mb-4">
                <h2 className="text-sm font-bold text-white flex items-center gap-2 font-mono-tech">
                  <FileDiff size={18} className="text-cyan-400" />
                  <span className="text-cyan-400">[ĐỀ_TÀI_DỰ_ÁN]</span>
                </h2>
              </div>
              
              {team.topicSubmission?.title ? (
                <div className="space-y-4 text-xs font-mono">
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">Tên đề tài</span>
                    <p className="text-sm font-bold text-white mt-1">{team.topicSubmission.title}</p>
                  </div>
                  {team.topicSubmission.description && (
                    <div>
                      <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">Mô tả chi tiết</span>
                      <p className="text-slate-300 mt-1 font-sans leading-relaxed text-xs max-h-[100px] overflow-y-auto whitespace-pre-wrap">{team.topicSubmission.description}</p>
                    </div>
                  )}
                  {team.topicSubmission.documentationLink && (
                    <div>
                      <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">Đường dẫn tài liệu</span>
                      <a
                        href={team.topicSubmission.documentationLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-cyan-400 hover:underline mt-1 block truncate font-sans"
                      >
                        {team.topicSubmission.documentationLink}
                      </a>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500 italic font-sans text-xs">
                  <FileDiff size={32} className="mx-auto text-slate-650 mb-2" />
                  <p>Chưa đăng ký đề tài dự án.</p>
                </div>
              )}
            </div>
          </div>

        </div>
      )}

      {isExamVisible && !team?.isEliminated && (
        <div className="w-full space-y-8 mt-8">

          {/* GitHub Integration & AI Commit Reviews */}
          {repository ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

              {/* Commits List Column */}
              <div className="md:col-span-1 glass p-5 rounded-2xl space-y-4 border border-slate-800">
                <h3 className="text-sm font-bold text-slate-200 flex items-center gap-1.5 font-mono-tech">
                  <Github size={16} className="text-cyan-400" />
                  <span className="text-cyan-400">[COMMITS_({commits.length})]</span>
                </h3>

                <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
                  {commits.map((c: any) => (
                    <button
                      key={c._id}
                      onClick={() => handleSelectCommit(c)}
                      className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer ${selectedCommit?._id === c._id
                        ? 'bg-cyan-600/20 border-cyan-500 text-white'
                        : 'border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                    >
                      <p className="text-xs font-bold truncate">{c.message}</p>
                      <div className="flex justify-between items-center mt-1.5 text-[9px] text-slate-400">
                        <span>@{c.authorGithubUsername || 'dev'}</span>
                        <span>{new Date(c.committedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </button>
                  ))}
                  {commits.length === 0 && (
                    <p className="text-xs text-slate-500 italic text-center py-6">
                      Chưa crawl được commit nào. Commit sẽ được đồng bộ mỗi {team?.eventId?.commitSyncInterval || 30} phút.
                    </p>
                  )}
                </div>
              </div>

              {/* Commit Details & Gemini AI Analysis */}
              <div className="md:col-span-2 glass p-6 rounded-2xl space-y-6">

                {selectedCommit ? (
                  <div className="space-y-6">

                    {/* Commit Basic Detail */}
                    <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 space-y-2">
                      <div className="flex justify-between items-center text-[10px] text-cyan-400 font-bold font-mono-tech">
                        <span>SHA: {selectedCommit.commitSha.substring(0, 8)}</span>
                        <span>{new Date(selectedCommit.committedAt).toLocaleString()}</span>
                      </div>
                      <h4 className="text-sm font-bold text-white">{selectedCommit.message}</h4>
                      <p className="text-xs text-slate-400">Tác giả: <span className="text-slate-300 font-semibold">{selectedCommit.authorName} (@{selectedCommit.authorGithubUsername})</span></p>
                      <div className="flex gap-3 text-[10px] pt-1">
                        <span className="text-emerald-400">+{selectedCommit.additions} dòng</span>
                        <span className="text-rose-400">-{selectedCommit.deletions} dòng</span>
                        <span className="text-slate-400">{selectedCommit.changedFilesCount} tệp</span>
                      </div>
                    </div>


                  </div>
                ) : (
                  <div className="text-center text-slate-500 py-16">
                    <FileDiff size={32} className="mx-auto text-slate-700 mb-2" />
                    <p className="text-xs">Chưa có thông tin chi tiết</p>
                  </div>
                )}

              </div>

            </div>
          ) : (
            <div className="glass p-8 text-center text-slate-400 flex flex-col items-center justify-center min-h-[300px]">
              <Github size={48} className="text-slate-600 mb-3" />
              <p className="font-semibold text-lg">Chưa thiết lập GitHub Repository</p>
              <p className="text-sm text-slate-500 max-w-sm mt-1">Đường dẫn repository sẽ tự động được tạo và phân quyền sau khi tất cả các thành viên xác nhận tham gia nhóm qua link email.</p>
            </div>
          )}

        </div>
      )}

      {team?.isEliminated && (
        <div className="glass p-8 rounded-3xl border border-cyan-500/20 bg-gradient-to-br from-cyan-950/20 via-slate-900/60 to-slate-950/30 text-center space-y-6 max-w-2xl mx-auto shadow-[0_0_30px_rgba(6,182,212,0.05)] mt-4">
          <div className="w-16 h-16 rounded-full bg-cyan-950/80 border border-cyan-500/30 text-cyan-400 flex items-center justify-center mx-auto shadow-[0_0_15px_rgba(34,211,238,0.2)]">
            <Trophy size={28} />
          </div>

          <div className="space-y-2 font-sans">
            <h2 className="text-xl font-black text-white uppercase tracking-wider font-mono-tech">
              Kết Quả Đạt Được
            </h2>
            <p className="text-xs text-slate-400">
              Thành tích chính thức của đội thi <strong className="text-slate-200">{team.name}</strong> ghi nhận tại cuộc thi.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 max-w-md mx-auto pt-2">
            <div className="p-4 bg-slate-950/40 border border-slate-850 rounded-2xl space-y-1">
              <span className="text-[10px] text-slate-500 block uppercase font-mono tracking-wider font-bold">Thứ hạng (Bảng)</span>
              <p className="text-2xl font-black text-cyan-400 font-mono text-cyan-glow">
                {team.achievedResult?.rank ? `Top ${team.achievedResult.rank}` : '---'}
              </p>
            </div>
            <div className="p-4 bg-slate-950/40 border border-slate-850 rounded-2xl space-y-1">
              <span className="text-[10px] text-slate-500 block uppercase font-mono tracking-wider font-bold">Điểm trung bình</span>
              <p className="text-2xl font-black text-emerald-400 font-mono text-cyan-glow">
                {team.achievedResult?.score ? `${team.achievedResult.score.toFixed(2)}` : '---'}
              </p>
            </div>
          </div>

          {team.achievedResult && (
            <div className="text-[11px] text-slate-550 font-mono pt-2 border-t border-slate-850/60 max-w-sm mx-auto">
              <span>Ghi nhận tại: {team.achievedResult.roundName} ({team.achievedResult.trackName})</span>
            </div>
          )}

          <p className="text-xs text-slate-400 leading-relaxed font-sans max-w-md mx-auto pt-2">
            Cảm ơn bạn đã cống hiến hết mình tại giải đấu năm nay! Chúc đội thi <strong className="text-slate-200">{team.name}</strong> gặt hái được nhiều thành công hơn nữa trên con đường phát triển công nghệ sắp tới.
          </p>
        </div>
      )}

      {/* Edit Basic Info Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-fade-in animate-duration-150">
          <div className="glass max-w-2xl w-full rounded-3xl border border-slate-800 p-6 md:p-8 space-y-6 relative overflow-hidden shadow-2xl">
            <form onSubmit={handleSaveBasicInfo} className="space-y-4 font-sans text-xs">
              <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1">
                {editMembers.map((member, index) => (
                  <div key={member.userId || `new-${index}`} className="border border-slate-850 p-4 rounded-xl bg-slate-900/10 space-y-3 relative text-left">
                    <div className="absolute top-3 right-4 flex items-center gap-2">
                      {member.role === 'leader' ? (
                        <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-0.5 rounded text-[8px] font-extrabold uppercase font-mono tracking-wider">
                          Trưởng nhóm
                        </span>
                      ) : (
                        <span className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-2.5 py-0.5 rounded text-[8px] font-extrabold uppercase font-mono tracking-wider">
                          Thành viên
                        </span>
                      )}
                      {member.isNew && (
                        <button
                          type="button"
                          onClick={() => {
                            const updated = editMembers.filter((_, idx) => idx !== index);
                            setEditMembers(updated);
                          }}
                          className="text-rose-500 hover:text-rose-400 text-[8px] font-bold cursor-pointer font-mono border border-rose-500/20 bg-rose-500/10 px-2 py-0.5 rounded"
                        >
                          XÓA
                        </button>
                      )}
                    </div>

                    <div className="text-[10px] font-bold text-slate-350 font-mono flex items-center gap-1.5 border-b border-slate-850 pb-2 mb-2 uppercase">
                      <span className="text-cyan-400">{`[THÀNH VIÊN #${index + 1}]`}</span>
                      {!member.isNew && <span className="text-slate-500">{member.email}</span>}
                      {member.isNew && <span className="text-emerald-400 font-extrabold">[MỚI]</span>}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      {/* Email (Only for new members) */}
                      {member.isNew && (
                        <div className="space-y-1 md:col-span-2">
                          <label className="block text-slate-450 font-semibold uppercase tracking-wider text-[9px]">
                            Địa Chỉ Email <span className="text-rose-500">*</span>
                          </label>
                          <div className="relative flex items-center">
                            <input
                              type="email"
                              required
                              placeholder="nhap-email-thanh-vien@fe.edu.vn"
                              value={member.email}
                              onChange={(e) => {
                                const val = e.target.value;
                                setEditMembers(prev => {
                                  if (!prev[index]) return prev;
                                  const updated = [...prev];
                                  updated[index] = {
                                    ...updated[index],
                                    email: val,
                                    checkingStatus: 'idle',
                                    checkingMessage: ''
                                  };
                                  return updated;
                                });

                                if (checkTimers.current[index]) {
                                  clearTimeout(checkTimers.current[index]);
                                }

                                const trimmed = val.trim();
                                if (!trimmed) return;

                                checkTimers.current[index] = setTimeout(() => {
                                  const currentEmail = editMembersRef.current[index]?.email || '';
                                  if (currentEmail.trim() === trimmed) {
                                    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                                    if (emailRegex.test(trimmed)) {
                                      handleCheckEligibility(index, trimmed);
                                    }
                                  }
                                }, 800);
                              }}
                              onBlur={() => {
                                const trimmed = member.email.trim();
                                if (!trimmed) return;

                                if (checkTimers.current[index]) {
                                  clearTimeout(checkTimers.current[index]);
                                }

                                if (member.checkingStatus === 'idle' || !member.checkingStatus) {
                                  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                                  if (emailRegex.test(trimmed)) {
                                    handleCheckEligibility(index, trimmed);
                                  }
                                }
                              }}
                              className="w-full bg-slate-955 border border-slate-800 text-slate-200 pl-3.5 pr-20 py-2.5 rounded-xl focus:outline-none focus:border-cyan-500/50 transition-all font-mono"
                            />
                            {member.checkingStatus === 'checking' && (
                              <span className="absolute right-3.5 text-[10px] text-cyan-400 font-mono animate-pulse select-none">
                                Đang check...
                              </span>
                            )}
                          </div>
                          {member.checkingMessage && (
                            <p className={`text-[9px] font-mono italic mt-1 ${
                              member.checkingStatus === 'eligible' ? 'text-emerald-400' :
                              member.checkingStatus === 'conflict' ? 'text-rose-400' : 'text-slate-400'
                            }`}>
                              {member.checkingMessage}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Full Name */}
                      <div className="space-y-1">
                        <label className="block text-slate-455 font-semibold uppercase tracking-wider text-[9px]">
                          Họ Tên <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={member.fullName}
                          onChange={(e) => {
                            const updated = [...editMembers];
                            updated[index].fullName = e.target.value;
                            setEditMembers(updated);
                          }}
                          className="w-full bg-slate-955 border border-slate-800 text-slate-200 px-3.5 py-2.5 rounded-xl focus:outline-none focus:border-cyan-500/50 transition-all font-mono"
                        />
                      </div>

                      {/* GitHub Username */}
                      <div className="space-y-1">
                        <label className="block text-slate-455 font-semibold uppercase tracking-wider text-[9px]">
                          GitHub Username <span className="text-rose-500">*</span>
                        </label>
                        <GithubUserAutocomplete
                          value={member.githubUsername}
                          onChange={(val) => {
                            const updated = [...editMembers];
                            updated[index].githubUsername = val;
                            setEditMembers(updated);
                          }}
                          placeholder="nhập github-username"
                          className="bg-slate-955 border border-slate-800 text-slate-200 px-3.5 py-2.5 rounded-xl focus:outline-none focus:border-cyan-500/50 transition-all font-mono"
                        />
                      </div>

                      {/* Student ID */}
                      <div className="space-y-1">
                        <label className="block text-slate-455 font-semibold uppercase tracking-wider text-[9px]">
                          MSSV (Mã số sinh viên)
                        </label>
                        <input
                          type="text"
                          value={member.studentId}
                          onChange={(e) => {
                            const updated = [...editMembers];
                            updated[index].studentId = e.target.value;
                            setEditMembers(updated);
                          }}
                          className="w-full bg-slate-955 border border-slate-800 text-slate-200 px-3.5 py-2.5 rounded-xl focus:outline-none focus:border-cyan-500/50 transition-all font-mono"
                        />
                      </div>

                      {/* University */}
                      <div className="space-y-1">
                        <label className="block text-slate-455 font-semibold uppercase tracking-wider text-[9px]">
                          Trường Đại Học
                        </label>
                        <input
                          type="text"
                          value={member.university}
                          onChange={(e) => {
                            const updated = [...editMembers];
                            updated[index].university = e.target.value;
                            setEditMembers(updated);
                          }}
                          className="w-full bg-slate-955 border border-slate-800 text-slate-200 px-3.5 py-2.5 rounded-xl focus:outline-none focus:border-cyan-500/50 transition-all font-mono"
                        />
                      </div>
                    </div>
                  </div>
                ))}

                {/* Add member button */}
                {editMembers.length < 5 && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditMembers([
                        ...editMembers,
                        {
                          isNew: true,
                          email: '',
                          fullName: '',
                          githubUsername: '',
                          studentId: '',
                          university: ''
                        }
                      ]);
                    }}
                    className="w-full py-3 border-2 border-dashed border-slate-800 hover:border-cyan-500/50 rounded-xl text-slate-400 hover:text-cyan-400 text-xs font-bold font-mono transition-all flex items-center justify-center gap-1.5 cursor-pointer uppercase"
                  >
                    + Thêm thành viên mới
                  </button>
                )}
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-350 text-xs font-bold uppercase rounded-xl transition-all cursor-pointer font-sans"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={savingBasicInfo}
                  className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-bold uppercase rounded-xl transition-all shadow-lg shadow-cyan-600/25 cursor-pointer font-sans"
                >
                  {savingBasicInfo ? 'Đang lưu...' : 'Lưu thay đổi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
