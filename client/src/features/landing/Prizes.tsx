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
        <div className="prize-cards-container space-y-8">
          
          {/* Top 3 Awards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
            
            {/* Giải Nhì */}
            <div className="prize-card border border-outline-variant/30 p-8 flex flex-col items-center text-center bg-[#0a141d] group hover:border-cyan-500/40 transition-all duration-500 opacity-0 order-2 md:order-1">
              <span className="font-mono text-xs text-cyan-400 mb-6 font-semibold">[01_GIẢI]</span>
              <div className="w-16 h-16 rounded-full border border-cyan-500/20 flex items-center justify-center mb-6 bg-cyan-950/10 text-cyan-400 group-hover:bg-cyan-500/10 transition-colors">
                <Award size={30} />
              </div>
              <h3 className="text-lg font-bold text-white mb-3 font-sans">01 GIẢI NHÌ</h3>
              <p className="text-on-surface-variant text-sm mb-6 leading-relaxed font-sans">
                giấy chứng nhận + hoa
              </p>
              <div className="mt-auto font-mono text-xl font-bold text-cyan-400">
                x.000.000 đồng
              </div>
            </div>

            {/* Giải Nhất */}
            <div className="prize-card border border-cyan-500/50 p-8 flex flex-col items-center text-center bg-surface-container-high glow-cyan relative overflow-hidden group hover:scale-[1.03] transition-all duration-500 z-10 opacity-0 order-1 md:order-2">
              <div className="absolute top-0 left-0 w-full h-[3px] bg-cyan-400 shadow-[0_0_10px_#00f0ff]"></div>
              <span className="font-mono text-xs text-cyan-400 mb-6 tracking-widest font-semibold">[01_GIẢI]</span>
              <div className="w-20 h-20 rounded-full border-2 border-cyan-400 flex items-center justify-center mb-6 bg-cyan-400/15 shadow-[0_0_20px_rgba(0,240,255,0.3)]">
                <Trophy size={40} className="text-cyan-400" />
              </div>
              <h3 className="text-xl font-extrabold text-white mb-3 tracking-tight font-sans">01 GIẢI NHẤT</h3>
              <p className="text-on-surface-variant text-sm mb-6 leading-relaxed font-sans font-semibold">
                giấy chứng nhận + hoa
              </p>
              <div className="mt-auto font-sans text-2xl font-black text-cyan-400 tracking-wider">
                x.000.000 đồng
              </div>
            </div>

            {/* Giải Ba */}
            <div className="prize-card border border-outline-variant/30 p-8 flex flex-col items-center text-center bg-[#0a141d] group hover:border-cyan-500/40 transition-all duration-500 opacity-0 order-3 md:order-3">
              <span className="font-mono text-xs text-cyan-400 mb-6 font-semibold">[01_GIẢI]</span>
              <div className="w-16 h-16 rounded-full border border-cyan-500/20 flex items-center justify-center mb-6 bg-cyan-950/10 text-cyan-400 group-hover:bg-cyan-500/10 transition-colors">
                <Award size={30} />
              </div>
              <h3 className="text-lg font-bold text-white mb-3 font-sans">01 GIẢI BA</h3>
              <p className="text-on-surface-variant text-sm mb-6 leading-relaxed font-sans">
                giấy chứng nhận + hoa
              </p>
              <div className="mt-auto font-mono text-xl font-bold text-cyan-400">
                x.000.000 đồng
              </div>
            </div>

          </div>

          {/* Lower Awards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
            
            {/* Giải Khuyến khích */}
            <div className="prize-card border border-outline-variant/30 p-8 flex flex-col items-center text-center bg-[#0a141d] group hover:border-cyan-500/40 transition-all duration-500 opacity-0">
              <span className="font-mono text-xs text-cyan-400 mb-6 font-semibold">[01_GIẢI]</span>
              <div className="w-16 h-16 rounded-full border border-cyan-500/20 flex items-center justify-center mb-6 bg-cyan-950/10 text-cyan-400 group-hover:bg-cyan-500/10 transition-colors">
                <Sparkles size={28} />
              </div>
              <h3 className="text-lg font-bold text-white mb-3 font-sans">01 GIẢI KHUYẾN KHÍCH</h3>
              <p className="text-on-surface-variant text-sm mb-6 leading-relaxed font-sans">
                giấy chứng nhận
              </p>
              <div className="mt-auto font-mono text-xl font-bold text-cyan-400">
                x.000.000 đồng
              </div>
            </div>

            {/* Giấy chứng nhận */}
            <div className="prize-card border border-outline-variant/30 p-8 flex flex-col items-center text-center bg-[#0a141d] group hover:border-cyan-500/40 transition-all duration-500 opacity-0">
              <span className="font-mono text-xs text-cyan-400 mb-6 font-semibold">[TẤT_CẢ_THÍ_SINH]</span>
              <div className="w-16 h-16 rounded-full border border-cyan-500/20 flex items-center justify-center mb-6 bg-cyan-950/10 text-cyan-400 group-hover:bg-cyan-500/10 transition-colors">
                <FileText size={28} />
              </div>
              <h3 className="text-lg font-bold text-white mb-3 font-sans">GIẤY CHỨNG NHẬN</h3>
              <p className="text-on-surface-variant text-sm mb-6 leading-relaxed font-sans">
                Tất cả các thí sinh tham gia cuộc thi.
              </p>
              <div className="mt-auto font-mono text-sm font-bold text-slate-500">
                Ký nhận bởi Ban tổ chức
              </div>
            </div>

          </div>

        </div>

      </div>
    </section>
  );
}
