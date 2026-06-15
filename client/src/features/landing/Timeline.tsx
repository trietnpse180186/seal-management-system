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
        const current = events.find((e: any) => e.status === "ongoing") ||
                        events.find((e: any) => e.status === "registration") ||
                        events.find((e: any) => e.status === "completed") ||
                        events[0] || null;
        setActiveEvent(current);
      } catch (err) {
        console.error("Lỗi lấy lịch trình cuộc thi:", err);
      }
    };
    fetchEvents();
  }, []);

  const formatEventDateRange = (startDateStr: string | null, endDateStr: string | null, fallback: string) => {
    if (!startDateStr || !endDateStr) return fallback;
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return fallback;
    
    const startDay = start.getDate();
    const startMonth = start.getMonth() + 1;
    const endDay = end.getDate();
    const endMonth = end.getMonth() + 1;
    
    if (startMonth === endMonth) {
      return `Từ ${startDay.toString().padStart(2, '0')} đến ${endDay.toString().padStart(2, '0')} tháng ${startMonth}`;
    } else {
      return `Từ ${startDay.toString().padStart(2, '0')} tháng ${startMonth} đến ${endDay.toString().padStart(2, '0')} tháng ${endMonth}`;
    }
  };

  const formatSingleDate = (dateStr: string | null, fallback: string) => {
    if (!dateStr) return fallback;
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return fallback;
    return `${date.getDate().toString().padStart(2, '0')} tháng ${date.getMonth() + 1}`;
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
            Lịch trình Cuộc thi
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
                <h3 className="text-lg font-bold text-white font-sans">Hình thành Ý tưởng</h3>
                <p className="font-mono text-xs text-primary-container font-semibold mt-1">
                  {formatEventDateRange(activeEvent?.registrationOpen, activeEvent?.registrationClose || activeEvent?.contestStart, "Từ 01 đến 10 tháng 3")}
                </p>
              </div>
              <div className="timeline-node z-10 w-6 h-6 rounded-full bg-primary-container glow-cyan ring-4 ring-[#0a141d] border-4 border-surface shadow-[0_0_15px_#00f0ff] shrink-0 hidden md:block opacity-0"></div>
              <div className="md:w-1/2 w-full timeline-right opacity-0">
                <p className="text-on-surface-variant text-sm font-sans leading-relaxed">
                  Định hình ý tưởng và xác nhận thành viên đội thi. Nộp đề án dự án thông qua cổng đăng ký bảo mật.
                </p>
              </div>
            </div>

            {/* Phase 2 */}
            <div className="flex flex-col md:flex-row items-center gap-6 relative timeline-row py-6">
              <div className="md:w-1/2 md:text-right w-full order-1 md:order-none timeline-left opacity-0">
                <p className="text-on-surface-variant text-sm font-sans leading-relaxed">
                  Giai đoạn lập trình chính thức. Phát triển sản phẩm cường độ cao tại phòng máy FPT Campus.
                </p>
              </div>
              <div className="timeline-node z-10 w-6 h-6 rounded-full bg-primary-container glow-cyan ring-4 ring-[#0a141d] border-4 border-surface shadow-[0_0_15px_#00f0ff] shrink-0 hidden md:block opacity-0"></div>
              <div className="md:w-1/2 w-full order-none timeline-right opacity-0">
                <h3 className="text-lg font-bold text-white font-sans">Lập trình & Phát triển</h3>
                <p className="font-mono text-xs text-primary-container font-semibold mt-1">
                  {formatEventDateRange(activeEvent?.contestStart, activeEvent?.contestEnd, "Từ 15 đến 17 tháng 3")}
                </p>
              </div>
            </div>

            {/* Phase 3 */}
            <div className="flex flex-col md:flex-row items-center gap-6 relative timeline-row py-6">
              <div className="md:w-1/2 md:text-right w-full timeline-left opacity-0">
                <h3 className="text-lg font-bold text-white font-sans">Thuyết trình & Đánh giá</h3>
                <p className="font-mono text-xs text-primary-container font-semibold mt-1">
                  {formatSingleDate(activeEvent?.contestEnd, "20 tháng 3")}
                </p>
              </div>
              <div className="timeline-node z-10 w-6 h-6 rounded-full bg-primary-container glow-cyan ring-4 ring-[#0a141d] border-4 border-surface shadow-[0_0_15px_#00f0ff] shrink-0 hidden md:block opacity-0"></div>
              <div className="md:w-1/2 w-full timeline-right opacity-0">
                <p className="text-on-surface-variant text-sm font-sans leading-relaxed">
                  Thuyết trình demo sản phẩm trước Hội đồng Giám khảo. Công bố kết quả chung cuộc và trao giải thưởng.
                </p>
              </div>
            </div>

          </div>
        </div>

      </div>
    </section>
  );
}
