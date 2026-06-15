import { useRef, useState, useEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import axios from 'axios';

gsap.registerPlugin(ScrollTrigger);

export default function Timeline() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeEvent, setActiveEvent] = useState<any>(null);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const res = await axios.get("http://localhost:5000/api/events");
        const events = res.data;
        const nonDraftEvents = events.filter((e: any) => e.status !== "draft");
        // Sort by createdAt descending to get the newest one
        const newest = nonDraftEvents.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] || null;
        setActiveEvent(newest);
      } catch (err) {
        console.error("Lỗi lấy lịch trình cuộc thi:", err);
      }
    };
    fetchEvents();
  }, []);

  const formatDateString = (dateStr: string | null | undefined) => {
    if (!dateStr) return "Chưa có thông báo";
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "Chưa có thông báo";
    
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    
    return `${hours}:${minutes} - ${day}/${month}/${year}`;
  };

  const formatEventDateRange = (startDateStr: string | null | undefined, endDateStr: string | null | undefined) => {
    if (!startDateStr) return "Chưa có thông báo";
    const startStr = formatDateString(startDateStr);
    if (startStr === "Chưa có thông báo") return "Chưa có thông báo";

    if (!endDateStr) {
      return `Bắt đầu từ ${startStr}`;
    }
    
    const endStr = formatDateString(endDateStr);
    if (endStr === "Chưa có thông báo") {
      return `Bắt đầu từ ${startStr}`;
    }

    return `Từ ${startStr} đến ${endStr}`;
  };

  const formatSingleDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return "Chưa có thông báo";
    const dateStrFormatted = formatDateString(dateStr);
    if (dateStrFormatted === "Chưa có thông báo") return "Chưa có thông báo";
    return `Bắt đầu từ ${dateStrFormatted}`;
  };

  useGSAP(() => {
    // 1. Title and Subtitle animation
    gsap.fromTo(
      [".timeline-title", ".timeline-subtitle"],
      { y: 30, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: 0.8,
        stagger: 0.15,
        ease: "power3.out",
        scrollTrigger: {
          trigger: ".timeline-header",
          start: "top 85%",
          toggleActions: "play none none reverse"
        }
      }
    );

    // 2. Vertical Line scrub animation
    gsap.fromTo(
      ".timeline-line",
      { scaleY: 0 },
      {
        scaleY: 1,
        ease: "none",
        scrollTrigger: {
          trigger: ".timeline-body",
          start: "top 75%",
          end: "bottom 75%",
          scrub: true,
        }
      }
    );

    // 3. Staggered reveal of each timeline phase row
    const rows = gsap.utils.toArray(".timeline-row") as HTMLElement[];
    rows.forEach((row) => {
      const left = row.querySelector(".timeline-left");
      const right = row.querySelector(".timeline-right");
      const node = row.querySelector(".timeline-node");

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: row,
          start: "top 80%",
          toggleActions: "play none none reverse"
        }
      });

      if (node) {
        tl.fromTo(
          node,
          { scale: 0, opacity: 0 },
          { scale: 1, opacity: 1, duration: 0.5, ease: "back.out(2)" }
        );
      }
      if (left) {
        tl.fromTo(
          left,
          { x: -30, opacity: 0 },
          { x: 0, opacity: 1, duration: 0.6, ease: "power3.out" },
          "-=0.3"
        );
      }
      if (right) {
        tl.fromTo(
          right,
          { x: 30, opacity: 0 },
          { x: 0, opacity: 1, duration: 0.6, ease: "power3.out" },
          "-=0.3"
        );
      }
    });
  }, { scope: containerRef });

  return (
    <section ref={containerRef} className="py-20" id="schedule">
      <div className="max-w-7xl mx-auto px-6">
        
        <div className="timeline-header text-center mb-16">
          <h2 className="timeline-title text-2xl sm:text-3xl font-extrabold text-primary-container uppercase tracking-widest font-sans opacity-0">
            Lịch trình Cuộc thi {activeEvent ? `- ${activeEvent.name}` : ''}
          </h2>
          <p className="timeline-subtitle font-mono text-xs text-on-surface-variant mt-2 opacity-0">
            CÁC_GIAI_ĐOẠN_THỰC_THI
          </p>
        </div>

        <div className="relative max-w-4xl mx-auto py-6 timeline-body">
          {/* Vertical Line */}
          <div className="timeline-line absolute left-1/2 top-0 bottom-0 w-px bg-primary-container/30 -translate-x-1/2 hidden md:block origin-top"></div>
          
          <div className="space-y-16 relative">
            
            {/* Phase 1 */}
            <div className="flex flex-col md:flex-row items-center gap-6 relative timeline-row py-6">
              <div className="md:w-1/2 md:text-right w-full timeline-left opacity-0">
                <h3 className="text-lg font-bold text-white font-sans">Mở đăng ký</h3>
                <p className="font-mono text-xs text-primary-container font-semibold mt-1">
                  {formatEventDateRange(activeEvent?.registrationOpen, activeEvent?.registrationClose || activeEvent?.contestStart)}
                </p>
              </div>
              <div className="timeline-node z-10 w-6 h-6 rounded-full bg-primary-container glow-cyan ring-4 ring-[#0a141d] border-4 border-surface shadow-[0_0_15px_#00f0ff] shrink-0 hidden md:block opacity-0"></div>
              <div className="md:w-1/2 w-full timeline-right opacity-0">
                <p className="text-on-surface-variant text-sm font-sans leading-relaxed">
                  Các đội thi thực hiện đăng ký tài khoản, liên kết thành viên nhóm và liên kết repository Github chính thức để chuẩn bị nhận nhiệm vụ.
                </p>
              </div>
            </div>

            {/* Phase 2 */}
            <div className="flex flex-col md:flex-row items-center gap-6 relative timeline-row py-6">
              <div className="md:w-1/2 md:text-right w-full order-1 md:order-none timeline-left opacity-0">
                <p className="text-on-surface-variant text-sm font-sans leading-relaxed">
                  Giai đoạn lập trình cường độ cao. Các đội thực hiện giải quyết yêu cầu dự án, liên tục push commit để AI tự động phân tích và đánh giá chất lượng mã nguồn.
                </p>
              </div>
              <div className="timeline-node z-10 w-6 h-6 rounded-full bg-primary-container glow-cyan ring-4 ring-[#0a141d] border-4 border-surface shadow-[0_0_15px_#00f0ff] shrink-0 hidden md:block opacity-0"></div>
              <div className="md:w-1/2 w-full order-none timeline-right opacity-0">
                <h3 className="text-lg font-bold text-white font-sans">Bắt đầu thi đấu</h3>
                <p className="font-mono text-xs text-primary-container font-semibold mt-1">
                  {formatEventDateRange(activeEvent?.contestStart, activeEvent?.contestEnd)}
                </p>
              </div>
            </div>

            {/* Phase 3 */}
            <div className="flex flex-col md:flex-row items-center gap-6 relative timeline-row py-6">
              <div className="md:w-1/2 md:text-right w-full timeline-left opacity-0">
                <h3 className="text-lg font-bold text-white font-sans">Kết thúc và tổng kết</h3>
                <p className="font-mono text-xs text-primary-container font-semibold mt-1">
                  {formatSingleDate(activeEvent?.contestEnd)}
                </p>
              </div>
              <div className="timeline-node z-10 w-6 h-6 rounded-full bg-primary-container glow-cyan ring-4 ring-[#0a141d] border-4 border-surface shadow-[0_0_15px_#00f0ff] shrink-0 hidden md:block opacity-0"></div>
              <div className="md:w-1/2 w-full timeline-right opacity-0">
                <p className="text-on-surface-variant text-sm font-sans leading-relaxed">
                  Dừng cổng nộp bài, đóng repository. Các đội thi chuẩn bị báo cáo dự án trước hội đồng giám khảo và nhận kết quả xếp hạng chung cuộc từ hệ thống.
                </p>
              </div>
            </div>

          </div>
        </div>

      </div>
    </section>
  );
}
