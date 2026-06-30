import { useRef } from 'react';
import { Award, Users, UserCheck } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(ScrollTrigger);

export default function Ranking() {
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    // Header animation
    gsap.fromTo(
      ".ranking-header > *",
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
      ".ranking-card",
      { y: 40, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: 0.8,
        ease: "power3.out",
        stagger: 0.2,
        scrollTrigger: {
          trigger: ".ranking-grid",
          start: "top 80%",
          toggleActions: "play none none reverse",
        }
      }
    );
  }, { scope: containerRef });

  return (
    <section ref={containerRef} className="py-24 bg-surface-container-low relative border-b border-outline-variant/10" id="ranking">
      {/* Background radial glow */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_50%_90%,rgba(0,240,255,0.02)_0%,transparent_50%)]"></div>
      
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        
        {/* Header */}
        <div className="ranking-header max-w-3xl mb-16 space-y-4">
          <span className="font-mono text-xs text-cyan-400 uppercase tracking-widest block font-semibold">
            Xếp hạng giải đấu
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-white uppercase tracking-tight font-sans">
            Bảng xếp hạng
          </h2>
          <p className="text-on-surface-variant text-base leading-relaxed font-sans">
            Bảng xếp hạng trong cuộc thi SEAL Hackathon sẽ được tổng hợp và công bố theo ba hình thức dưới đây:
          </p>
        </div>

        {/* Ranking Grid */}
        <div className="ranking-grid grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
          
          {/* Card 1: Chapter Ranking */}
          <div className="ranking-card border border-outline-variant/30 p-8 flex flex-col bg-[#0a141d]/85 rounded-none hover:border-cyan-500/40 transition-all duration-350 opacity-0">
            <div className="w-12 h-12 rounded-none border border-cyan-500/20 flex items-center justify-center mb-6 bg-cyan-950/10 text-cyan-400">
              <Award size={22} />
            </div>
            <h3 className="text-lg font-bold text-white mb-3 font-sans">Bảng xếp hạng Chapter</h3>
            <p className="text-on-surface-variant text-sm leading-relaxed font-sans">
              Đây là bảng xếp hạng tính điểm của các Team thuộc từng Chapter trong suốt cả năm, điểm số sẽ được cộng hoặc trừ dựa trên thành tích cao nhất của các Team, theo quy định của từng Chapter.
            </p>
          </div>

          {/* Card 2: Team Ranking */}
          <div className="ranking-card border border-outline-variant/30 p-8 flex flex-col bg-[#0a141d]/85 rounded-none hover:border-cyan-500/40 transition-all duration-350 opacity-0">
            <div className="w-12 h-12 rounded-none border border-cyan-500/20 flex items-center justify-center mb-6 bg-cyan-950/10 text-cyan-400">
              <Users size={22} />
            </div>
            <h3 className="text-lg font-bold text-white mb-3 font-sans">Bảng xếp hạng Team</h3>
            <p className="text-on-surface-variant text-sm leading-relaxed font-sans">
              Áp dụng cho từng Hackathon, bảng này phản ánh kết quả thi đấu của các Team trong kỳ thi đó, không cộng dồn điểm từ các Hackathon khác.
            </p>
          </div>

          {/* Card 3: Individual Ranking */}
          <div className="ranking-card border border-outline-variant/30 p-8 flex flex-col bg-[#0a141d]/85 rounded-none hover:border-cyan-500/40 transition-all duration-350 opacity-0">
            <div className="w-12 h-12 rounded-none border border-cyan-500/20 flex items-center justify-center mb-6 bg-cyan-950/10 text-cyan-400">
              <UserCheck size={22} />
            </div>
            <h3 className="text-lg font-bold text-white mb-3 font-sans">Bảng xếp hạng cá nhân</h3>
            <p className="text-on-surface-variant text-sm leading-relaxed font-sans">
              Tính điểm dựa trên kết quả của Team mà cá nhân tham gia trong mỗi Hackathon, điểm sẽ được ghi nhận và cộng dồn trong suốt năm để xét giải thưởng cá nhân.
            </p>
          </div>

        </div>

      </div>
    </section>
  );
}
