import { useRef } from 'react';
import { Terminal } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(ScrollTrigger);

export default function About() {
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const iconRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (!cardRef.current || !iconRef.current) return;

    // Card entrance animation
    gsap.fromTo(
      cardRef.current,
      { y: 60, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: 1,
        ease: "power3.out",
        scrollTrigger: {
          trigger: cardRef.current,
          start: "top 85%", // Starts when top of card reaches 85% of screen height
          toggleActions: "play none none reverse",
        }
      }
    );

    // Stagger reveal of content inside the card
    gsap.fromTo(
      ".about-content > *",
      { y: 20, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: 0.8,
        ease: "power3.out",
        stagger: 0.15,
        scrollTrigger: {
          trigger: cardRef.current,
          start: "top 80%",
          toggleActions: "play none none reverse",
        }
      }
    );

    // Terminal icon rotation and scaling
    gsap.fromTo(
      iconRef.current,
      { scale: 0.5, rotate: -45, opacity: 0 },
      {
        scale: 1,
        rotate: 0,
        opacity: 1,
        duration: 1.2,
        ease: "back.out(1.7)",
        scrollTrigger: {
          trigger: cardRef.current,
          start: "top 75%",
          toggleActions: "play none none reverse",
        }
      }
    );
  }, { scope: containerRef });

  return (
    <section ref={containerRef} className="py-20 bg-surface-dim relative border-y border-outline-variant/10">
      <div className="max-w-7xl mx-auto px-6">
        <div ref={cardRef} className="border border-outline-variant/30 bg-surface-container p-8 md:p-12 relative overflow-hidden laser-scan-effect opacity-0">
          <div className="max-w-3xl space-y-4 about-content">
            <span className="font-mono text-xs text-primary-container uppercase tracking-widest block font-semibold opacity-0">
              Chủ đề Summer 2026
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-white uppercase tracking-tight font-sans opacity-0">
              AI-Driven Smart Operations
            </h2>
            <span className="font-mono text-[10px] text-cyan-400 block tracking-widest opacity-0 uppercase mb-2">
              Turning Real-Time IoT Data into Intelligent Actions
            </span>
            <p className="text-on-surface-variant text-base leading-relaxed font-sans opacity-0">
              SEAL Hackathon Summer 2026 là sân chơi công nghệ và trải nghiệm học thuật đỉnh cao, khuyến khích các sinh viên ngành CNTT từ Đại học FPT TP.HCM và các trường đại học khác phát triển các giải pháp IoT & AI đột phá. Các đội thi sẽ bốc thăm 1 trong 3 Track chuyên môn mật, xây dựng hệ thống AI để tiếp nhận, phân tích dữ liệu cảm biến thời gian thực, phát hiện bất thường và đề xuất hành động thông minh.
            </p>
          </div>
          <div ref={iconRef} className="absolute top-6 right-6 text-primary-container/20 hidden lg:block opacity-0">
            <Terminal size={72} />
          </div>
        </div>
      </div>
    </section>
  );
}
