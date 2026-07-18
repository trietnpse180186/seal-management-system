import { useRef, useState, useEffect } from 'react';
import { Trophy, FileText, Sparkles } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import axios from 'axios';

gsap.registerPlugin(ScrollTrigger);

export default function Prizes() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeEvent, setActiveEvent] = useState<any>(null);

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
        console.error("Lỗi lấy thông tin cuộc thi tại Prizes:", err);
      }
    };
    fetchEvents();
  }, []);

  useGSAP(() => {
    // 1. Header Animation
    gsap.fromTo(
      ".prize-header",
      { y: 30, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: 0.8,
        ease: "power3.out",
        scrollTrigger: {
          trigger: ".prize-header",
          start: "top 85%",
          toggleActions: "play none none reverse",
        }
      }
    );

    // 2. Card Animation
    gsap.fromTo(
      ".prize-card",
      { y: 50, scale: 0.95, opacity: 0 },
      {
        y: 0,
        scale: 1,
        opacity: 1,
        duration: 1,
        ease: "back.out(1.2)",
        scrollTrigger: {
          trigger: ".prize-cards-container",
          start: "top 80%",
          toggleActions: "play none none reverse",
        }
      }
    );
  }, { scope: containerRef });

  return (
    <section ref={containerRef} className="py-24 bg-slate-100 overflow-hidden" id="prizes">
      {/* Animating LED Neon Border CSS */}
      <style dangerouslySetInnerHTML={{
        __html: `
        @keyframes neon-border-rotate {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .led-border-container {
          display: grid !important;
          position: relative;
          overflow: hidden;
          padding: 1.5px; /* border thickness */
          background: rgba(242, 112, 36, 0.05);
        }
        .led-border-container::before {
          content: '';
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: conic-gradient(
            from 0deg,
            transparent 20%,
            #f27024 40%,
            #f27024 60%,
            transparent 80%
          );
          animation: neon-border-rotate 4s linear infinite;
          z-index: 1;
        }
        .led-border-inner {
          z-index: 2;
          background: #ffffff;
          display: flex;
          flex-direction: column;
          align-items: stretch;
          width: 100%;
          height: 100%;
        }
        @keyframes gradient-flow {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .animate-gradient-flow {
          background-image: linear-gradient(90deg, #f27024, #fbbf24, #f27024);
          background-size: 200% auto;
          -webkit-background-clip: text;
          background-clip: text;
          animation: gradient-flow 3s ease infinite;
        }
      `}} />

      <div className="max-w-7xl mx-auto px-6">

        {/* Section Header */}
        <div className="prize-header flex flex-col md:flex-row justify-between items-center md:items-end mb-16 gap-4 opacity-0">
          <div>
            <span className="font-mono text-xs text-[#F27024] uppercase font-semibold">
              CƠ_CẤU_GIẢI_THƯỞNG
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 uppercase tracking-tight font-sans mt-1">
              GIẢI THƯỞNG CUỘC THI {activeEvent ? activeEvent.name : 'SEAL HACKATHON SPRING 2026'}
            </h2>
          </div>
          <div className="hidden md:block h-px flex-1 mx-8 bg-slate-200"></div>
        </div>

        {/* Prizes Cards Container */}
        <div className="prize-cards-container flex justify-center mt-8">

          <div className="prize-card led-border-container rounded-none text-center group hover:scale-[1.02] hover:-translate-y-2 hover:shadow-[0_0_50px_rgba(242,112,36,0.25)] active:scale-[0.99] transition-all duration-500 z-10 opacity-0 w-full max-w-3xl cursor-pointer">
            <div className="led-border-inner p-8 md:p-12 relative overflow-hidden">
              {/* Glowing Background Radial */}
              <div className="absolute -inset-px bg-gradient-to-b from-[#F27024]/10 to-transparent opacity-50 group-hover:opacity-100 transition-opacity duration-500 -z-10"></div>

              {/* Decorative Tech Grid background */}
              <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.01)_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none opacity-40"></div>

              {/* Corner tech accents */}
              <div className="absolute top-4 left-4 w-4 h-4 border-t-2 border-l-2 border-[#F27024]/40 group-hover:border-[#F27024] transition-colors"></div>
              <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-[#F27024]/40 group-hover:border-[#F27024] transition-colors"></div>
              <div className="absolute bottom-4 left-4 w-4 h-4 border-b-2 border-l-2 border-[#F27024]/40 group-hover:border-[#F27024] transition-colors"></div>
              <div className="absolute bottom-4 right-4 w-4 h-4 border-b-2 border-r-2 border-[#F27024]/40 group-hover:border-[#F27024] transition-colors"></div>

              {/* Icon Frame */}
              <div className="flex justify-center mb-6 relative">
                <div className="w-24 h-24 rounded-full border-2 border-[#F27024]/30 flex items-center justify-center bg-[#F27024]/10 shadow-[0_0_30px_rgba(242,112,36,0.15)] group-hover:scale-110 group-hover:border-[#F27024] group-hover:shadow-[0_0_40px_rgba(242,112,36,0.3)] transition-all duration-500">
                  <Trophy size={48} className="text-[#F27024] group-hover:rotate-12 transition-transform duration-500" />
                </div>
                <span className="absolute top-0 right-[42%] text-[#F27024]/40 animate-pulse">
                  <Sparkles size={16} />
                </span>
              </div>

              {/* Details Content */}
              <div className="flex flex-col items-center">
                <span className="font-mono text-[10px] text-[#F27024] mb-4 tracking-widest font-semibold uppercase">[ EVENT_PRIZE_POOL ]</span>

                <h3 className="text-xl md:text-2xl font-extrabold text-slate-900 mb-6 tracking-tight font-sans uppercase">
                  Tổng giá trị giải thưởng
                </h3>

                <div className="space-y-4 max-w-2xl">

                  <div className="py-2">
                    <span className="text-4xl md:text-6xl font-black tracking-wider text-[#F27024] group-hover:scale-105 inline-block transition-transform duration-500">
                      x.000.000 VND
                    </span>
                  </div>
                </div>

                {/* Additional Premium Badges / Accent */}
                <div className="mt-8 pt-8 border-t border-slate-200 w-full flex flex-col sm:flex-row justify-center items-center gap-6 text-[10px] sm:text-xs text-[#F27024]/70 font-mono">
                  <div className="flex items-center gap-2">
                    <FileText size={20} className="text-[#F27024]" />
                    <span>Giấy Chứng Nhận Cho Tất Cả Thí Sinh Tham Gia</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
}
