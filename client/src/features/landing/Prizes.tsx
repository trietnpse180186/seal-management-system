import { useRef } from 'react';
import { Award, Trophy } from 'lucide-react';
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
        stagger: 0.15,
        scrollTrigger: {
          trigger: ".prize-cards-container",
          start: "top 80%",
          toggleActions: "play none none reverse",
        }
      }
    );
  }, { scope: containerRef });

  return (
    <section ref={containerRef} className="py-20 bg-surface-container-low overflow-hidden" id="prizes">
      <div className="max-w-7xl mx-auto px-6">

        <div className="prize-header flex flex-col md:flex-row justify-between items-center md:items-end mb-16 gap-4 opacity-0">
          <div>
            <span className="font-mono text-xs text-primary-container uppercase font-semibold">
              CƠ_CẤU_GIẢI_THƯỞNG
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white uppercase tracking-tight font-sans mt-1">
              GIẢI THƯỞNG CUỘC THI
            </h2>
          </div>
          <div className="hidden md:block h-px flex-1 mx-8 bg-outline-variant/30"></div>
        </div>

        <div className="prize-cards-container grid md:grid-cols-3 gap-8 items-stretch">

          {/* 2nd Place */}
          <div className="prize-card border border-outline-variant/30 p-8 flex flex-col items-center text-center bg-[#0a141d] group hover:border-primary-container/40 transition-all duration-500 order-2 md:order-1 opacity-0">
            <span className="font-mono text-xs text-primary-container mb-6 font-semibold">[Á_QUÂN]</span>
            <div className="w-16 h-16 rounded-full border border-primary-container/30 flex items-center justify-center mb-6 group-hover:bg-[#00f0ff]/10 transition-colors">
              <Award className="text-primary-container" size={30} />
            </div>
            <h3 className="text-lg font-bold text-white mb-2 font-sans">GIẢI NHÌ</h3>
            <p className="text-on-surface-variant text-sm mb-6 leading-relaxed font-sans">
              Nhận quyền cố vấn độc quyền &amp; tài trợ chi phí công cụ phát triển dự án.
            </p>
            <div className="mt-auto font-mono text-base font-bold text-primary-container">
              15.000.000 VND
            </div>
          </div>

          {/* 1st Place */}
          <div className="prize-card border border-primary-container/50 p-8 flex flex-col items-center text-center bg-surface-container-high glow-cyan relative overflow-hidden group hover:scale-[1.03] transition-all duration-500 z-10 order-1 md:order-2 opacity-0">
            <div className="absolute top-0 left-0 w-full h-[3px] bg-primary-container shadow-[0_0_10px_#00f0ff]"></div>
            <span className="font-mono text-xs text-primary-container mb-6 tracking-widest font-semibold">[QUÁN_QUÂN]</span>
            <div className="w-20 h-20 rounded-full border-2 border-primary-container flex items-center justify-center mb-6 bg-primary-container/20 shadow-[0_0_20px_rgba(0,240,255,0.4)]">
              <Trophy className="text-primary-container" size={40} />
            </div>
            <h3 className="text-xl font-extrabold text-white mb-2 tracking-tight font-sans">GIẢI NHẤT</h3>
            <p className="text-on-surface-variant text-sm mb-6 leading-relaxed font-sans">
              Tài trợ toàn bộ phần cứng thiết bị &amp; cơ hội thực tập trực tiếp tại các doanh nghiệp đối tác hàng đầu.
            </p>
            <div className="mt-auto font-sans text-xl font-black text-primary-container tracking-wider">
              35.000.000 VND
            </div>
          </div>

          {/* 3rd Place */}
          <div className="prize-card border border-outline-variant/30 p-8 flex flex-col items-center text-center bg-[#0a141d] group hover:border-primary-container/40 transition-all duration-500 order-3 md:order-3 opacity-0">
            <span className="font-mono text-xs text-primary-container mb-6 font-semibold">[QUÝ_QUÂN]</span>
            <div className="w-16 h-16 rounded-full border border-primary-container/30 flex items-center justify-center mb-6 group-hover:bg-[#00f0ff]/10 transition-colors">
              <Award className="text-primary-container" size={30} />
            </div>
            <h3 className="text-lg font-bold text-white mb-2 font-sans">GIẢI BA</h3>
            <p className="text-on-surface-variant text-sm mb-6 leading-relaxed font-sans">
              Tài trợ tài khoản dịch vụ Cloud nâng cao &amp; voucher thi các chứng chỉ công nghệ quốc tế.
            </p>
            <div className="mt-auto font-mono text-base font-bold text-primary-container">
              5.000.000 VND
            </div>
          </div>

        </div>

      </div>
    </section>
  );
}
