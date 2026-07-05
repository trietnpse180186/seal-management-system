import { useRef } from 'react';
import { Award, Trophy, FileText, Sparkles } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(ScrollTrigger);

export default function Prizes() {
  const containerRef = useRef<HTMLDivElement>(null);

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

    // 2. Cards Staggered Animation
    gsap.fromTo(
      ".prize-card",
      { y: 50, scale: 0.95, opacity: 0 },
      {
        y: 0,
        scale: 1,
        opacity: 1,
        duration: 1,
        ease: "back.out(1.2)",
        stagger: 0.12,
        scrollTrigger: {
          trigger: ".prize-cards-container",
          start: "top 80%",
          toggleActions: "play none none reverse",
        }
      }
    );
  }, { scope: containerRef });

  return (
    <section ref={containerRef} className="py-24 bg-surface-container-low overflow-hidden" id="prizes">
      {/* Animating LED Neon Border CSS */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes neon-border-rotate {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .led-border-container {
          display: grid !important;
          position: relative;
          overflow: hidden;
          padding: 1.5px; /* border thickness */
          background: rgba(255, 255, 255, 0.03);
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
            #00f0ff 40%,
            #00f0ff 60%,
            transparent 80%
          );
          animation: neon-border-rotate 4s linear infinite;
          z-index: 1;
        }
        .led-border-inner {
          z-index: 2;
          background: #060b11;
          display: flex;
          flex-direction: column;
          align-items: stretch;
          width: 100%;
          height: 100%;
        }
      `}} />

      <div className="max-w-7xl mx-auto px-6">

        {/* Section Header */}
        <div className="prize-header flex flex-col md:flex-row justify-between items-center md:items-end mb-16 gap-4 opacity-0">
          <div>
            <span className="font-mono text-xs text-cyan-400 uppercase font-semibold">
              CƠ_CẤU_GIẢI_THƯỞNG
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white uppercase tracking-tight font-sans mt-1">
              CƠ CẤU GIẢI THƯỞNG SEAL HACKATHON SPRING 2026
            </h2>
          </div>
          <div className="hidden md:block h-px flex-1 mx-8 bg-outline-variant/30"></div>
        </div>

        {/* Prizes Cards Container */}
        <div className="prize-cards-container space-y-12">
          
          {/* Top 3 Awards Grid - Bottom Aligned on Desktop */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch md:items-end pt-8">
            
            {/* Giải Nhì */}
            <div className="prize-card border border-white/5 rounded-none flex flex-col items-stretch text-center bg-slate-950/30 backdrop-blur-md overflow-hidden group hover:border-cyan-500/30 hover:-translate-y-2 hover:shadow-[0_15px_30px_rgba(0,240,255,0.08)] active:scale-[0.98] transition-all duration-500 opacity-0 order-2 md:order-1 cursor-pointer min-h-[300px]">
              {/* Icon Container Frame */}
              <div className="w-full bg-cyan-500/[0.03] py-6 flex justify-center border-b border-white/5 group-hover:bg-cyan-500/[0.06] transition-colors">
                <div className="w-16 h-16 rounded-full border border-cyan-500/20 flex items-center justify-center bg-cyan-950/10 text-cyan-400 group-hover:bg-cyan-500/20 group-hover:border-cyan-400/40 group-hover:scale-110 transition-all duration-500 shadow-[0_0_15px_rgba(6,182,212,0.05)]">
                  <Award size={30} className="group-hover:rotate-6 transition-transform duration-500" />
                </div>
              </div>
              {/* Details Content */}
              <div className="p-6 flex flex-col items-center flex-grow justify-between">
                <span className="font-mono text-[10px] text-cyan-400/60 uppercase font-semibold tracking-wider mb-2">[01_GIẢI]</span>
                <h3 className="text-lg font-bold text-white mb-2 font-sans tracking-wide">01 GIẢI NHÌ</h3>
                <p className="text-on-surface-variant text-sm mb-6 leading-relaxed font-sans opacity-80">
                  giấy chứng nhận + hoa
                </p>
                <div className="mt-auto font-mono text-xl font-bold text-cyan-400 group-hover:scale-105 transition-transform duration-500">
                  x.000.000 đồng
                </div>
              </div>
            </div>

            {/* Giải Nhất (Taller & Larger + LED Neon Border) */}
            <div className="prize-card led-border-container rounded-none text-center group hover:scale-[1.03] hover:-translate-y-6 hover:shadow-[0_0_40px_rgba(6,182,212,0.3)] active:scale-[0.99] transition-all duration-500 z-10 opacity-0 order-1 md:order-2 cursor-pointer min-h-[380px] md:-translate-y-6">
              <div className="led-border-inner">
                {/* Glowing Background Radial */}
                <div className="absolute -inset-px bg-gradient-to-b from-cyan-500/10 to-transparent opacity-50 group-hover:opacity-100 transition-opacity duration-500 -z-10"></div>
                
                {/* Icon Container Frame */}
                <div className="w-full bg-cyan-400/5 py-8 flex justify-center border-b border-cyan-500/20 group-hover:bg-cyan-400/10 transition-colors relative">
                  <div className="w-20 h-20 rounded-full border-2 border-cyan-400 flex items-center justify-center bg-cyan-400/15 shadow-[0_0_25px_rgba(0,240,255,0.25)] group-hover:scale-110 group-hover:border-cyan-300 transition-all duration-500">
                    <Trophy size={40} className="text-cyan-400 group-hover:rotate-12 transition-transform duration-500" />
                  </div>
                </div>
                {/* Details Content */}
                <div className="p-8 flex flex-col items-center flex-grow justify-between">
                  <span className="font-mono text-[10px] text-cyan-400 mb-2 tracking-widest font-semibold">[01_GIẢI]</span>
                  <h3 className="text-xl font-extrabold text-white mb-2 tracking-tight font-sans">01 GIẢI NHẤT</h3>
                  <p className="text-on-surface-variant text-sm mb-6 leading-relaxed font-sans font-semibold opacity-90">
                    giấy chứng nhận + hoa
                  </p>
                  <div className="mt-auto font-sans text-2xl font-black text-cyan-400 tracking-wider group-hover:scale-105 transition-transform duration-500">
                    x.000.000 đồng
                  </div>
                </div>
              </div>
            </div>

            {/* Giải Ba */}
            <div className="prize-card border border-white/5 rounded-none flex flex-col items-stretch text-center bg-slate-950/30 backdrop-blur-md overflow-hidden group hover:border-cyan-500/30 hover:-translate-y-2 hover:shadow-[0_15px_30px_rgba(0,240,255,0.08)] active:scale-[0.98] transition-all duration-500 opacity-0 order-3 md:order-3 cursor-pointer min-h-[300px]">
              {/* Icon Container Frame */}
              <div className="w-full bg-cyan-500/[0.03] py-6 flex justify-center border-b border-white/5 group-hover:bg-cyan-500/[0.06] transition-colors">
                <div className="w-16 h-16 rounded-full border border-cyan-500/20 flex items-center justify-center bg-cyan-950/10 text-cyan-400 group-hover:bg-cyan-500/20 group-hover:border-cyan-400/40 group-hover:scale-110 transition-all duration-500 shadow-[0_0_15px_rgba(6,182,212,0.05)]">
                  <Award size={30} className="group-hover:rotate-6 transition-transform duration-500" />
                </div>
              </div>
              {/* Details Content */}
              <div className="p-6 flex flex-col items-center flex-grow justify-between">
                <span className="font-mono text-[10px] text-cyan-400/60 uppercase font-semibold tracking-wider mb-2">[01_GIẢI]</span>
                <h3 className="text-lg font-bold text-white mb-2 font-sans tracking-wide">01 GIẢI BA</h3>
                <p className="text-on-surface-variant text-sm mb-6 leading-relaxed font-sans opacity-80">
                  giấy chứng nhận + hoa
                </p>
                <div className="mt-auto font-mono text-xl font-bold text-cyan-400 group-hover:scale-105 transition-transform duration-500">
                  x.000.000 đồng
                </div>
              </div>
            </div>

          </div>

          {/* Giải Khuyến Khích - Row 2 (Centered & Wide) */}
          <div className="flex justify-center">
            <div className="prize-card border border-white/5 rounded-none flex flex-col items-stretch text-center bg-slate-950/30 backdrop-blur-md overflow-hidden group hover:border-cyan-500/30 hover:-translate-y-2 hover:shadow-[0_15px_30px_rgba(0,240,255,0.08)] active:scale-[0.98] transition-all duration-500 opacity-0 w-full md:max-w-2xl cursor-pointer">
              {/* Icon Container Frame */}
              <div className="w-full bg-cyan-500/[0.03] py-5 flex justify-center border-b border-white/5 group-hover:bg-cyan-500/[0.06] transition-colors">
                <div className="w-12 h-12 rounded-full border border-cyan-500/20 flex items-center justify-center bg-cyan-950/10 text-cyan-400 group-hover:bg-cyan-500/20 group-hover:border-cyan-400/40 group-hover:scale-110 transition-all duration-500 shadow-[0_0_15px_rgba(6,182,212,0.05)]">
                  <Sparkles size={22} className="group-hover:scale-110 transition-transform duration-500" />
                </div>
              </div>
              {/* Details Content */}
              <div className="p-6 flex flex-col items-center">
                <span className="font-mono text-[10px] text-cyan-400/60 uppercase font-semibold tracking-wider mb-2">[01_GIẢI]</span>
                <h3 className="text-lg font-bold text-white mb-2 font-sans tracking-wide">01 GIẢI KHUYẾN KHÍCH</h3>
                <p className="text-on-surface-variant text-sm mb-4 leading-relaxed font-sans opacity-80">
                  giấy chứng nhận
                </p>
                <div className="font-mono text-xl font-bold text-cyan-400 group-hover:scale-105 transition-transform duration-500">
                  x.000.000 đồng
                </div>
              </div>
            </div>
          </div>

          {/* Divider to separate from Participation Benefits */}
          <div className="relative py-4 flex items-center">
            <div className="flex-grow border-t border-white/5"></div>
            <span className="flex-shrink mx-4 text-xs font-mono text-cyan-500/60 uppercase tracking-widest">
              Quyền lợi tham gia
            </span>
            <div className="flex-grow border-t border-white/5"></div>
          </div>

          {/* Giấy chứng nhận cho tất cả thí sinh - Full-width Banner style */}
          <div className="prize-card border border-dashed border-white/10 rounded-none p-8 bg-slate-950/10 backdrop-blur-sm group hover:border-cyan-500/30 hover:bg-slate-950/20 active:scale-[0.995] transition-all duration-500 opacity-0 cursor-pointer">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex flex-col md:flex-row items-center gap-6 text-center md:text-left">
                <div className="w-16 h-16 rounded-full border border-cyan-500/10 flex items-center justify-center bg-cyan-950/5 text-cyan-400/80 group-hover:bg-cyan-500/10 group-hover:border-cyan-400/30 group-hover:text-cyan-400 group-hover:scale-110 transition-all duration-500 shadow-[0_0_15px_rgba(6,182,212,0.02)]">
                  <FileText size={28} className="group-hover:rotate-3 transition-transform duration-500" />
                </div>
                <div>
                  <div className="flex flex-col sm:flex-row items-center gap-2 mb-1 justify-center md:justify-start">
                    <h3 className="text-lg font-bold text-white font-sans tracking-wide">GIẤY CHỨNG NHẬN THAM GIA</h3>
                    <span className="font-mono text-[10px] text-cyan-400 border border-cyan-400/30 px-2 py-0.5 rounded-full bg-cyan-400/5">
                      [TẤT_CẢ_THÍ_SINH]
                    </span>
                  </div>
                  <p className="text-on-surface-variant text-sm leading-relaxed font-sans max-w-xl opacity-80">
                    Tất cả các thí sinh tham gia cuộc thi và hoàn thành dự án hợp lệ đều được cấp giấy chứng nhận tham gia chính thức từ SEAL Hackathon.
                  </p>
                </div>
              </div>
              <div className="text-center md:text-right flex-shrink-0">
                <div className="font-mono text-xs font-semibold text-slate-500 group-hover:text-cyan-400/70 transition-colors">
                  Ký nhận bởi Ban tổ chức
                </div>
                <div className="text-[11px] text-slate-600 mt-1 font-sans">
                  Digital Certificate
                </div>
              </div>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
}
