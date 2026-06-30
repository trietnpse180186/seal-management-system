import { useRef } from 'react';
import { Cpu, Layers, Terminal } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(ScrollTrigger);

export default function About() {
  const containerRef = useRef<HTMLDivElement>(null);
  
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
