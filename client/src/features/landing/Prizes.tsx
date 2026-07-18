import { useRef, useState, useEffect } from 'react';
import { Trophy, FileText, Sparkles, Award } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import axios from 'axios';

gsap.registerPlugin(ScrollTrigger);

const prizeItems = [
  {
    title: '01 Giải Nhất',
    amount: '7.000.000 đồng',
    benefits: 'Giấy chứng nhận + hoa',
  },
  {
    title: '01 Giải Nhì',
    amount: '5.000.000 đồng',
    benefits: 'Giấy chứng nhận + hoa',
  },
  {
    title: '01 Giải Ba',
    amount: '3.000.000 đồng',
    benefits: 'Giấy chứng nhận + hoa',
  },
  {
    title: '01 Giải Khuyến Khích',
    amount: '1.500.000 đồng',
    benefits: 'Giấy chứng nhận',
  },
];

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

      <div className="w-full max-w-[1680px] mx-auto px-4 sm:px-6 lg:px-10 2xl:px-12">

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

          <div className="prize-card led-border-container rounded-none text-center group hover:scale-[1.01] hover:-translate-y-2 hover:shadow-[0_0_50px_rgba(242,112,36,0.25)] active:scale-[0.99] transition-all duration-500 z-10 opacity-0 w-full max-w-none">
            <div className="led-border-inner p-5 md:p-8 xl:p-10 relative overflow-hidden">
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
              <div className="flex justify-center mb-5 relative">
                <div className="w-20 h-20 rounded-full border-2 border-[#F27024]/30 flex items-center justify-center bg-[#F27024]/10 shadow-[0_0_30px_rgba(242,112,36,0.15)] group-hover:scale-110 group-hover:border-[#F27024] group-hover:shadow-[0_0_40px_rgba(242,112,36,0.3)] transition-all duration-500">
                  <Trophy size={40} className="text-[#F27024] group-hover:rotate-12 transition-transform duration-500" />
                </div>
                <span className="absolute top-0 right-[44%] text-[#F27024]/40 animate-pulse">
                  <Sparkles size={16} />
                </span>
              </div>

              {/* Details Content */}
              <div className="flex flex-col items-center relative z-10">
                <h3 className="text-xl md:text-2xl font-extrabold text-slate-900 mb-7 tracking-tight font-sans uppercase">
                  Cơ cấu giải thưởng chính thức
                </h3>

                <div className="w-full grid gap-4 text-left lg:grid-cols-2 2xl:grid-cols-4">
                  {prizeItems.map((item, index) => (
                    <div
                      key={item.title}
                      className="flex min-h-[148px] flex-col justify-between rounded-[6px] border border-[#F27024]/15 bg-[#F27024]/[0.04] p-4 transition-all duration-300 hover:border-[#F27024]/35 hover:bg-[#F27024]/[0.08]"
                    >
                      <div className="flex items-start gap-3">
                        <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-[4px] border border-[#F27024]/20 bg-[#F27024]/10 font-mono text-xs font-bold text-[#F27024]">
                          {String(index + 1).padStart(2, '0')}
                        </span>
                        <div>
                          <p className="text-sm font-bold text-slate-900 uppercase tracking-wide xl:text-base">{item.title}</p>
                          <p className="mt-1 text-sm leading-6 text-slate-600">{item.benefits}</p>
                        </div>
                      </div>
                      <div className="mt-5 flex items-center gap-2 border-t border-[#F27024]/10 pt-4 pl-11">
                        <Award size={18} className="text-[#F27024]" />
                        <span className="font-mono text-xl font-black text-[#F27024] xl:text-2xl">{item.amount}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-5 grid w-full gap-4 text-left lg:grid-cols-2">
                  <div className="rounded-[6px] border border-[#F27024]/15 bg-[#F27024]/[0.04] p-4">
                    <div className="flex items-start gap-3">
                      <Sparkles size={20} className="mt-0.5 shrink-0 text-[#F27024]" />
                      <div>
                        <p className="text-sm font-bold uppercase tracking-wide text-slate-900">Hạng mục đặc biệt</p>
                        <p className="mt-1 text-sm leading-6 text-slate-600">
                          Vinh danh dành cho thí sinh đồng hành trọn vẹn 3 mùa giải (Fall 2025, Spring 2026, Summer 2026).
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[6px] border border-[#F27024]/15 bg-[#F27024]/[0.04] p-4">
                    <div className="flex items-start gap-3">
                      <FileText size={20} className="mt-0.5 shrink-0 text-[#F27024]" />
                      <div>
                        <p className="text-sm font-bold uppercase tracking-wide text-slate-900">Giấy chứng nhận</p>
                        <p className="mt-1 text-sm leading-6 text-slate-600">
                          Tất cả các thí sinh tham gia cuộc thi đều nhận giấy chứng nhận.
                        </p>
                      </div>
                    </div>
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
