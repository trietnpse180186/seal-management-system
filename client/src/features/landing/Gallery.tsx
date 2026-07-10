import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { X, Eye, AlertCircle, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { createPortal } from "react-dom";

interface Category {
  id: string;
  name: string;
  count: number;
}

interface Photo {
  id: string;
  name: string;
  size: string;
  category: string;
  url: string;
}

interface GalleryProps {
  user?: any;
  roles?: any[];
}

function useColumnsCount() {
  const [columns, setColumns] = useState(4);

  useEffect(() => {
    const updateColumns = () => {
      const width = window.innerWidth;
      if (width < 640) {
        setColumns(1);
      } else if (width < 768) {
        setColumns(2);
      } else if (width < 1024) {
        setColumns(3);
      } else {
        setColumns(4);
      }
    };

    updateColumns();
    window.addEventListener("resize", updateColumns);
    return () => window.removeEventListener("resize", updateColumns);
  }, []);

  return columns;
}

export default function Gallery({ user, roles }: GalleryProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [selectedCatId, setSelectedCatId] = useState<string>("all");
  const [loading, setLoading] = useState<boolean>(true);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [lightboxPhoto, setLightboxPhoto] = useState<Photo | null>(null);
  const [visibleCount, setVisibleCount] = useState<number>(16);

  const isSystemAdmin = user?.isSystemAdmin;
  const isCoordinator = !!isSystemAdmin || roles?.some((r) => r.role === "coordinator") || roles?.some((r) => r.role === "admin_view");

  const loadGalleryData = (showToast = false) => {
    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    if (showToast) {
      setSyncing(true);
      toast.loading("Đang đồng bộ: Đang chuẩn bị...", { id: "gallery-sync" });

      const eventSource = new EventSource(`${apiBase}/api/gallery/sync-progress`);

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.status === 'fetching') {
            toast.loading("Đang đồng bộ: Đang quét danh sách ảnh trên Drive...", { id: "gallery-sync" });
          } else if (data.status === 'syncing') {
            toast.loading(`Đang đồng bộ: Tải ảnh (${data.percent}%) [${data.current}/${data.total}]`, { id: "gallery-sync" });
          } else if (data.success) {
            toast.success(data.message || "Đồng bộ thành công!", { id: "gallery-sync" });
            eventSource.close();
            setSyncing(false);
            loadGalleryData(false); // Reload items from database
          } else {
            toast.error(data.message || "Đồng bộ thất bại.", { id: "gallery-sync" });
            eventSource.close();
            setSyncing(false);
          }
        } catch (err) {
          console.error("Failed to parse sync progress event:", err);
        }
      };

      eventSource.onerror = (err) => {
        console.error("EventSource failed:", err);
        toast.error("Lỗi kết nối thời gian thực khi đồng bộ.", { id: "gallery-sync" });
        eventSource.close();
        setSyncing(false);
      };
    } else {
      setLoading(true);
      axios
        .get(`${apiBase}/api/gallery`)
        .then((res) => {
          setCategories(res.data.categories || []);
          setPhotos(res.data.photos || []);
        })
        .catch((err) => {
          console.error("Failed to load photo album:", err);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  };

  useEffect(() => {
    loadGalleryData(false);
  }, []);

  useEffect(() => {
    setVisibleCount(16);
  }, [selectedCatId]);

  const totalPhotosCount = photos.length;

  const filteredPhotos = photos.filter((p) => {
    const matchesCat = selectedCatId === "all" || p.category === selectedCatId;
    return matchesCat;
  });

  const visiblePhotos = filteredPhotos.slice(0, visibleCount);

  const columnsCount = useColumnsCount();
  
  const columnsData: Photo[][] = Array.from({ length: columnsCount }, () => []);
  visiblePhotos.forEach((photo, idx) => {
    columnsData[idx % columnsCount].push(photo);
  });

  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (loading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && visibleCount < filteredPhotos.length) {
          // Preload next 16 images in background
          setVisibleCount((prev) => prev + 16);
        }
      },
      { threshold: 0.1 }
    );

    if (sentinelRef.current) {
      observer.observe(sentinelRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [loading, visibleCount, filteredPhotos.length]);

  const handlePrevPhoto = () => {
    if (!lightboxPhoto) return;
    const currentIndex = filteredPhotos.findIndex(p => p.id === lightboxPhoto.id);
    if (currentIndex > 0) {
      setLightboxPhoto(filteredPhotos[currentIndex - 1]);
    } else {
      setLightboxPhoto(filteredPhotos[filteredPhotos.length - 1]);
    }
  };

  const handleNextPhoto = () => {
    if (!lightboxPhoto) return;
    const currentIndex = filteredPhotos.findIndex(p => p.id === lightboxPhoto.id);
    if (currentIndex < filteredPhotos.length - 1) {
      setLightboxPhoto(filteredPhotos[currentIndex + 1]);
    } else {
      setLightboxPhoto(filteredPhotos[0]);
    }
  };

  useEffect(() => {
    if (!lightboxPhoto) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        handlePrevPhoto();
      } else if (e.key === "ArrowRight") {
        handleNextPhoto();
      } else if (e.key === "Escape") {
        setLightboxPhoto(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightboxPhoto, filteredPhotos]);

  const handleSync = () => {
    loadGalleryData(true);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8 min-h-screen">
      {/* Title Header Section */}
      <div>
        <h1 className="text-3xl font-extrabold text-white">
          <span className="text-cyan-400 text-cyan-glow font-mono-tech">ALBUM ẢNH CUỘC THI</span>
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Nơi lưu giữ các khoảnh khắc đáng nhớ của các đội thi trong khuôn khổ SEAL Hackathon.
        </p>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center bg-slate-950/40 p-4 rounded-2xl border border-slate-800 backdrop-blur-md">
        {/* Category Tabs */}
        <div className="flex flex-wrap gap-2 items-center">
          <button
            onClick={() => setSelectedCatId("all")}
            className={`px-4 py-2 rounded-xl text-xs font-mono font-bold uppercase transition-all duration-300 cursor-pointer ${
              selectedCatId === "all"
                ? "bg-cyan-500 text-white shadow-lg shadow-cyan-500/20"
                : "text-slate-400 hover:text-white bg-slate-900/50 hover:bg-slate-800/80 border border-slate-800/60"
            }`}
          >
            TẤT CẢ ({totalPhotosCount})
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCatId(cat.id)}
              className={`px-4 py-2 rounded-xl text-xs font-mono font-bold uppercase transition-all duration-300 cursor-pointer ${
                selectedCatId === cat.id
                  ? "bg-cyan-500 text-white shadow-lg shadow-cyan-500/20"
                  : "text-slate-400 hover:text-white bg-slate-900/50 hover:bg-slate-800/80 border border-slate-800/60"
              }`}
            >
              {cat.name} ({cat.count})
            </button>
          ))}
        </div>

        {/* Sync Actions (Admin/Coordinator Only) */}
        {isCoordinator && (
          <div className="flex items-center gap-3 w-full md:w-auto justify-end">
            <button
              onClick={handleSync}
              disabled={syncing || loading}
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-slate-300 hover:text-white rounded-xl text-xs font-mono font-bold transition-all border border-slate-800 cursor-pointer shadow-[0_0_10px_rgba(6,182,212,0.05)] active:scale-95"
              title="Đồng bộ lại hình ảnh từ Google Drive"
            >
              <RefreshCw size={14} className={syncing ? "animate-spin text-cyan-400" : ""} />
              <span>ĐỒNG BỘ</span>
            </button>
          </div>
        )}
      </div>

      {/* Loading state */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, idx) => (
            <div key={idx} className="bg-slate-900/30 border border-slate-850 rounded-2xl p-3 space-y-4 animate-pulse">
              <div className="aspect-video bg-slate-800/60 rounded-xl"></div>
              <div className="space-y-2">
                <div className="h-3 bg-slate-800/60 rounded w-2/3"></div>
                <div className="h-2 bg-slate-800/40 rounded w-1/3"></div>
              </div>
            </div>
          ))}
        </div>
      ) : filteredPhotos.length > 0 ? (
        /* Image Grid - Pinterest Masonry style */
        <>
          <div className="grid gap-6 animate-fadeIn" style={{ gridTemplateColumns: `repeat(${columnsCount}, minmax(0, 1fr))` }}>
            {columnsData.map((columnPhotos, colIdx) => (
              <div key={colIdx} className="flex flex-col gap-6">
                {columnPhotos.map((photo) => {
                  const globalIndex = visiblePhotos.findIndex(p => p.id === photo.id);
                  const isSentinel = globalIndex === visiblePhotos.length - 5 || (visiblePhotos.length < 5 && globalIndex === visiblePhotos.length - 1);
                  return (
                    <div
                      key={photo.id}
                      ref={isSentinel ? sentinelRef : null}
                      className="group bg-slate-900/20 hover:bg-slate-900/40 border border-slate-800/80 hover:border-slate-700 rounded-2xl p-3 flex flex-col justify-between transition-all duration-300 shadow-md hover:shadow-cyan-950/10"
                    >
                      {/* Photo Box */}
                      <div className="relative rounded-xl overflow-hidden bg-slate-950/30 border border-slate-800/50 group-hover:border-slate-700/50 transition-colors">
                        <img
                          src={photo.url}
                          alt={photo.name}
                          loading="lazy"
                          decoding="async"
                          className="w-full h-auto block rounded-xl transition-transform duration-500 group-hover:scale-102"
                        />
                        {/* Overlay actions */}
                        <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                          <button
                            onClick={() => setLightboxPhoto(photo)}
                            className="p-3 rounded-full bg-cyan-500 hover:bg-cyan-400 text-white transition-all transform scale-90 group-hover:scale-100 hover:scale-105 shadow-lg shadow-cyan-500/20 cursor-pointer"
                            title="Xem chi tiết"
                          >
                            <Eye size={18} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Infinite Scroll Sentinel */}
          {visibleCount < filteredPhotos.length && (
            <div ref={sentinelRef} className="flex justify-center items-center py-10 space-x-2">
              <RefreshCw size={16} className="animate-spin text-cyan-400" />
              <span className="text-xs font-mono text-slate-500 uppercase tracking-widest">Đang tải thêm ảnh...</span>
            </div>
          )}
        </>
      ) : (
        /* Empty State */
        <div className="text-center py-24 bg-slate-950/20 border border-slate-900/60 rounded-3xl">
          <AlertCircle size={40} className="mx-auto text-slate-600 mb-3" />
          <p className="text-sm font-semibold text-slate-400">Không tìm thấy ảnh nào phù hợp.</p>
        </div>
      )}

      {/* Lightbox / Details Modal */}
      {lightboxPhoto && createPortal(
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-md flex flex-col justify-between p-4 z-[9999] animate-fadeIn text-slate-300">
          {/* Top Bar */}
          <div className="flex justify-between items-center w-full max-w-6xl mx-auto py-2 z-10">
            <div className="font-mono text-left">
              <p className="text-sm font-bold text-white truncate max-w-md">{lightboxPhoto.name}</p>
              <p className="text-[10px] text-slate-400">{lightboxPhoto.size}</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setLightboxPhoto(null)}
                className="bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white p-2.5 rounded-xl border border-slate-800 transition-all cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Main Container with Prev/Next buttons */}
          <div className="flex-1 flex items-center justify-between max-w-6xl mx-auto w-full relative overflow-hidden p-4 gap-4">
            {/* Prev Button */}
            <button
              onClick={handlePrevPhoto}
              className="p-3.5 rounded-full bg-slate-900/60 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 hover:border-cyan-500/30 transition-all cursor-pointer shadow-lg active:scale-95 shrink-0"
              title="Ảnh trước"
            >
              <ChevronLeft size={24} />
            </button>

            {/* Image Box */}
            <div className="flex-1 h-full flex items-center justify-center max-h-[80vh]">
              <img
                src={lightboxPhoto.url}
                alt={lightboxPhoto.name}
                className="max-w-full max-h-full object-contain rounded-2xl border border-white/5 shadow-2xl animate-scaleUp"
              />
            </div>

            {/* Next Button */}
            <button
              onClick={handleNextPhoto}
              className="p-3.5 rounded-full bg-slate-900/60 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 hover:border-cyan-500/30 transition-all cursor-pointer shadow-lg active:scale-95 shrink-0"
              title="Ảnh sau"
            >
              <ChevronRight size={24} />
            </button>
          </div>

          {/* Bottom Bar Footer (Placeholder for spacing) */}
          <div className="py-2 opacity-0 select-none">Spacer</div>
        </div>,
        document.body
      )}
    </div>
  );
}
