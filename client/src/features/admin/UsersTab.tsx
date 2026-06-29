import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Users, UserPlus, Lock, Search, Trash2, Edit2, CheckCircle, Briefcase, UserCheck } from 'lucide-react';
import { toast } from 'sonner';

interface UsersTabProps {
  token: string | null;
}

export const UsersTab: React.FC<UsersTabProps> = ({ token }) => {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  // Form state for creation / editing
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [provisionResult, setProvisionResult] = useState<any | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
    studentId: '',
    university: 'FPT University',
    isCoordinator: false,
    isJudge: false,
    isMentor: false,
    isActive: true,
  });

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`http://localhost:5000/api/auth/users?search=${encodeURIComponent(search)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Filter out any admin users just in case
      setUsers(res.data.filter((u: any) => !u.isSystemAdmin));
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Lỗi khi tải danh sách người dùng.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchUsers();
    }
  }, [token, search]);

  const handleOpenCreateModal = () => {
    setEditingUser(null);
    setFormData({
      email: '',
      password: '',
      fullName: '',
      studentId: '',
      university: 'FPT University',
      isCoordinator: false,
      isJudge: false,
      isMentor: false,
      isActive: true,
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (user: any) => {
    const isCoord = user.roles?.some((r: any) => r.role === 'coordinator');
    const isJudge = user.roles?.some((r: any) => r.role === 'judge');
    const isMentor = user.roles?.some((r: any) => r.role === 'mentor');
    setEditingUser(user);
    setFormData({
      email: user.email,
      password: '',
      fullName: user.fullName || '',
      studentId: user.studentId || '',
      university: user.university || 'FPT University',
      isCoordinator: !!isCoord,
      isJudge: !!isJudge,
      isMentor: !!isMentor,
      isActive: user.isActive !== undefined ? !!user.isActive : true,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingUser) {
        // Update basic User info
        await axios.put(`http://localhost:5000/api/auth/users/${editingUser._id}`, {
          fullName: formData.fullName,
          studentId: formData.studentId,
          university: formData.university,
          password: formData.password || undefined,
          isActive: formData.isActive,
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });

        const isCurrentlyCoord = editingUser.roles?.some((r: any) => r.role === 'coordinator');
        if (formData.isCoordinator !== isCurrentlyCoord) {
          await axios.post(`http://localhost:5000/api/auth/users/${editingUser._id}/toggle-coordinator`, {}, {
            headers: { Authorization: `Bearer ${token}` }
          });
        }

        const isCurrentlyJudge = editingUser.roles?.some((r: any) => r.role === 'judge');
        if (formData.isJudge !== isCurrentlyJudge) {
          await axios.post(`http://localhost:5000/api/auth/users/${editingUser._id}/toggle-judge`, {}, {
            headers: { Authorization: `Bearer ${token}` }
          });
        }

        const isCurrentlyMentor = editingUser.roles?.some((r: any) => r.role === 'mentor');
        if (formData.isMentor !== isCurrentlyMentor) {
          await axios.post(`http://localhost:5000/api/auth/users/${editingUser._id}/toggle-mentor`, {}, {
            headers: { Authorization: `Bearer ${token}` }
          });
        }

        toast.success('Cập nhật thông tin tài khoản thành công!');
      } else {
        // Create User
        const res = await axios.post(`http://localhost:5000/api/auth/users`, {
          email: formData.email,
          password: formData.password,
          fullName: formData.fullName,
          studentId: formData.studentId,
          university: formData.university,
          isActive: formData.isActive,
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });

        const newUserId = res.data.user?._id || res.data._id;
        if (newUserId) {
          if (formData.isCoordinator) {
            await axios.post(`http://localhost:5000/api/auth/users/${newUserId}/toggle-coordinator`, {}, {
              headers: { Authorization: `Bearer ${token}` }
            });
          }
          if (formData.isJudge) {
            await axios.post(`http://localhost:5000/api/auth/users/${newUserId}/toggle-judge`, {}, {
              headers: { Authorization: `Bearer ${token}` }
            });
          }
          if (formData.isMentor) {
            await axios.post(`http://localhost:5000/api/auth/users/${newUserId}/toggle-mentor`, {}, {
              headers: { Authorization: `Bearer ${token}` }
            });
          }
        }

        toast.success('Tạo tài khoản thành công!');
      }
      setIsModalOpen(false);
      fetchUsers();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Lỗi khi lưu thông tin người dùng.');
    }
  };

  const handleToggleCoordinator = async (user: any) => {
    try {
      const res = await axios.post(`http://localhost:5000/api/auth/users/${user._id}/toggle-coordinator`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(res.data.message);
      fetchUsers();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Lỗi khi cập nhật quyền Ban tổ chức.');
    }
  };

  const handleToggleJudge = async (user: any) => {
    try {
      const res = await axios.post(`http://localhost:5000/api/auth/users/${user._id}/toggle-judge`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(res.data.message);
      fetchUsers();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Lỗi khi cập nhật quyền Giám khảo.');
    }
  };

  const handleToggleMentor = async (user: any) => {
    try {
      const res = await axios.post(`http://localhost:5000/api/auth/users/${user._id}/toggle-mentor`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(res.data.message);
      fetchUsers();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Lỗi khi cập nhật quyền Mentor.');
    }
  };

  const handleAutoProvision = async () => {
    setLoading(true);
    try {
      const res = await axios.post(`http://localhost:5000/api/auth/users/auto-provision`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProvisionResult(res.data);
      fetchUsers();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Lỗi khi cấp tài khoản tự động.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (user: any) => {
    try {
      await axios.put(`http://localhost:5000/api/auth/users/${user._id}`, {
        isActive: !user.isActive
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(user.isActive ? 'Đã khóa tài khoản.' : 'Đã mở khóa tài khoản!');
      fetchUsers();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Lỗi cập nhật trạng thái.');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa tài khoản người dùng này? Thao tác không thể hoàn tác!')) return;
    try {
      const res = await axios.delete(`http://localhost:5000/api/auth/users/${userId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(res.data.message || 'Đã xóa người dùng.');
      fetchUsers();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Lỗi khi xóa người dùng.');
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/60 border border-slate-800/80 p-5 rounded-2xl backdrop-blur-md">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2 font-mono">
            <Users className="text-cyan-400" size={24} />
            <span>Quản lý Tài khoản & Phân Quyền Vai Trò</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Quản lý danh sách người dùng, cấp nhanh hoặc tùy chỉnh vai trò Ban tổ chức, Giám khảo và Mentor.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <input
              type="text"
              placeholder="Tìm theo tên, email, MSSV..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 w-56 transition-all font-mono"
            />
          </div>

          <button
            onClick={handleAutoProvision}
            disabled={loading}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white px-4 py-2 rounded-xl text-xs font-bold font-mono flex items-center gap-2 shadow-lg shadow-indigo-500/20 transition-all cursor-pointer shrink-0"
            title="Tự động cấp nhanh 1 tài khoản Judge và 1 tài khoản Mentor"
          >
            <UserCheck size={16} />
            Cấp Nhanh Judge & Mentor
          </button>

          <button
            onClick={handleOpenCreateModal}
            className="bg-cyan-500 hover:bg-cyan-400 text-white px-4 py-2 rounded-xl text-xs font-bold font-mono flex items-center gap-2 shadow-lg shadow-cyan-500/20 transition-all cursor-pointer shrink-0"
          >
            <UserPlus size={16} />
            Thêm Tài Khoản Mới
          </button>
        </div>
      </div>

      {/* Auto-provision Result Banner */}
      {provisionResult && (
        <div className="bg-indigo-500/10 border border-indigo-500/30 p-5 rounded-2xl relative overflow-hidden backdrop-blur-md">
          <div className="flex justify-between items-start mb-3">
            <h3 className="text-sm font-bold text-white font-mono flex items-center gap-2">
              <UserCheck size={18} className="text-indigo-400 animate-bounce" />
              <span>Đã cấp tài khoản Judge & Mentor thành công!</span>
            </h3>
            <button
              onClick={() => setProvisionResult(null)}
              className="text-slate-400 hover:text-slate-200 text-xs font-bold font-mono border border-slate-700 px-2 py-0.5 rounded hover:bg-slate-800 transition-all cursor-pointer"
            >
              Đóng [X]
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
            <div className="p-3 bg-slate-950/60 border border-slate-850 rounded-xl space-y-1">
              <p className="font-bold text-indigo-400 uppercase tracking-wider text-[10px]">Tài khoản Giám khảo (Judge)</p>
              <p><span className="text-slate-500">Email:</span> <span className="text-slate-200 select-all font-semibold">{provisionResult.judge?.email}</span></p>
              <p><span className="text-slate-500">Mật khẩu:</span> <span className="text-slate-200 select-all font-semibold">{provisionResult.judge?.password}</span></p>
            </div>
            <div className="p-3 bg-slate-950/60 border border-slate-850 rounded-xl space-y-1">
              <p className="font-bold text-emerald-400 uppercase tracking-wider text-[10px]">Tài khoản Mentor</p>
              <p><span className="text-slate-500">Email:</span> <span className="text-slate-200 select-all font-semibold">{provisionResult.mentor?.email}</span></p>
              <p><span className="text-slate-500">Mật khẩu:</span> <span className="text-slate-200 select-all font-semibold">{provisionResult.mentor?.password}</span></p>
            </div>
          </div>
        </div>
      )}

      {/* Users Table */}
      <div className="glass rounded-2xl border border-slate-800/80 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase font-mono text-[11px]">
              <tr>
                <th className="p-4">Người Dùng</th>
                <th className="p-4">MSSV / Trường</th>
                <th className="p-4">Vai Trò & Quyền Hạn</th>
                <th className="p-4">Trạng Thái Tài Khoản</th>
                <th className="p-4 text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500 font-mono">
                    Đang tải danh sách người dùng...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500 font-mono">
                    Không có người dùng nào.
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  const isCoord = u.roles?.some((r: any) => r.role === 'coordinator');
                  const isJudge = u.roles?.some((r: any) => r.role === 'judge');
                  const isMentor = u.roles?.some((r: any) => r.role === 'mentor');

                  return (
                    <tr key={u._id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center font-bold text-white text-sm shadow-md shrink-0">
                            {u.fullName ? u.fullName.charAt(0).toUpperCase() : 'U'}
                          </div>
                          <div>
                            <div className="font-bold text-white flex items-center gap-1.5">
                              {u.fullName}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono">{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 font-mono">
                        <div className="text-slate-200">{u.studentId || 'N/A'}</div>
                        <div className="text-[10px] text-slate-400">{u.university || 'FPT University'}</div>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => handleToggleCoordinator(u)}
                            className={`text-[10px] font-mono font-bold px-2.5 py-1.5 rounded-xl border flex items-center gap-1 transition-all cursor-pointer shadow-sm ${
                              isCoord
                                ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/25 shadow-cyan-500/10'
                                : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300 hover:border-slate-700'
                            }`}
                            title="Bật/tắt vai trò Ban tổ chức (Coordinator)"
                          >
                            <Briefcase size={12} />
                            <span>BTC</span>
                          </button>
                          
                          <button
                            onClick={() => handleToggleJudge(u)}
                            className={`text-[10px] font-mono font-bold px-2.5 py-1.5 rounded-xl border flex items-center gap-1 transition-all cursor-pointer shadow-sm ${
                              isJudge
                                ? 'bg-indigo-500/15 border-indigo-500/40 text-indigo-300 hover:bg-indigo-500/25 shadow-indigo-500/10'
                                : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300 hover:border-slate-700'
                            }`}
                            title="Bật/tắt vai trò Giám khảo (Judge)"
                          >
                            <UserCheck size={12} />
                            <span>Giám khảo</span>
                          </button>

                          <button
                            onClick={() => handleToggleMentor(u)}
                            className={`text-[10px] font-mono font-bold px-2.5 py-1.5 rounded-xl border flex items-center gap-1 transition-all cursor-pointer shadow-sm ${
                              isMentor
                                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25 shadow-emerald-500/10'
                                : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300 hover:border-slate-700'
                            }`}
                            title="Bật/tắt vai trò Mentor"
                          >
                            <Users size={12} />
                            <span>Mentor</span>
                          </button>
                        </div>
                      </td>
                      <td className="p-4">
                        <button
                          onClick={() => handleToggleActive(u)}
                          className={`text-[10px] font-mono font-bold px-3 py-1 rounded-lg border flex items-center gap-1.5 transition-all cursor-pointer ${
                            u.isActive
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                              : 'bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20'
                          }`}
                        >
                          {u.isActive ? <CheckCircle size={12} /> : <Lock size={12} />}
                          {u.isActive ? 'Hoạt Động' : 'Đã Khóa'}
                        </button>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenEditModal(u)}
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors cursor-pointer"
                            title="Sửa thông tin"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteUser(u._id)}
                            className="p-1.5 bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 hover:text-rose-200 border border-rose-800/40 rounded-lg transition-colors cursor-pointer"
                            title="Xóa tài khoản"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200 font-sans">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white font-mono flex items-center gap-2">
                {editingUser ? <Edit2 className="text-cyan-400" size={18} /> : <UserPlus className="text-cyan-400" size={18} />}
                <span>{editingUser ? 'Chỉnh Sửa Tài Khoản' : 'Thêm Tài Khoản Mới'}</span>
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer text-sm font-mono"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-300 mb-1">Email <span className="text-rose-500">*</span></label>
                <input
                  type="email"
                  required
                  disabled={!!editingUser}
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white disabled:opacity-50 focus:outline-none focus:border-cyan-500 font-mono"
                  placeholder="user@example.com"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">
                  Mật khẩu {editingUser && <span className="text-slate-500 font-normal">(Để trống nếu không đổi)</span>} {!editingUser && <span className="text-rose-500">*</span>}
                </label>
                <input
                  type="password"
                  required={!editingUser}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-500 font-mono"
                  placeholder="••••••••"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 mb-1">Họ và Tên <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  required
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-500 font-sans"
                  placeholder="Nguyễn Văn A"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Mã Số Sinh Viên (MSSV)</label>
                  <input
                    type="text"
                    value={formData.studentId}
                    onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-500 font-mono"
                    placeholder="SE180000"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-300 mb-1">Trường Học</label>
                  <input
                    type="text"
                    value={formData.university}
                    onChange={(e) => setFormData({ ...formData, university: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-500 font-sans"
                    placeholder="FPT University"
                  />
                </div>
              </div>

              <div className="pt-2 space-y-2 border-t border-slate-800">
                <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                  <input
                    type="checkbox"
                    checked={formData.isCoordinator}
                    onChange={(e) => setFormData({ ...formData, isCoordinator: e.target.checked })}
                    className="rounded bg-slate-950 border-slate-800 text-cyan-500 focus:ring-0"
                  />
                  <span>Cấp quyền <strong className="text-cyan-400 font-bold">Ban Tổ Chức (Coordinator)</strong></span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                  <input
                    type="checkbox"
                    checked={formData.isJudge}
                    onChange={(e) => setFormData({ ...formData, isJudge: e.target.checked })}
                    className="rounded bg-slate-950 border-slate-800 text-cyan-500 focus:ring-0"
                  />
                  <span>Vai trò <strong className="text-indigo-400 font-bold">Giám khảo (Judge)</strong></span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                  <input
                    type="checkbox"
                    checked={formData.isMentor}
                    onChange={(e) => setFormData({ ...formData, isMentor: e.target.checked })}
                    className="rounded bg-slate-950 border-slate-800 text-cyan-500 focus:ring-0"
                  />
                  <span>Vai trò <strong className="text-emerald-400 font-bold">Mentor</strong></span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="rounded bg-slate-950 border-slate-800 text-cyan-500 focus:ring-0"
                  />
                  <span>Tài khoản <strong className="text-slate-400 font-bold">Hoạt động (Active)</strong></span>
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-mono text-xs cursor-pointer"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-white font-bold rounded-xl font-mono text-xs shadow-lg shadow-cyan-500/20 cursor-pointer"
                >
                  {editingUser ? 'Cập Nhật' : 'Tạo Mới'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
