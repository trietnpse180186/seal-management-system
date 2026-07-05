import { useRef, useState, useEffect } from 'react';
import { Cpu, Layers, Terminal } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import axios from 'axios';

gsap.registerPlugin(ScrollTrigger);

export default function About() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeEvent, setActiveEvent] = useState<any>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const res = await axios.get("http://localhost:5000/api/events");
        const allEvents = res.data;
        // Prioritize registration or ongoing events
        let filtered = allEvents.filter((e: any) => e.status === "registration" || e.status === "ongoing");
        // Fallback to prepare or others if none of the above exist
        if (filtered.length === 0) {
          filtered = allEvents.filter((e: any) => e.status === "prepare" || e.status === "completed");
        }
        // Sort by newest
        const sorted = filtered.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setActiveEvent(sorted[0] || null);
      } catch (err) {
        console.error("Lỗi lấy thông tin cuộc thi tại About:", err);
      }
    };
    fetchEvents();

    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useGSAP(() => {
    // Header animation
    gsap.fromTo(
      ".about-header > *",
      { y: 30, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: 0.8,
        ease: "power3.out",
        stagger: 0.15,
        scrollTrigger: {
          trigger: containerRef.current,
          start: "top 85%",
          toggleActions: "play none none reverse",
        }
      }
    );

    // Cards animation
    gsap.fromTo(
      ".hackathon-card",
      { y: 40, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: 0.8,
        ease: "power3.out",
        stagger: 0.2,
        scrollTrigger: {
          trigger: ".hackathon-grid",
          start: "top 80%",
          toggleActions: "play none none reverse",
        }
      }
    );
  }, { scope: containerRef });

  const getCountdownText = () => {
    if (!activeEvent) return null;

    const now = currentTime.getTime();
    const regOpen = activeEvent.registrationOpen ? new Date(activeEvent.registrationOpen).getTime() : null;
    const regClose = activeEvent.registrationClose ? new Date(activeEvent.registrationClose).getTime() : null;

    // 1. If registration hasn't opened yet: countdown to regOpen
    if (regOpen && now < regOpen) {
      return {
        label: "Đăng ký đội thi sẽ mở sau:",
        timeText: formatRemainingTime(regOpen - now),
        colorClass: "text-amber-400 bg-amber-950/20 border-amber-900/30 font-mono"
      };
    }

    // 2. If registration is open: countdown to regClose
    if (regClose && now >= (regOpen || 0) && now < regClose) {
      return {
        label: "Đăng ký đội thi sẽ đóng sau:",
        timeText: formatRemainingTime(regClose - now),
        colorClass: "text-cyan-400 bg-cyan-950/20 border-cyan-900/30 font-mono"
      };
    }

    // 3. Otherwise registration is closed
    return {
      label: "Cổng đăng ký đội thi đã đóng",
      timeText: null,
      colorClass: "text-slate-400 bg-slate-900/40 border-slate-800 font-mono"
    };
  };

  const formatRemainingTime = (diff: number) => {
    if (diff <= 0) return "00:00:00";
    const seconds = Math.floor((diff / 1000) % 60);
    const minutes = Math.floor((diff / 1000 / 60) % 60);
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    const pad = (num: number) => num.toString().padStart(2, "0");

    if (days > 0) {
      return `${days} ngày ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    }
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  };

  return (
    <section ref={containerRef} className="py-24 bg-surface-dim relative border-y border-outline-variant/10" id="about">
      {/* Background radial glow */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_50%_10%,rgba(0,240,255,0.03)_0%,transparent_50%)]"></div>
      
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        
        {/* Header */}
        <div className="about-header max-w-3xl mb-16 space-y-4">
          <span className="font-mono text-xs text-cyan-400 uppercase tracking-widest block font-semibold">
            Tổng quan Hệ Thống
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-white uppercase tracking-tight font-sans">
            Hệ thống Hackathon
          </h2>
          <p className="text-on-surface-variant text-base leading-relaxed font-sans">
            Mỗi năm SEAL tổ chức 03 Hackathon, tương ứng với 3 học kỳ: Spring, Summer, Fall:
          </p>
        </div>

        {/* Active Contest Countdown Banner */}
        {activeEvent && (
          <div className="border border-cyan-500/20 bg-cyan-950/5 p-6 sm:p-8 rounded-none hover:border-cyan-500/40 transition-all duration-350 mb-12 relative overflow-hidden backdrop-blur-sm">
            {/* Ambient subtle glow */}
            <div className="absolute right-0 top-0 w-80 h-full bg-cyan-500/5 rounded-full blur-3xl pointer-events-none"></div>
            
            <div className="flex flex-col lg:flex-row items-center justify-between gap-6 relative z-10">
              <div className="space-y-3 max-w-2xl text-left">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
                  <span className="text-[10px] font-mono tracking-widest text-cyan-400 font-extrabold uppercase">
                    [CUỘC THI ĐANG DIỄN RA]
                  </span>
                </div>
                <h3 className="text-xl sm:text-2xl font-black text-white uppercase tracking-wide leading-tight">
                  {activeEvent.name}
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed font-sans">
                  {activeEvent.description || activeEvent.mainGoal}
                </p>
                <div className="flex flex-wrap gap-x-6 gap-y-2 pt-2 text-[10px] font-mono text-slate-400 uppercase">
                  <span>Học kỳ: Kỳ {activeEvent.semester} {activeEvent.year}</span>
                  <span>Thời lượng: {activeEvent.durationText || '48 GIỜ'}</span>
                  <span>Thành viên: {activeEvent.memberLimitText || '2-4 operators'}</span>
                  <span>Giải thưởng: <strong className="text-cyan-400 font-bold">{activeEvent.prizePoolText || '$50,000 USD'}</strong></span>
                </div>
              </div>

              {/* Countdown box */}
              {(() => {
                const countdown = getCountdownText();
                if (!countdown) return null;
                return (
                  <div className={`p-5 rounded-none border ${countdown.colorClass} space-y-2.5 min-w-[280px] w-full lg:w-auto`}>
                    <p className="text-[10px] font-bold uppercase tracking-wider font-mono text-center opacity-85">
                      {countdown.label}
                    </p>
                    {countdown.timeText && (
                      <p className="text-2xl sm:text-3xl font-black text-center font-mono tracking-widest text-cyan-glow">
                        {countdown.timeText}
                      </p>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* Hackathon Grid */}
        <div className="hackathon-grid grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
          
          {/* Card 1: Emerging Technologies */}
          <div className="hackathon-card border border-outline-variant/30 p-8 flex flex-col bg-[#0a141d]/85 rounded-none hover:border-cyan-500/40 transition-all duration-350 opacity-0">
            <div className="w-12 h-12 rounded-none border border-cyan-500/20 flex items-center justify-center mb-6 bg-cyan-950/10 text-cyan-400">
              <Cpu size={22} />
            </div>
            <h3 className="text-lg font-bold text-white mb-3 font-sans">Emerging Technologies</h3>
            <p className="text-on-surface-variant text-sm leading-relaxed font-sans">
              Tập trung vào các công nghệ mới và xu hướng tiên tiến như AI, IoT, Blockchain, cùng các lĩnh vực nghiên cứu đột phá trong ngành công nghệ.
            </p>
          </div>

          {/* Card 2: Product & User Experience */}
          <div className="hackathon-card border border-outline-variant/30 p-8 flex flex-col bg-[#0a141d]/85 rounded-none hover:border-cyan-500/40 transition-all duration-350 opacity-0">
            <div className="w-12 h-12 rounded-none border border-cyan-500/20 flex items-center justify-center mb-6 bg-cyan-950/10 text-cyan-400">
              <Layers size={22} />
            </div>
            <h3 className="text-lg font-bold text-white mb-3 font-sans">Product & User Experience</h3>
            <p className="text-on-surface-variant text-sm leading-relaxed font-sans">
              Tập trung vào việc phát triển sản phẩm hướng đến người dùng, tối ưu trải nghiệm thực tế và thúc đẩy thương mại hóa các ý tưởng sáng tạo.
            </p>
          </div>

          {/* Card 3: SDLC & Professional Working */}
          <div className="hackathon-card border border-outline-variant/30 p-8 flex flex-col bg-[#0a141d]/85 rounded-none hover:border-cyan-500/40 transition-all duration-350 opacity-0">
            <div className="w-12 h-12 rounded-none border border-cyan-500/20 flex items-center justify-center mb-6 bg-cyan-950/10 text-cyan-400">
              <Terminal size={22} />
            </div>
            <h3 className="text-lg font-bold text-white mb-3 font-sans">SDLC & Professional Working</h3>
            <p className="text-on-surface-variant text-sm leading-relaxed font-sans">
              Tập trung vào các chủ đề liên quan đến vòng đời phát triển phần mềm (SDLC) và kỹ năng làm việc chuyên nghiệp, giúp sinh viên phát triển khả năng làm việc trong môi trường công nghiệp thực tế.
            </p>
          </div>

        </div>

      </div>
    </section>
  );
}
