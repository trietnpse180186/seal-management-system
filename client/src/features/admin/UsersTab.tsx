import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  Users,
  UserPlus,
  Lock,
  Search,
  Trash2,
  Edit2,
  CheckCircle,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "../shared/ConfirmDialog";
import UniversityCombobox from "../shared/UniversityCombobox";

interface UsersTabProps {
  token: string | null;
  readOnly?: boolean;
  roles?: any[];
  user?: any;
}

const API_BASE = import.meta.env.VITE_API_URL || (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' ? window.location.origin : 'http://localhost:5000');

export const UsersTab: React.FC<UsersTabProps> = ({
  token,
  readOnly = false,
  roles = [],
  user,
}) => {
  const confirm = useConfirm();
  const isAssistant = !user?.isSystemAdmin && (user?.isStudentAssistant || roles?.some((r: any) => r.role === 'student_assistant'));
  const [users, setUsers] = useState<any[]>([]);
  const displayedUsers = isAssistant ? users.filter((u: any) => u.isTeamMember) : users;
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  // Form state for creation / editing
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    fullName: "",
    studentId: "",
    university: "",
    isActive: true,
    isStudentAssistant: false,
  });

  const [hasRegistrationEvent, setHasRegistrationEvent] = useState(false);

  const fetchUsers = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await axios.get(
        `${API_BASE}/api/auth/users?search=${encodeURIComponent(search)}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      // Filter out any admin users just in case
      setUsers(res.data.filter((u: any) => !u.isSystemAdmin));
    } catch (err: any) {
      toast.error(
        err.response?.data?.message || "Lỗi khi tải danh sách người dùng.",
      );
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchUsers();
      axios.get(`${API_BASE}/api/events`)
        .then((res) => {
          setHasRegistrationEvent(res.data.some((e: any) => ['registration', 'ongoing'].includes(e.status)));
        })
        .catch((err) => console.error("Failed to fetch events for active check", err));
    }
  }, [token, search]);

  const handleOpenCreateModal = () => {
    setEditingUser(null);
    setFormData({
      email: "",
      password: "password123",
      fullName: "",
      studentId: "",
      university: "",
      isActive: true,
      isStudentAssistant: false,
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (user: any) => {
    setEditingUser(user);
    setFormData({
      email: user.email,
      password: "",
      fullName: user.fullName || "",
      studentId: user.studentId || "",
      university: user.university || "FPT University",
      isActive: user.isActive !== undefined ? !!user.isActive : true,
      isStudentAssistant: !!user.isStudentAssistant,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!editingUser) {
        const emailExists = users.some(u => u.email.toLowerCase() === formData.email.trim().toLowerCase());
        if (emailExists) {
          toast.error("Tài khoản với email này đã tồn tại trong hệ thống.");
          return;
        }
      }
      if (editingUser) {
        // Update basic User info
        await axios.put(
          `${API_BASE}/api/auth/users/${editingUser._id}`,
          {
            fullName: formData.fullName,
            studentId: formData.studentId,
            university: formData.university,
            password: formData.password || undefined,
            isActive: formData.isActive,
          },
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );

        toast.success("Cập nhật thông tin tài khoản thành công!");
      } else {
        // Create User
        await axios.post(
          `${API_BASE}/api/auth/users`,
          {
            email: formData.email,
            password: formData.password,
            fullName: formData.fullName,
            studentId: formData.studentId,
            university: formData.university,
            isActive: formData.isActive,
            isStudentAssistant: formData.isStudentAssistant,
          },
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );

        toast.success("Tạo tài khoản thành công!");
      }
      setIsModalOpen(false);
      fetchUsers();
    } catch (err: any) {
      toast.error(
        err.response?.data?.message || "Lỗi khi lưu thông tin người dùng.",
      );
    }
  };

  const handleToggleActive = async (user: any) => {
    try {
      await axios.put(
        `${API_BASE}/api/auth/users/${user._id}`,
        {
          isActive: !user.isActive,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      toast.success(
        user.isActive ? "Đã khóa tài khoản." : "Đã mở khóa tài khoản!",
      );
      fetchUsers(true);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Lỗi cập nhật trạng thái.");
    }
  };
  const handleToggleStudentAssistant = async (user: any) => {
    try {
      const res = await axios.post(
        `${API_BASE}/api/auth/users/${user._id}/toggle-student-assistant`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      toast.success(res.data.message || "Cập nhật quyền thành công!");
      fetchUsers(true);
    } catch (err: any) {
      toast.error(
        err.response?.data?.message ||
          "Lỗi khi cập nhật quyền cộng tác viên sinh viên.",
      );
    }
  };



  const handleDeleteUser = async (userId: string) => {
    const confirmed = await confirm({
      title: "Xác nhận xóa tài khoản",
      message:
        "Bạn có chắc chắn muốn xóa tài khoản người dùng này? Thao tác không thể hoàn tác!",
    });
    if (!confirmed) return;
    try {
      const res = await axios.delete(
        `${API_BASE}/api/auth/users/${userId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      toast.success(res.data.message || "Đã xóa người dùng.");
      fetchUsers();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Lỗi khi xóa người dùng.");
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white border border-slate-200 shadow-sm p-5 rounded-2xl">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2 font-mono">
            <Users className="text-[#F27024]" size={24} />
            <span>{isAssistant ? "Danh sách Thí sinh" : "Quản lý Tài khoản"}</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {isAssistant
              ? "Xem danh sách các thí sinh chính thức tham gia cuộc thi."
              : "Quản lý danh sách tài khoản người dùng tham gia hệ thống."}
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              size={16}
            />
            <input
              type="text"
              placeholder="Tìm theo tên, email, MSSV..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#F27024] w-56 transition-all font-mono"
            />
          </div>

          {!readOnly && !isAssistant && (
            <button
              onClick={handleOpenCreateModal}
              className="bg-[#F27024] hover:bg-[#d95f1f] text-white px-4 py-2 rounded-xl text-xs font-bold font-mono flex items-center gap-2 shadow-sm transition-all cursor-pointer shrink-0"
            >
              <UserPlus size={16} />
              Thêm Tài Khoản Mới
            </button>
          )}
        </div>
      </div>

      {/* Users Table */}
      <div className="glass rounded-2xl border border-slate-800/80 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase font-mono text-[11px]">
              <tr>
                <th className="p-4">Người Dùng</th>
                <th className="p-4">MSSV / Trường</th>
                <th className="p-4">Vai Trò</th>
                {!isAssistant && <th className="p-4 text-center">CTV</th>}
                {!isAssistant && <th className="p-4">Trạng Thái Tài Khoản</th>}
                <th className="p-4 text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {loading ? (
                <tr>
                  <td
                    colSpan={isAssistant ? 4 : 6}
                    className="p-8 text-center text-slate-500 font-mono"
                  >
                    Đang tải danh sách người dùng...
                  </td>
                </tr>
              ) : displayedUsers.length === 0 ? (
                <tr>
                  <td
                    colSpan={isAssistant ? 4 : 6}
                    className="p-8 text-center text-slate-500 font-mono"
                  >
                    Không có người dùng nào.
                  </td>
                </tr>
              ) : (
                displayedUsers.map((u) => {
                  return (
                    <tr
                      key={u._id}
                      className="hover:bg-slate-900/40 transition-colors"
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center font-bold text-white text-sm shadow-md shrink-0">
                            {u.fullName
                              ? u.fullName.charAt(0).toUpperCase()
                              : "U"}
                          </div>
                          <div>
                            <div className="font-bold text-white flex items-center gap-1.5">
                              {u.fullName}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono">
                              {u.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 font-mono">
                        <div className="text-slate-200">
                          {u.studentId || "N/A"}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {u.university || "FPT University"}
                        </div>
                      </td>
                      <td className="p-4">
                        {(() => {
                          const openEventRoles = u.roles ? u.roles.filter((r: any) => r.eventId && ['registration', 'ongoing'].includes(r.eventId.status)) : [];
                          
                          const renderedBadges = openEventRoles.map((roleRecord: any) => {
                            const role = roleRecord.role;
                            const eventName = roleRecord.eventId?.name || roleRecord.eventId?.semester;
                            if (role === 'student_assistant') {
                              return (
                                <div key={roleRecord._id} className="flex flex-col gap-0.5 items-start">
                                  <span className="px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 select-none whitespace-nowrap">
                                    Cộng tác viên
                                  </span>
                                  {eventName && (
                                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium font-sans truncate max-w-[160px]" title={eventName}>
                                      {eventName}
                                    </span>
                                  )}
                                </div>
                              );
                            }
                            if (role === 'judge') {
                              return (
                                <div key={roleRecord._id} className="flex flex-col gap-0.5 items-start">
                                  <span className="px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20 select-none whitespace-nowrap">
                                    Giám khảo
                                  </span>
                                  {eventName && (
                                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium font-sans truncate max-w-[160px]" title={eventName}>
                                      {eventName}
                                    </span>
                                  )}
                                </div>
                              );
                            }
                            if (role === 'mentor') {
                              return (
                                <div key={roleRecord._id} className="flex flex-col gap-0.5 items-start">
                                  <span className="px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold bg-sky-500/10 text-sky-400 border border-sky-500/20 select-none whitespace-nowrap">
                                    Mentor
                                  </span>
                                  {eventName && (
                                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium font-sans truncate max-w-[160px]" title={eventName}>
                                      {eventName}
                                    </span>
                                  )}
                                </div>
                              );
                            }
                            if (role === 'coordinator') {
                              return (
                                <div key={roleRecord._id} className="flex flex-col gap-0.5 items-start">
                                  <span className="px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 select-none whitespace-nowrap">
                                    Coordinator
                                  </span>
                                  {eventName && (
                                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium font-sans truncate max-w-[160px]" title={eventName}>
                                      {eventName}
                                    </span>
                                  )}
                                </div>
                              );
                            }
                            if (role === 'participant' && u.isTeamMember) {
                              return (
                                <div key={roleRecord._id} className="flex flex-col gap-0.5 items-start">
                                  <span className="px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold bg-blue-500/10 text-blue-500 border border-blue-500/30 select-none whitespace-nowrap">
                                    Thí sinh
                                  </span>
                                  {eventName && (
                                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium font-sans truncate max-w-[160px]" title={eventName}>
                                      {eventName}
                                    </span>
                                  )}
                                </div>
                              );
                            }
                            return null;
                          }).filter(Boolean);

                          return (
                            <div className="flex flex-wrap items-center gap-2">
                              {renderedBadges.length === 0 ? (
                                <span className="text-slate-500 font-medium text-xs select-none whitespace-nowrap">
                                  Người tham gia
                                </span>
                              ) : (
                                <div className="flex flex-wrap gap-1">
                                  {renderedBadges}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                      {!isAssistant && (
                        <td className="p-4 text-center">
                          {(() => {
                            const openEventRoles = u.roles ? u.roles.filter((r: any) => r.eventId && ['registration', 'ongoing'].includes(r.eventId.status)) : [];
                            const hasStudentAssistant = openEventRoles.some((r: any) => r.role === 'student_assistant');
                            const hasOtherRole = openEventRoles.some((r: any) => 
                              ['judge', 'mentor', 'coordinator'].includes(r.role) || 
                              (r.role === 'participant' && u.isTeamMember)
                            );

                            if (hasOtherRole) return null;

                            return (
                              <div className="flex items-center justify-center">
                                <button
                                  onClick={() => handleToggleStudentAssistant(u)}
                                  disabled={readOnly}
                                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                                    readOnly ? "cursor-not-allowed opacity-50" : "cursor-pointer"
                                  } ${
                                    hasStudentAssistant ? "bg-orange-500" : "bg-slate-200 hover:bg-slate-300"
                                  }`}
                                  title={hasStudentAssistant ? "Thu hồi quyền CTV" : "Cấp quyền CTV"}
                                >
                                  <span
                                    className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform shadow-sm ${
                                      hasStudentAssistant ? "translate-x-5" : "translate-x-1"
                                    }`}
                                  />
                                </button>
                              </div>
                            );
                          })()}
                        </td>
                      )}
                      {!isAssistant && (
                        <td className="p-4">
                          <button
                            onClick={() => handleToggleActive(u)}
                            disabled={readOnly || isAssistant}
                            className={`text-[10px] font-mono font-bold px-3 py-1 rounded-lg border flex items-center gap-1.5 transition-all ${
                              readOnly || isAssistant
                                ? "cursor-not-allowed opacity-60"
                                : "cursor-pointer"
                            } ${
                              u.isActive
                                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" + (readOnly || isAssistant ? "" : " hover:bg-emerald-500/20")
                                : "bg-rose-500/10 border-rose-500/30 text-rose-400" + (readOnly || isAssistant ? "" : " hover:bg-rose-500/20")
                            }`}
                          >
                            {u.isActive ? (
                              <CheckCircle size={12} />
                            ) : (
                              <Lock size={12} />
                            )}
                            {u.isActive ? "Hoạt Động" : "Đã Khóa"}
                          </button>
                        </td>
                      )}
                      {isAssistant ? (
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleOpenEditModal(u)}
                              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors cursor-pointer"
                              title="Xem chi tiết"
                            >
                              <Eye size={14} />
                            </button>
                          </div>
                        </td>
                      ) : (
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {!readOnly ? (
                              <>
                                <button
                                  onClick={() => handleOpenEditModal(u)}
                                  className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors cursor-pointer"
                                  title="Sửa thông tin"
                                >
                                  <Edit2 size={14} />
                                </button>
                                <button
                                  onClick={() => handleDeleteUser(u._id)}
                                  className="p-1.5 bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 hover:text-rose-200 border border-rose-800/40 rounded-lg transition-colors cursor-pointer btn-delete-user"
                                  title="Xóa tài khoản"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </>
                            ) : (
                              <span className="text-[10px] text-slate-500 italic">
                                Nguồn xem
                              </span>
                            )}
                          </div>
                        </td>
                      )}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-md p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200 font-sans">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white font-mono flex items-center gap-2">
                {isAssistant ? (
                  <Eye className="text-cyan-400" size={18} />
                ) : editingUser ? (
                  <Edit2 className="text-cyan-400" size={18} />
                ) : (
                  <UserPlus className="text-cyan-400" size={18} />
                )}
                <span>
                  {isAssistant
                    ? "Chi Tiết Thí Sinh"
                    : editingUser
                      ? "Chỉnh Sửa Tài Khoản"
                      : "Thêm Tài Khoản Mới"}
                </span>
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer text-sm font-mono"
              >
                ✕
              </button>
            </div>

            {isAssistant ? (
              <div className="space-y-5 text-sm font-sans">
                {/* Profile Header Card */}
                <div className="flex items-center gap-4 bg-slate-950/40 p-4 rounded-xl border border-slate-800/80">
                  <div className="w-14 h-14 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-bold text-lg font-mono">
                    {editingUser?.fullName?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-white leading-tight">
                      {editingUser?.fullName}
                    </h4>
                    <p className="text-xs text-slate-400 font-mono mt-1">
                      {editingUser?.email}
                    </p>
                  </div>
                </div>

                {/* Personal Information Group */}
                <div className="space-y-3 bg-slate-950/20 p-4 rounded-xl border border-slate-800/50">
                  <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-wider font-mono">
                    Thông tin cá nhân
                  </h4>
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="text-slate-500 block mb-0.5">Mã số sinh viên (MSSV)</span>
                      <span className="text-slate-200 font-mono font-bold">
                        {editingUser?.studentId || "Chưa cập nhật"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block mb-0.5">Trường đại học</span>
                      <span className="text-slate-200 font-bold">
                        {editingUser?.university || "Chưa cập nhật"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block mb-0.5">Trạng thái tài khoản</span>
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold font-mono border ${
                          editingUser?.isActive
                            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                            : "bg-rose-500/10 border-rose-500/20 text-rose-400"
                        }`}
                      >
                        {editingUser?.isActive ? "Hoạt Động" : "Đã Khóa"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Tournament Information Group */}
                <div className="space-y-3 bg-slate-950/20 p-4 rounded-xl border border-slate-800/50">
                  <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-wider font-mono">
                    Thông tin cuộc thi
                  </h4>
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="text-slate-500 block mb-0.5">Đội thi tham gia</span>
                      <span className="text-slate-200 font-bold">
                        {editingUser?.teamName || "Chưa tham gia đội"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block mb-0.5">Vai trò đội thi</span>
                      <span className="text-slate-200 font-bold">
                        {editingUser?.teamRole === "leader"
                          ? "Trưởng nhóm (Leader)"
                          : editingUser?.teamRole === "member"
                            ? "Thành viên"
                            : "Chưa tham gia"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-mono text-xs cursor-pointer shadow-lg shadow-black/20"
                  >
                    Đóng
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4 text-xs font-sans">
                <div>
                  <label className="block font-bold text-slate-300 mb-1">
                    Email <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    disabled={!!editingUser}
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white disabled:opacity-50 focus:outline-none focus:border-cyan-500 font-mono"
                    placeholder="user@example.com"
                  />
                </div>

                {editingUser && (
                  <div>
                    <label className="block font-bold text-slate-300 mb-1">
                      Mật khẩu{" "}
                      <span className="text-slate-500 font-normal">
                        (Để trống nếu không đổi)
                      </span>
                    </label>
                    <input
                      type="password"
                      value={formData.password}
                      onChange={(e) =>
                        setFormData({ ...formData, password: e.target.value })
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-500 font-mono"
                      placeholder="••••••••"
                    />
                  </div>
                )}

                <div>
                  <label className="block font-bold text-slate-300 mb-1">
                    Họ và Tên <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.fullName}
                    onChange={(e) =>
                      setFormData({ ...formData, fullName: e.target.value })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white disabled:opacity-50 focus:outline-none focus:border-cyan-500 font-sans"
                    placeholder="Nguyễn Văn A"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-300 mb-1">
                      Mã Số Sinh Viên (MSSV)
                    </label>
                    <input
                      type="text"
                      value={formData.studentId}
                      onChange={(e) =>
                        setFormData({ ...formData, studentId: e.target.value })
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white disabled:opacity-50 focus:outline-none focus:border-cyan-500 font-mono"
                      placeholder="SE180000"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-300 mb-1">
                      Trường Học
                    </label>
                    <UniversityCombobox
                      value={formData.university}
                      onChange={(val) =>
                        setFormData({ ...formData, university: val })
                      }
                      placeholder="Chọn trường..."
                      className="w-full"
                      inputClassName="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-500 font-sans disabled:opacity-50"
                    />
                  </div>
                </div>

                <div className="pt-2 space-y-2 border-t border-slate-800">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) =>
                        setFormData({ ...formData, isActive: e.target.checked })
                      }
                      className="rounded bg-slate-950 border-slate-800 text-cyan-500 focus:ring-0 disabled:opacity-50"
                    />
                    <span>
                      Tài khoản{" "}
                      <strong className="text-slate-400 font-bold">
                        Hoạt động (Active)
                      </strong>
                    </span>
                  </label>

                  {!editingUser && hasRegistrationEvent && (
                    <label className="flex items-center gap-2 cursor-pointer text-slate-300 pt-1">
                      <input
                        type="checkbox"
                        checked={formData.isStudentAssistant || false}
                        onChange={(e) =>
                          setFormData({ ...formData, isStudentAssistant: e.target.checked })
                        }
                        className="rounded bg-slate-950 border-slate-800 text-cyan-500 focus:ring-0"
                      />
                      <span>
                        Vai trò{" "}
                        <strong className="text-slate-400 font-bold">
                          Cộng tác viên (Student Assistant)
                        </strong>
                      </span>
                    </label>
                  )}
                </div>

                <div className="flex justify-end gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="btn-cancel px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-mono text-xs cursor-pointer"
                  >
                    Hủy Bỏ
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-white font-bold rounded-xl font-mono text-xs shadow-lg shadow-cyan-500/20 cursor-pointer"
                  >
                    {editingUser ? "Cập Nhật" : "Tạo Mới"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
