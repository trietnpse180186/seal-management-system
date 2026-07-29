import { Link } from "react-router-dom";
import { useRef, useState, useEffect } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { CalendarDays, UserPlus, Images, LogIn, ArrowRight } from "lucide-react";

interface HeroProps {
  user: any;
  roles: any[];
}

export default function Hero({ user, roles }: HeroProps) {
  const isSystemAdmin = user?.isSystemAdmin;
  const isCoordinator =
    roles?.some((r) => r.role === "coordinator") || isSystemAdmin;
  const dashboardLink = user
    ? isSystemAdmin || isCoordinator
      ? "/admin"
      : "/team-area"
    : "/login";

  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // Custom states for shield sequence loop (FPT Orange Theme)
  const [progress, setProgress] = useState(0);

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const current = videoRef.current.currentTime;
      const duration = videoRef.current.duration;
      if (duration > 0) {
        setProgress(current / duration);
      }
    }
  };

  // Parallax mouse interaction values using Framer Motion springs
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const springConfig = { damping: 30, stiffness: 100 };
  const smoothX = useSpring(mouseX, springConfig);
  const smoothY = useSpring(mouseY, springConfig);

  // Parallax transforms (Hero text: max 4px)
  const textX = useTransform(smoothX, [-1, 1], [-4, 4]);
  const textY = useTransform(smoothY, [-1, 1], [-4, 4]);

  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const checkTouch = () => {
      setIsTouchDevice('ontouchstart' in window || navigator.maxTouchPoints > 0);
    };
    checkTouch();

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
    const listener = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', listener);

    const handleMouseMove = (e: MouseEvent) => {
      if (isTouchDevice || prefersReducedMotion) return;
      const { clientX, clientY } = e;
      const { innerWidth, innerHeight } = window;
      mouseX.set((clientX / innerWidth) * 2 - 1);
      mouseY.set((clientY / innerHeight) * 2 - 1);
    };

    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      mediaQuery.removeEventListener('change', listener);
    };
  }, [isTouchDevice, prefersReducedMotion]);

  // Framer Motion entrance animation sequence
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        delayChildren: 0.3,
        staggerChildren: 0.12,
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 24 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.85,
        ease: [0.215, 0.610, 0.355, 1.000] as any // Apple easing
      }
    }
  };

  const handleScrollToSchedule = (e: React.MouseEvent) => {
    e.preventDefault();
    const element = document.getElementById("schedule");
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
      window.history.pushState(null, "", "#schedule");
    }
  };

  return (
    <section 
      ref={containerRef} 
      className="relative min-h-screen bg-[#FDFCFB] text-[#1E1E24] flex flex-col font-sans overflow-hidden"
    >
      {/* 1. Subtle Technical Grid Background (Warm Mode) */}
      <div 
        className="absolute inset-0 z-0 pointer-events-none opacity-40"
        style={{
          backgroundImage: `
            linear-gradient(rgba(233,231,228,0.4) 1px, transparent 1px),
            linear-gradient(90deg, rgba(233,231,228,0.4) 1px, transparent 1px)
          `,
          backgroundSize: "48px 48px"
        }}
        aria-hidden="true"
      />

      {/* Decorative background radial glows for depth */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full bg-gradient-to-br from-[#F26A21]/6 to-transparent blur-[120px] pointer-events-none z-0" />
      <div className="absolute bottom-[-100px] left-[-100px] w-[600px] h-[600px] rounded-full bg-gradient-to-tr from-indigo-500/3 to-transparent blur-[140px] pointer-events-none z-0" />

      {/* 2. Transparent Navbar over Warm Background */}
      <header className="relative z-30 w-full px-6 md:px-10 py-5 bg-transparent">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Logo brand - Strict FPT identity */}
          <Link to="/" className="flex items-center gap-1.5 group select-none">
            <span className="font-display font-extrabold text-lg tracking-wider uppercase text-[#1E1E24]">
              SEAL
            </span>
            <span className="font-display font-bold text-xs ml-0.5 px-2.5 py-1.5 bg-[#F26A21] text-white uppercase tracking-wider">
              HACKATHON
            </span>
          </Link>

          {/* Center Links with hover underlines */}
          <nav className="hidden md:flex items-center gap-6">
            <a 
              href="#schedule" 
              onClick={handleScrollToSchedule}
              className="group relative flex items-center gap-2 font-sans text-sm font-medium text-[#7A7A85] hover:text-[#1E1E24] transition-colors duration-250"
            >
              <CalendarDays size={15} className="group-hover:text-[#F26A21] transition-colors duration-250" />
              <span>Xem lịch trình</span>
              <span className="absolute bottom-[-4px] left-0 w-0 h-[1.5px] bg-[#F26A21] transition-all duration-300 group-hover:w-full" />
            </a>

            <Link 
              to={user ? "/team-area" : "/login?redirect=/team-area"} 
              className="group relative flex items-center gap-2 font-sans text-sm font-medium text-[#7A7A85] hover:text-[#1E1E24] transition-colors duration-250"
            >
              <UserPlus size={15} className="group-hover:text-[#F26A21] transition-colors duration-250" />
              <span>Đăng ký thi</span>
              <span className="absolute bottom-[-4px] left-0 w-0 h-[1.5px] bg-[#F26A21] transition-all duration-300 group-hover:w-full" />
            </Link>

            <Link 
              to="/album" 
              className="group relative flex items-center gap-2 font-sans text-sm font-medium text-[#7A7A85] hover:text-[#1E1E24] transition-colors duration-250"
            >
              <Images size={15} className="group-hover:text-[#F26A21] transition-colors duration-250" />
              <span>Album ảnh</span>
              <span className="absolute bottom-[-4px] left-0 w-0 h-[1.5px] bg-[#F26A21] transition-all duration-300 group-hover:w-full" />
            </Link>
          </nav>

          {/* Right Action Button - FPT Orange style */}
          <Link 
            to={user ? dashboardLink : "/login"} 
            className="rounded-full px-5 py-2 flex items-center gap-2 font-sans font-bold uppercase tracking-[0.05em] text-[14px] text-[#F26A21] border border-[#F26A21]/30 bg-transparent hover:bg-[#F26A21]/5 hover:border-[#F26A21] hover:shadow-[0_4px_20px_rgba(242,106,33,0.06)] transition-all duration-300 active:scale-[0.97]"
          >
            <LogIn size={13} />
            <span>{user ? "Dashboard" : "Đăng nhập"}</span>
          </Link>
        </div>
      </header>

      {/* 3. Hero content and Shield showcase in 2-column layout */}
      <main className="relative z-20 flex-1 max-w-7xl mx-auto w-full px-6 md:px-10 flex flex-col md:flex-row items-center justify-between gap-10">
        
        {/* Left Column: Event Content (~47% width) */}
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          style={{
            x: isTouchDevice || prefersReducedMotion ? 0 : textX,
            y: isTouchDevice || prefersReducedMotion ? 0 : textY
          }}
          className="w-full md:w-[47%] text-left space-y-6 select-text"
        >
          {/* Top Event Badge - Glassmorphic design */}
          <motion.div variants={itemVariants}>
            <div className="rounded-full px-4 py-2 inline-flex items-center gap-2 border border-[#E9E7E4] bg-white/70 backdrop-blur-sm shadow-[0_4px_20px_rgba(30,30,36,0.02)]">
              <motion.span 
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                className="w-2 h-2 rounded-full bg-[#F26A21] shadow-[0_0_6px_rgba(242,106,33,0.5)]" 
              />
              <span className="font-mono text-[0.7rem] tracking-[0.22em] font-semibold uppercase text-[#7A7A85]">
                SEAL HACKATHON 2026
              </span>
            </div>
          </motion.div>

          {/* Headline - Strict Archivo Black Editorial Style */}
          <motion.h1 
            variants={itemVariants} 
            className="font-display font-black text-[#1E1E24] tracking-[-0.035em] leading-[0.92]"
            style={{ 
              fontSize: "clamp(2.9rem, 8vw, 5.4rem)"
            }}
          >
            <span className="block text-[#1E1E24]">
              Lập trình
            </span>
            <span className="block italic bg-gradient-to-r from-[#F26A21] to-[#FF9F5A] bg-clip-text text-transparent pb-2">
              tương lai.
            </span>
          </motion.h1>

          {/* Description */}
          <motion.p 
            variants={itemVariants} 
            className="font-sans text-[16px] leading-[1.65] text-[#7A7A85] font-medium"
            style={{ maxWidth: "32rem" }}
          >
            Sân chơi học thuật và trải nghiệm công nghệ dành cho sinh viên ngành Công nghệ thông tin tại Trường Đại học FPT cơ sở TP.HCM và các trường đại học khác trên địa bàn Thành phố Hồ Chí Minh.
          </motion.p>

          {/* Actions */}
          <motion.div variants={itemVariants} className="pt-6 flex flex-col sm:flex-row gap-4">
            <Link
              to={dashboardLink}
              className="group px-6 py-3 bg-gradient-to-r from-[#F26A21] to-[#FF9F5A] hover:opacity-95 text-white rounded-xl font-sans font-bold uppercase tracking-[0.05em] text-[14px] text-center shadow-[0_12px_32px_rgba(242,106,33,0.18)] hover:-translate-y-0.5 hover:scale-[1.01] active:scale-[0.99] transition-all duration-300 flex items-center justify-center gap-2"
            >
              <span>THAM GIA NGAY</span>
              <ArrowRight size={14} className="transform transition-transform duration-250 group-hover:translate-x-1" />
            </Link>

            <a
              href="#schedule"
              onClick={handleScrollToSchedule}
              className="px-6 py-3 bg-white/60 backdrop-blur-sm hover:bg-white text-[#1E1E24] rounded-xl font-sans font-bold uppercase tracking-[0.05em] text-[14px] text-center border border-[#E9E7E4] hover:border-[#F26A21] hover:text-[#F26A21] transition-all duration-300 flex items-center justify-center gap-2 shadow-sm"
            >
              <CalendarDays size={14} />
              <span>XEM LỊCH TRÌNH</span>
            </a>
          </motion.div>

          {/* Metrics Row */}
          <motion.div variants={itemVariants} className="pt-8 mt-10 border-t border-[#E9E7E4] max-w-xl">
            <div className="grid grid-cols-3 gap-8">
              <div>
                <p className="font-display font-black text-[34px] tracking-[-0.02em] text-[#1E1E24]">500+</p>
                <p className="font-mono text-[0.7rem] tracking-[0.22em] font-semibold uppercase text-[#7A7A85] mt-1">
                  Thí sinh
                </p>
              </div>
              <div>
                <p className="font-display font-black text-[34px] tracking-[-0.02em] text-[#1E1E24]">48H</p>
                <p className="font-mono text-[0.7rem] tracking-[0.22em] font-semibold uppercase text-[#7A7A85] mt-1">
                  Coding
                </p>
              </div>
              <div>
                <p className="font-display font-black text-[34px] tracking-[-0.02em] text-[#1E1E24]">100M</p>
                <p className="font-mono text-[0.7rem] tracking-[0.22em] font-semibold uppercase text-[#7A7A85] mt-1">
                  Giải thưởng
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>

        {/* Right Column: Premium SEAL Shield Showcase (~53% width on desktop) */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.96, x: 30 }}
          animate={{ opacity: 1, scale: 1, x: 0 }}
          transition={{ duration: 1.2, delay: 0.5, ease: [0.215, 0.610, 0.355, 1.000] }}
          className="w-full md:w-[53%] flex items-center justify-center relative min-h-[340px] md:min-h-[480px] lg:min-h-[580px] z-10"
        >
          {/* Floating Transparent Wrapper for Video */}
          <motion.div
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
            className="relative w-80 h-80 sm:w-[420px] sm:h-[420px] md:w-[500px] md:h-[500px] lg:w-[540px] lg:h-[540px] flex items-center justify-center overflow-hidden select-none pointer-events-none"
          >
            {/* Soft radial glow behind shield inside the card */}
            <div className="absolute inset-0 z-0 pointer-events-none rounded-full blur-[80px] opacity-25 bg-[radial-gradient(circle_at_50%_50%,rgba(242,106,33,0.2)_0%,transparent_60%)]" />

            {/* Shield Rotating Video Loop (WebM transparent with CSS drop shadow) */}
            <video
              ref={videoRef}
              autoPlay
              loop
              muted
              playsInline
              poster="/shield_seal.png"
              onTimeUpdate={handleTimeUpdate}
              style={{ 
                filter: 'drop-shadow(0px 16px 36px rgba(0, 0, 0, 0.09))'
              }}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 scale-[1.15] sm:scale-[1.35] md:scale-[1.55] lg:scale-[1.7] w-full h-full object-contain z-10"
            >
              <source src="/shield_rotation.webm" type="video/webm" />
            </video>
          </motion.div>
        </motion.div>
      </main>

      {/* 4. Bottom-Right Shield Status Indicator (Desktop only) */}
      <div className="hidden lg:flex absolute bottom-8 right-8 z-30 flex-col items-end gap-2">
        <div className="rounded-full px-5 py-3 flex items-center gap-3 border border-[#E9E7E4] bg-white/90 backdrop-blur-md shadow-sm">
          <motion.span 
            animate={{ scale: [1, 1.25, 1] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
            className="w-2 h-2 rounded-full bg-[#F26A21] shadow-[0_0_8px_rgba(242,106,33,0.5)]" 
          />
          <span className="font-mono text-[0.7rem] tracking-[0.22em] font-bold uppercase text-[#F26A21]">
            SYSTEM ACTIVATED
          </span>
          <div className="w-24 h-1 bg-[#E9E7E4] rounded-full overflow-hidden">
            <div 
              className="h-full bg-[#F26A21] rounded-full transition-all duration-100 ease-out" 
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* 5. Bottom Center Scroll Indicator */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-1.5 pointer-events-none">
        <span className="font-mono text-[0.7rem] tracking-[0.22em] font-semibold uppercase text-[#7A7A85]">
          SCROLL TO EXPLORE
        </span>
        <div className="w-[1px] h-8 bg-[#E9E7E4] relative overflow-hidden">
          <motion.div 
            animate={{ 
              y: ["-100%", "100%"],
              opacity: [0, 1, 0]
            }}
            transition={{ 
              duration: 2, 
              repeat: Infinity, 
              ease: "easeInOut" 
            }}
            className="absolute top-0 left-0 w-full h-1/2 bg-[#F26A21]"
          />
        </div>
      </div>
    </section>
  );
}
