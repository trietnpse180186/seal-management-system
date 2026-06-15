import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Eye, EyeOff } from 'lucide-react';
import logo from "../../assets/logo.svg";

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

interface LoginProps {
  onLoginSuccess: (token: string, user: any, roles: any[]) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [isRegister, setIsRegister] = useState(false);
  const [registrationSuccess, setRegistrationSuccess] = useState(false);
  const [isVerificationPending, setIsVerificationPending] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [university, setUniversity] = useState('');
  const [githubUsername, setGithubUsername] = useState('');

  const setError = (msg: string) => {
    if (msg) {
      toast.error(msg);
    }
  };
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const [platform, setPlatform] = useState<string | null>(null);
  const [mobileRedirect, setMobileRedirect] = useState<string | null>(null);
  const [mobileApiUrl, setMobileApiUrl] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const plat = params.get('platform');
    const redir = params.get('mobile_redirect');
    const apiU = params.get('api_url');
    if (plat) {
      setPlatform(plat);
      sessionStorage.setItem('mobile_platform', plat);
    }
    if (redir) {
      setMobileRedirect(redir);
      sessionStorage.setItem('mobile_redirect', redir);
    }
    if (apiU) {
      setMobileApiUrl(apiU);
      sessionStorage.setItem('mobile_api_url', apiU);
    }
  }, []);

  const getBaseUrl = () => {
    return mobileApiUrl || sessionStorage.getItem('mobile_api_url') || 'http://localhost:5000/api';
  };

  const handleMobileRedirect = (token: string, user: any, roles: any[]) => {
    const plat = platform || sessionStorage.getItem('mobile_platform');
    const redir = mobileRedirect || sessionStorage.getItem('mobile_redirect');

    if (plat === 'mobile' && redir) {
      sessionStorage.removeItem('mobile_platform');
      sessionStorage.removeItem('mobile_redirect');
      sessionStorage.setItem('mobile_api_url', ''); // clean up API URL

      const targetUrl = `${redir}?token=${token}&user=${encodeURIComponent(JSON.stringify(user))}&roles=${encodeURIComponent(JSON.stringify(roles))}`;
      window.location.href = targetUrl;
      return true;
    }
    return false;
  };

  useEffect(() => {
    // Check if redirect contains GitHub OAuth authorization code
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const expired = params.get('expired');

    if (expired === 'true') {
      setError('Phiên đăng nhập đã hết hạn hoặc tài khoản được đăng nhập từ thiết bị khác.');
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    if (code) {
      // Clear query params so we don't try to log in again on refresh
      window.history.replaceState({}, document.title, window.location.pathname);

      // Auto submit OAuth code to Backend
      const exchangeCode = async () => {
        setLoading(true);
        setError('');
        try {
          const baseUrl = getBaseUrl();
          const response = await axios.post(`${baseUrl}/auth/github`, {
            code,
            redirectUri: window.location.origin + '/login',
            isMock: false
          });
          const { token, user, roles } = response.data;
          if (handleMobileRedirect(token, user, roles || [])) {
            return;
          }
          onLoginSuccess(token, user, roles || []);
          if (user.isSystemAdmin || (roles && roles.some((r: any) => r.role === 'coordinator'))) {
            navigate('/admin');
          } else if (roles && roles.some((r: any) => r.role === 'judge')) {
            navigate('/grading');
          } else {
            navigate('/guest-portal');
          }
        } catch (err: any) {
          console.error(err);
          setError(err.response?.data?.message || 'Lỗi xác thực GitHub bằng code.');
        } finally {
          setLoading(false);
        }
      };
      exchangeCode();
    }

    // Google OAuth implicit flow redirect check
    const hash = window.location.hash;
    if (hash && hash.includes('id_token=')) {
      const hashParams = new URLSearchParams(hash.substring(1));
      const idToken = hashParams.get('id_token');
      if (idToken) {
        // Clear hash
        window.history.replaceState({}, document.title, window.location.pathname);

        const loginWithGoogle = async () => {
          setLoading(true);
          setError('');
          try {
            const baseUrl = getBaseUrl();
            const response = await axios.post(`${baseUrl}/auth/google`, {
              idToken,
              isMock: false
            });
            const { token, user, roles } = response.data;
            if (handleMobileRedirect(token, user, roles || [])) {
              return;
            }
            onLoginSuccess(token, user, roles || []);
            if (user.isSystemAdmin || (roles && roles.some((r: any) => r.role === 'coordinator'))) {
              navigate('/admin');
            } else if (roles && roles.some((r: any) => r.role === 'judge')) {
              navigate('/grading');
            } else {
              navigate('/guest-portal');
            }
          } catch (err: any) {
            console.error(err);
            setError(err.response?.data?.message || 'Lỗi đăng nhập Google.');
          } finally {
            setLoading(false);
          }
        };
        loginWithGoogle();
      }
    }
  }, []);

  const handleOAuthClick = (provider: 'google' | 'github') => {
    setError('');
    const redirectUri = encodeURIComponent(window.location.origin + '/login');
    if (provider === 'google') {
      const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '901479860432-9ejc1a1d1r71r9r8gm6bnftvkgb866ge.apps.googleusercontent.com';
      const nonce = Math.random().toString(36).substring(2) + Date.now().toString(36);
      const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=id_token&scope=openid%20email%20profile&nonce=${nonce}`;
      window.location.href = googleAuthUrl;
    } else {
      const clientId = import.meta.env.VITE_GITHUB_CLIENT_ID || 'Ov23liz8uHIFRtgdwDwE';
      const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&scope=read:user%20user:email&redirect_uri=${redirectUri}`;
      window.location.href = githubAuthUrl;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const baseUrl = getBaseUrl();

    try {
      if (isRegister) {
        const response = await axios.post(`${baseUrl}/auth/register`, {
          email,
          password,
          fullName,
          studentId,
          university,
          githubUsername
        });

        // Auto-login if first user (API returns token directly)
        if (response.data.token) {
          const { token, user, roles } = response.data;
          if (handleMobileRedirect(token, user, roles || [])) {
            return;
          }
          onLoginSuccess(token, user, roles || []);
          if (user.isSystemAdmin || (roles && roles.some((r: any) => r.role === 'coordinator'))) {
            navigate('/admin');
          } else {
            navigate('/guest-portal');
          }
        } else {
          setRegistrationSuccess(true);
          toast.success("Đăng ký tài khoản thành công! Vui lòng kiểm tra email để xác thực.");
        }
      } else {
        const response = await axios.post(`${baseUrl}/auth/login`, {
          email,
          password
        });
        const { token, user, roles } = response.data;
        if (handleMobileRedirect(token, user, roles)) {
          return;
        }
        onLoginSuccess(token, user, roles);

        // Redirect based on role
        if (user.isSystemAdmin || roles.some((r: any) => r.role === 'coordinator')) {
          navigate('/admin');
        } else if (roles.some((r: any) => r.role === 'judge')) {
          navigate('/grading');
        } else {
          navigate('/guest-portal');
        }
      }
    } catch (err: any) {
      console.error(err);
      if (err.response?.status === 403 && err.response?.data?.requiresVerification) {
        setIsVerificationPending(true);
      } else {
        setError(err.response?.data?.message || 'Có lỗi xảy ra, vui lòng thử lại.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (registrationSuccess || isVerificationPending) {
    return (
      <div className="min-h-[calc(100vh-80px)] flex items-center justify-center px-4 py-12">
        <div className="glass-panel w-full max-w-md p-8 rounded-xl relative overflow-hidden text-center">
          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-primary-container to-transparent opacity-80 animate-pulse"></div>

          <div className="w-24 h-24 mb-6 mx-auto relative">
            <img
              alt="SEAL Hackathon Logo"
              className="w-full h-full object-contain rounded-full logo-glow drop-shadow-[0_0_20px_rgba(0,240,255,0.6)]"
              src={logo}
            />
          </div>

          <div className="chip font-mono text-xs text-primary-container mb-4 bg-[#0a141d]/50">
            {isVerificationPending ? '[ACTIVATION_REQUIRED]' : '[SYSTEM_PENDING]'}
          </div>

          <h2 className="font-mono text-xl font-bold text-white mb-3 uppercase tracking-tight">
            {isVerificationPending ? 'PENDING_ACTIVATION' : 'NODE_VERIFICATION'}
          </h2>

          <p className="text-on-surface-variant text-sm mb-6 leading-relaxed">
            {isVerificationPending ? (
              <>
                Tài khoản chưa được kích hoạt. Một email chứa đường dẫn kích hoạt đã được gửi tới địa chỉ <span className="text-primary-container font-mono">{email}</span>. Vui lòng kiểm tra hộp thư của bạn (và cả mục thư rác) để hoàn tất việc xác thực tài khoản.
              </>
            ) : (
              <>
                Đăng ký thành công! Một email chứa đường dẫn kích hoạt đã được gửi tới địa chỉ <span className="text-primary-container font-mono">{email}</span>. Vui lòng kiểm tra hộp thư của bạn (và cả mục thư rác) để hoàn tất việc xác thực tài khoản.
              </>
            )}
          </p>

          <button
            onClick={() => {
              setIsRegister(false);
              setRegistrationSuccess(false);
              setIsVerificationPending(false);
            }}
            className="btn-primary w-full py-2.5 font-mono text-xs font-bold uppercase tracking-widest active:scale-95 transition-all duration-300 cursor-pointer"
          >
            QUAY LẠI ĐĂNG NHẬP
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-80px)] flex items-center justify-center px-4 py-12">

      <div className="glass-panel w-full max-w-md p-8 rounded-xl relative overflow-hidden z-10">

        {/* Top Rule */}
        <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-primary-container to-transparent opacity-80"></div>
        <div className="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-primary-container to-transparent opacity-30"></div>

        {/* Header Section */}
        <div className="text-center mb-6 flex flex-col items-center">
          <h1 className="font-mono text-3xl font-bold text-cyan-300 mb-2 tracking-tight uppercase">
            {isRegister ? 'Đăng ký Tài khoản' : 'Đăng nhập'}
          </h1>
          <p className="text-on-surface-variant text-xs font-sans">
            {isRegister ? 'Khởi tạo thông tin của bạn để tham gia cuộc thi.' : 'Xác thực tài khoản của bạn để bắt đầu phiên làm việc.'}
          </p>
        </div>



        <form onSubmit={handleSubmit} className="space-y-4">

          {isRegister && (
            <>
              <div>
                <label className="block font-mono text-xs text-primary-container opacity-80 mb-1" htmlFor="fullName">Họ và Tên</label>
                <div className="relative cyber-input-wrapper rounded overflow-hidden">
                  <div className="relative terminal-prompt">
                    <input
                      type="text"
                      id="fullName"
                      required
                      placeholder="Nhập họ và tên đầy đủ của bạn"
                      value={fullName}
                      onChange={e => setFullName(e.target.value)}
                      className="cyber-input relative z-10 w-full rounded py-2 pl-11 pr-4 font-mono text-xs focus:ring-0"
                    />
                    <div className="scanline"></div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-mono text-xs text-primary-container opacity-80 mb-1" htmlFor="studentId">Mã số Sinh viên</label>
                  <div className="relative cyber-input-wrapper rounded overflow-hidden">
                    <div className="relative terminal-prompt">
                      <input
                        type="text"
                        id="studentId"
                        placeholder="Ví dụ: SE180xxx"
                        value={studentId}
                        onChange={e => setStudentId(e.target.value)}
                        className="cyber-input relative z-10 w-full rounded py-2 pl-11 pr-4 font-mono text-xs focus:ring-0"
                      />
                      <div className="scanline"></div>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block font-mono text-xs text-primary-container opacity-80 mb-1" htmlFor="university">Trường Đại học</label>
                  <div className="relative cyber-input-wrapper rounded overflow-hidden">
                    <input
                      type="text"
                      id="university"
                      placeholder="Ví dụ: Đại học FPT"
                      value={university}
                      onChange={e => setUniversity(e.target.value)}
                      className="cyber-input relative z-10 w-full rounded py-2 px-3 font-mono text-xs focus:ring-0"
                    />
                    <div className="scanline"></div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-mono text-xs text-primary-container opacity-80 mb-1" htmlFor="githubUsername">Tên tài khoản GitHub</label>
                <div className="relative cyber-input-wrapper rounded overflow-hidden">
                  <div className="relative terminal-prompt">
                    <input
                      type="text"
                      id="githubUsername"
                      placeholder="Nhập tên tài khoản github"
                      value={githubUsername}
                      onChange={e => setGithubUsername(e.target.value)}
                      className="cyber-input relative z-10 w-full rounded py-2 pl-11 pr-4 font-mono text-xs focus:ring-0"
                    />
                    <div className="scanline"></div>
                  </div>
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block font-mono text-xs text-primary-container opacity-80 mb-1" htmlFor="email">Địa chỉ Email</label>
            <div className="relative cyber-input-wrapper rounded overflow-hidden">
              <div className="relative terminal-prompt">
                <input
                  type="email"
                  id="email"
                  required
                  placeholder="Nhập địa chỉ email của bạn"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="cyber-input relative z-10 w-full rounded py-2 pl-11 pr-4 font-mono text-xs focus:ring-0"
                />
                <div className="scanline"></div>
              </div>
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block font-mono text-xs text-primary-container opacity-80" htmlFor="password">Mật khẩu</label>
              {!isRegister && (
                <a href="#" className="font-mono text-[10px] text-primary-container hover:underline hover:text-[#7df4ff] transition-colors">Quên mật khẩu?</a>
              )}
            </div>
            <div className="relative cyber-input-wrapper rounded overflow-hidden">
              <div className="relative terminal-prompt flex items-center">
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  required
                  placeholder="Nhập mật khẩu bảo mật của bạn"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="cyber-input relative z-10 w-full rounded py-2 pl-11 pr-10 font-mono text-xs focus:ring-0"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 z-20 text-primary-container opacity-60 hover:opacity-100 transition-opacity cursor-pointer flex items-center justify-center"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
                <div className="scanline"></div>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-2.5 font-mono text-xs font-bold uppercase tracking-widest active:scale-95 transition-all duration-300 mt-4 cursor-pointer"
          >
            {loading ? 'Đang xử lý...' : isRegister ? 'Đăng ký ngay' : 'Đăng nhập'}
          </button>
        </form>

        <div className="relative my-6 text-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-outline-variant/30"></div>
          </div>
          <span className="relative px-3 text-[10px] uppercase tracking-wider text-on-surface-variant/60 bg-[#0a141d] font-mono">
            Hoặc đăng nhập bằng
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => handleOAuthClick('google')}
            className="btn-secondary flex items-center justify-center gap-2 py-2 font-mono text-xs cursor-pointer"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Google
          </button>

          <button
            type="button"
            onClick={() => handleOAuthClick('github')}
            className="btn-secondary flex items-center justify-center gap-2 py-2 font-mono text-xs cursor-pointer"
          >
            <Github size={16} />
            GitHub
          </button>
        </div>

        <div className="mt-6 pt-4 border-t border-outline-variant/30 text-center">
          <p className="text-xs text-on-surface-variant font-sans">
            {isRegister ? 'Đã kích hoạt khóa truy cập?' : 'Chưa có tài khoản?'}
            <button
              onClick={() => {
                setIsRegister(!isRegister);
                setError('');
              }}
              className="text-primary-container hover:text-primary-fixed underline font-mono text-xs ml-1.5 transition-colors duration-150 cursor-pointer"
            >
              {isRegister ? 'Đăng nhập ngay' : 'Đăng ký tài khoản mới'}
            </button>
          </p>
        </div>

      </div>
    </div>
  );
}


