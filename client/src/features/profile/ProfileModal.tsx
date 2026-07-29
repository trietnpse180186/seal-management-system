import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  AlertTriangle,
  AtSign,
  Building2,
  Eye,
  EyeOff,
  GitBranch,
  GraduationCap,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  Pencil,
  Ruler,
  Save,
  ShieldCheck,
  Trash2,
  UserRound,
  Weight,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import './ProfileModal.css';

type ProfileModalProps = {
  user: any;
  isLight: boolean;
  onClose: () => void;
  onLogout: () => void | Promise<void>;
  onUserUpdated: (user: any) => void;
};

type ProfileForm = {
  fullName: string;
  studentId: string;
  university: string;
  githubUsername: string;
  height: string;
  weight: string;
};

type PasswordForm = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

const emptyPasswordForm: PasswordForm = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
};

const getApiBase = () =>
  import.meta.env.VITE_API_URL ||
  (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
    ? window.location.origin
    : 'http://localhost:5000');

const getToken = () => sessionStorage.getItem('token') || localStorage.getItem('token');

const getInitials = (name?: string) => {
  const words = (name || 'Người dùng').trim().split(/\s+/);
  return words.slice(-2).map((word) => word[0]).join('').toUpperCase();
};

export default function ProfileModal({
  user,
  isLight,
  onClose,
  onLogout,
  onUserUpdated,
}: ProfileModalProps) {
  const [activeTab, setActiveTab] = useState<'profile' | 'security'>('profile');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [passwordForm, setPasswordForm] = useState<PasswordForm>(emptyPasswordForm);
  const [formData, setFormData] = useState<ProfileForm>({
    fullName: '',
    studentId: '',
    university: '',
    githubUsername: '',
    height: '',
    weight: '',
  });

  const userForm = useMemo<ProfileForm>(() => ({
    fullName: user?.fullName || '',
    studentId: user?.studentId || '',
    university: user?.university || '',
    githubUsername: user?.githubUsername || '',
    height: user?.height != null ? String(user.height) : '',
    weight: user?.weight != null ? String(user.weight) : '',
  }), [user]);

  useEffect(() => {
    setFormData(userForm);
  }, [userForm]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSaving && !isChangingPassword && !isDeleting) onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isSaving, isChangingPassword, isDeleting, onClose]);

  const authHeaders = { Authorization: `Bearer ${getToken()}` };

  const handleSaveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!formData.fullName.trim()) return toast.error('Họ và tên không được để trống.');
    if (!formData.height || Number(formData.height) <= 0) return toast.error('Chiều cao chưa hợp lệ.');
    if (!formData.weight || Number(formData.weight) <= 0) return toast.error('Cân nặng chưa hợp lệ.');

    setIsSaving(true);
    try {
      const response = await axios.put(`${getApiBase()}/api/auth/profile`, formData, { headers: authHeaders });
      onUserUpdated(response.data.user);
      setIsEditing(false);
      toast.success(response.data.message || 'Đã cập nhật hồ sơ.');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Không thể cập nhật hồ sơ.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (passwordForm.newPassword.length < 8) return toast.error('Mật khẩu mới cần ít nhất 8 ký tự.');
    if (passwordForm.newPassword !== passwordForm.confirmPassword) return toast.error('Mật khẩu xác nhận chưa khớp.');
    if (passwordForm.currentPassword === passwordForm.newPassword) return toast.error('Mật khẩu mới phải khác mật khẩu hiện tại.');

    setIsChangingPassword(true);
    try {
      const response = await axios.put(
        `${getApiBase()}/api/auth/change-password`,
        {
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        },
        { headers: authHeaders },
      );
      setPasswordForm(emptyPasswordForm);
      toast.success(response.data.message || 'Đã đổi mật khẩu.');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Không thể đổi mật khẩu.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleDeleteAccount = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!deletePassword) return toast.error('Vui lòng nhập mật khẩu để xác nhận.');

    setIsDeleting(true);
    try {
      await axios.delete(`${getApiBase()}/api/auth/account`, {
        headers: authHeaders,
        data: { currentPassword: deletePassword },
      });
      toast.success('Tài khoản của bạn đã được xóa.');
      onClose();
      await onLogout();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Không thể xóa tài khoản.');
    } finally {
      setIsDeleting(false);
    }
  };

  const inputClassName = `profile-field__input${isEditing ? '' : ' profile-field__input--readonly'}`;

  return (
    <div className={`profile-overlay ${isLight ? 'profile-overlay--light' : 'profile-overlay--dark'}`} role="presentation">
      <section className="profile-dialog" role="dialog" aria-modal="true" aria-labelledby="profile-title">
        <header className="profile-hero">
          <div className="profile-avatar" aria-hidden="true">{getInitials(user?.fullName)}</div>
          <div className="profile-hero__copy">
            <span className="profile-eyebrow">Tài khoản cá nhân</span>
            <h1 id="profile-title">{user?.fullName || 'Người dùng'}</h1>
            <p><AtSign size={14} aria-hidden="true" /> {user?.email}</p>
          </div>
          <button id="profile-close" className="profile-icon-button" type="button" onClick={onClose} aria-label="Đóng hồ sơ">
            <X size={20} />
          </button>
        </header>

        <nav className="profile-tabs" aria-label="Các mục hồ sơ">
          <button
            id="profile-tab-information"
            type="button"
            className={activeTab === 'profile' ? 'is-active' : ''}
            onClick={() => setActiveTab('profile')}
            aria-current={activeTab === 'profile' ? 'page' : undefined}
          >
            <UserRound size={17} /> Thông tin
          </button>
          <button
            id="profile-tab-security"
            type="button"
            className={activeTab === 'security' ? 'is-active' : ''}
            onClick={() => setActiveTab('security')}
            aria-current={activeTab === 'security' ? 'page' : undefined}
          >
            <ShieldCheck size={17} /> Bảo mật
          </button>
        </nav>

        <div className="profile-content">
          {activeTab === 'profile' ? (
            <form onSubmit={handleSaveProfile}>
              <div className="profile-section-heading">
                <div>
                  <h2>Thông tin của bạn</h2>
                  <p>Cập nhật thông tin dùng trong các sự kiện và đội thi.</p>
                </div>
                {!isEditing && (
                  <button id="profile-edit" className="profile-button profile-button--secondary" type="button" onClick={() => setIsEditing(true)}>
                    <Pencil size={16} /> Chỉnh sửa
                  </button>
                )}
              </div>

              <div className="profile-fields">
                <label className="profile-field profile-field--wide">
                  <span><UserRound size={15} /> Họ và tên <b>*</b></span>
                  <input id="profile-full-name" className={inputClassName} disabled={!isEditing} required value={formData.fullName} onChange={(e) => setFormData({ ...formData, fullName: e.target.value })} />
                </label>
                <label className="profile-field">
                  <span><GraduationCap size={15} /> Mã số sinh viên</span>
                  <input id="profile-student-id" className={inputClassName} disabled={!isEditing} value={formData.studentId} onChange={(e) => setFormData({ ...formData, studentId: e.target.value })} placeholder="Chưa cập nhật" />
                </label>
                <label className="profile-field">
                  <span><Building2 size={15} /> Trường / Đơn vị</span>
                  <input id="profile-university" className={inputClassName} disabled={!isEditing} value={formData.university} onChange={(e) => setFormData({ ...formData, university: e.target.value })} placeholder="Chưa cập nhật" />
                </label>
                <label className="profile-field profile-field--wide">
                  <span><GitBranch size={15} /> Tài khoản GitHub</span>
                  <input id="profile-github" className={inputClassName} disabled={!isEditing} value={formData.githubUsername} onChange={(e) => setFormData({ ...formData, githubUsername: e.target.value })} placeholder="Chưa cập nhật" />
                </label>
                <label className="profile-field">
                  <span><Ruler size={15} /> Chiều cao (cm) <b>*</b></span>
                  <input id="profile-height" className={inputClassName} type="number" min="1" disabled={!isEditing} required value={formData.height} onChange={(e) => setFormData({ ...formData, height: e.target.value })} placeholder="Chưa cập nhật" />
                </label>
                <label className="profile-field">
                  <span><Weight size={15} /> Cân nặng (kg) <b>*</b></span>
                  <input id="profile-weight" className={inputClassName} type="number" min="1" disabled={!isEditing} required value={formData.weight} onChange={(e) => setFormData({ ...formData, weight: e.target.value })} placeholder="Chưa cập nhật" />
                </label>
              </div>

              {isEditing && (
                <div className="profile-actions">
                  <button className="profile-button profile-button--ghost" type="button" disabled={isSaving} onClick={() => { setFormData(userForm); setIsEditing(false); }}>Hủy</button>
                  <button id="profile-save" className="profile-button profile-button--primary" type="submit" disabled={isSaving}>
                    {isSaving ? <LoaderCircle className="profile-spinner" size={16} /> : <Save size={16} />}
                    {isSaving ? 'Đang lưu...' : 'Lưu thay đổi'}
                  </button>
                </div>
              )}
            </form>
          ) : (
            <div className="profile-security">
              <form className="profile-security-card" onSubmit={handleChangePassword}>
                <div className="profile-security-card__icon"><KeyRound size={20} /></div>
                <div className="profile-security-card__heading">
                  <h2>Đổi mật khẩu</h2>
                  <p>Dùng ít nhất 8 ký tự và không trùng mật khẩu hiện tại.</p>
                </div>
                {[
                  ['currentPassword', 'Mật khẩu hiện tại'],
                  ['newPassword', 'Mật khẩu mới'],
                  ['confirmPassword', 'Xác nhận mật khẩu mới'],
                ].map(([key, label]) => (
                  <label className="profile-field profile-field--wide" key={key}>
                    <span><LockKeyhole size={15} /> {label}</span>
                    <div className="profile-password-input">
                      <input
                        id={`profile-${key}`}
                        type={showPasswords ? 'text' : 'password'}
                        autoComplete={key === 'currentPassword' ? 'current-password' : 'new-password'}
                        required
                        minLength={key === 'currentPassword' ? undefined : 8}
                        value={passwordForm[key as keyof PasswordForm]}
                        onChange={(e) => setPasswordForm({ ...passwordForm, [key]: e.target.value })}
                      />
                      <button type="button" onClick={() => setShowPasswords(!showPasswords)} aria-label={showPasswords ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}>
                        {showPasswords ? <EyeOff size={17} /> : <Eye size={17} />}
                      </button>
                    </div>
                  </label>
                ))}
                <div className="profile-actions">
                  <button id="profile-change-password" className="profile-button profile-button--primary" type="submit" disabled={isChangingPassword}>
                    {isChangingPassword ? <LoaderCircle className="profile-spinner" size={16} /> : <KeyRound size={16} />}
                    {isChangingPassword ? 'Đang cập nhật...' : 'Đổi mật khẩu'}
                  </button>
                </div>
              </form>

              <section className="profile-danger-zone" aria-labelledby="danger-zone-title">
                <div className="profile-danger-zone__icon"><AlertTriangle size={20} /></div>
                <div className="profile-danger-zone__copy">
                  <h2 id="danger-zone-title">Xóa tài khoản</h2>
                  <p>Dữ liệu tài khoản sẽ bị xóa vĩnh viễn và không thể khôi phục.</p>
                </div>
                <button id="profile-delete-open" className="profile-button profile-button--danger" type="button" onClick={() => setShowDeleteConfirm(true)} disabled={!!user?.isSystemAdmin}>
                  <Trash2 size={16} /> {user?.isSystemAdmin ? 'Không áp dụng cho Admin' : 'Xóa tài khoản'}
                </button>
              </section>
            </div>
          )}
        </div>

        {showDeleteConfirm && (
          <div className="profile-confirm-overlay">
            <form className="profile-confirm" onSubmit={handleDeleteAccount} role="alertdialog" aria-modal="true" aria-labelledby="delete-account-title">
              <div className="profile-confirm__icon"><Trash2 size={22} /></div>
              <h2 id="delete-account-title">Xóa tài khoản vĩnh viễn?</h2>
              <p>Thao tác này không thể hoàn tác. Nhập mật khẩu hiện tại để xác nhận.</p>
              <label className="profile-field profile-field--wide">
                <span>Mật khẩu hiện tại</span>
                <input id="profile-delete-password" type="password" autoComplete="current-password" required autoFocus value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} />
              </label>
              <div className="profile-actions">
                <button className="profile-button profile-button--ghost" type="button" disabled={isDeleting} onClick={() => { setShowDeleteConfirm(false); setDeletePassword(''); }}>Quay lại</button>
                <button id="profile-delete-confirm" className="profile-button profile-button--danger-solid" type="submit" disabled={isDeleting}>
                  {isDeleting ? <LoaderCircle className="profile-spinner" size={16} /> : <Trash2 size={16} />}
                  {isDeleting ? 'Đang xóa...' : 'Xóa vĩnh viễn'}
                </button>
              </div>
            </form>
          </div>
        )}
      </section>
    </div>
  );
}
