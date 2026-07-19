import { Link } from "react-router-dom";
import { useRef, useState, useEffect } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import axios from "axios";

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
  const [marqueeText, setMarqueeText] = useState("CỔNG ĐĂNG KÝ HACKATHON ĐANG MỞ CHÍNH THỨC! ĐĂNG KÝ THAM GIA NGAY HÔM NAY!");

  const formatDateString = (dateStr: string | null | undefined) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "";

    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');

    return `${hours}:${minutes} ngày ${day}/${month}/${year}`;
  };

  useEffect(() => {
    const fetchActiveEvent = async () => {
      try {
        const res = await axios.get("http://localhost:5000/api/events");
        const allEvents = res.data;

        // Prioritize registration or ongoing events
        let filtered = allEvents.filter((e: any) => e.status === "registration" || e.status === "ongoing");

        // Fallback to prepare or completed
        if (filtered.length === 0) {
          filtered = allEvents.filter((e: any) => e.status === "prepare" || e.status === "completed");
        }

        // Sort by newest
        const sorted = filtered.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        const active = sorted[0];

        if (active) {
          if (active.status === "registration") {
            const deadline = active.registrationClose ? formatDateString(active.registrationClose) : "";
            const deadlineText = deadline ? `HẠN CHÓT ĐĂNG KÝ: ${deadline} • ` : "";
            setMarqueeText(`ĐANG MỞ ĐĂNG KÝ CUỘC THI "${active.name.toUpperCase()}"! ${deadlineText}ĐĂNG KÝ THAM GIA NGAY HÔM NAY!`);
          } else if (active.status === "ongoing") {
            setMarqueeText(`CUỘC THI "${active.name.toUpperCase()}" ĐANG DIỄN RA KỊCH TÍNH! THEO DÕI BẢNG XẾP HẠNG VÀ CẬP NHẬT CÁC TIN TỨC MỚI NHẤT!`);
          } else if (active.status === "prepare") {
            setMarqueeText(`THÔNG BÁO: ĐANG CHUẨN BỊ CHO SỰ KIỆN "${active.name.toUpperCase()}". HÃY THEO DÕI ĐỂ CẬP NHẬT THÔNG TIN MỚI NHẤT!`);
          } else {
            setMarqueeText(`THÔNG BÁO: CUỘC THI "${active.name.toUpperCase()}" ĐÃ KẾT THÚC THÀNH CÔNG! CHỜ ĐÓN MÙA HACKATHON TIẾP THEO!`);
          }
        }
      } catch (err) {
        console.error("Lỗi lấy thông tin sự kiện trong Hero:", err);
      }
    };
    fetchActiveEvent();
  }, []);

  useGSAP(() => {
    gsap.fromTo(
      [".hero-badge", ".hero-title", ".hero-desc", ".hero-btn"],
      { opacity: 0, y: 35 },
      {
        opacity: 1,
        y: 0,
        duration: 1,
        ease: "power3.out",
        stagger: 0.15,
        delay: 0.1
      }
    );
  }, { scope: containerRef });

  return (
    <section ref={containerRef} className="relative min-h-screen bg-slate-50 flex items-start overflow-hidden pt-28 md:pt-32 pb-12">
      {/* Hero custom animations */}
      <style dangerouslySetInnerHTML={{
        __html: `
        @keyframes marquee {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
        .animate-marquee {
          display: inline-block;
          animation: marquee 14s linear infinite;
        }
        @keyframes live-ping-smooth {
          0% {
            transform: scale(0.9);
            opacity: 1;
            box-shadow: 0 0 0 0 rgba(242, 112, 36, 0.7);
          }
          70% {
            transform: scale(1.6);
            opacity: 0;
            box-shadow: 0 0 0 8px rgba(242, 112, 36, 0);
          }
          100% {
            transform: scale(0.9);
            opacity: 0;
            box-shadow: 0 0 0 0 rgba(242, 112, 36, 0);
          }
        }
        .live-dot-glow {
          animation: live-ping-smooth 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        @keyframes neon-pulse-breath {
          0% {
            box-shadow: 0 0 8px rgba(242, 112, 36, 0.25), inset 0 0 4px rgba(242, 112, 36, 0.1);
            transform: scale(1);
          }
          30% {
            box-shadow: 0 0 25px rgba(242, 112, 36, 0.7), inset 0 0 12px rgba(242, 112, 36, 0.3);
            transform: scale(1.015);
          }
          45% {
            box-shadow: 0 0 12px rgba(242, 112, 36, 0.35), inset 0 0 6px rgba(242, 112, 36, 0.15);
            transform: scale(1);
          }
          60% {
            box-shadow: 0 0 32px rgba(242, 112, 36, 0.85), inset 0 0 15px rgba(242, 112, 36, 0.4);
            transform: scale(1.025);
          }
          85% {
            box-shadow: 0 0 8px rgba(242, 112, 36, 0.25), inset 0 0 4px rgba(242, 112, 36, 0.1);
            transform: scale(1);
          }
          100% {
            box-shadow: 0 0 8px rgba(242, 112, 36, 0.25), inset 0 0 4px rgba(242, 112, 36, 0.1);
            transform: scale(1);
          }
        }
        .btn-breath-pulse {
          animation: neon-pulse-breath 2.4s infinite ease-in-out;
          border-color: #f27024 !important;
          transition: transform 0.3s ease, box-shadow 0.3s ease !important;
        }
        .btn-breath-pulse:hover {
          box-shadow: 0 0 35px rgba(242, 112, 36, 0.95), 0 0 20px rgba(242, 112, 36, 0.5) !important;
          transform: scale(1.05) translateY(-1px);
        }
      `}} />

      {/* Background Video */}
      <video
        muted
        autoPlay
        loop
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
        style={{ objectPosition: "center 60%" }}
        src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260328_115001_bcdaa3b4-03de-47e7-ad63-ae3e392c32d4.mp4"
      />

      {/* Light overlay to ensure text readability */}
      <div className="absolute inset-0 bg-slate-50/80 z-[1]"></div>

      <div className="max-w-7xl mx-auto px-6 py-12 grid md:grid-cols-2 gap-12 items-center relative z-10 w-full">
        {/* Left Intro Text */}
        <div className="space-y-6 text-center md:text-left">
          {/* Live scrolling registration badge */}
          <div className="hero-badge inline-flex items-center gap-2 px-4 py-2 border border-[#F27024]/30 bg-[#F27024]/10 rounded-none opacity-0 overflow-hidden w-[340px]">
            <span className="relative flex h-2 w-2 flex-shrink-0">
              <span className="live-dot-glow absolute inline-flex h-full w-full rounded-full bg-[#F27024]"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#F27024]"></span>
            </span>
            <div className="overflow-hidden relative w-full h-5 flex items-center">
              <span className="animate-marquee whitespace-nowrap font-mono text-xs text-[#F27024] tracking-[0.1em] uppercase font-bold">
                {marqueeText}
              </span>
            </div>
          </div>

          <h1 className="hero-title text-3xl sm:text-5xl lg:text-5xl font-extrabold tracking-tight text-[#F27024] leading-tight uppercase font-sans opacity-0">
            LẬP TRÌNH TƯƠNG LAI:
            <br />
            <span className="text-slate-900 mt-4">SEAL HACKATHON</span>
          </h1>

          <p className="hero-desc text-slate-700 text-base sm:text-lg max-w-xl leading-relaxed mx-auto md:mx-0 font-sans opacity-0">
            SEAL HACKATHON là sân chơi học thuật và trải nghiệm công nghệ dành cho sinh viên ngành Công nghệ thông tin đang theo học tại Trường Đại học FPT cơ sở TP.HCM và các trường Đại học khác trên địa bàn thành phố Hồ Chí Minh.
          </p>

          <div className="hero-btn pt-4 flex flex-col sm:flex-row gap-4 justify-center md:justify-start opacity-0">
            <Link
              to={dashboardLink}
              className="btn-fpt btn-breath-pulse px-8 py-3.5 text-xs font-bold uppercase tracking-widest text-center active:scale-95 shadow-[inset_0_0_10px_rgba(242,112,36,0.1)]"
            >
              {user ? "Vào Dashboard" : "Tham gia ngay"}
            </Link>

            <a
              href="#schedule"
              className="px-8 py-3.5 bg-[#F27024] text-white border border-[#F27024] rounded-sm text-xs font-bold uppercase tracking-widest text-center transition-all duration-300 hover:bg-transparent hover:text-[#F27024] hover:scale-105 active:scale-95 shadow-[inset_0_0_10px_rgba(242,112,36,0.1)] hover:shadow-[0_0_20px_rgba(242,112,36,0.4)]"
            >
              Xem Lịch trình
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
