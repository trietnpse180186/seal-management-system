import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { Image as ImageIcon, Search, Download, X, Eye, AlertCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";

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

export default function Gallery() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [selectedCatId, setSelectedCatId] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [lightboxPhoto, setLightboxPhoto] = useState<Photo | null>(null);
  const [visibleCount, setVisibleCount] = useState<number>(16);

  const loadGalleryData = (showToast = false) => {
    if (showToast) {
      setSyncing(true);
      toast.loading("Đang đồng bộ: Đang chuẩn bị...", { id: "gallery-sync" });

      const eventSource = new EventSource("http://localhost:5000/api/gallery/sync-progress");

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
        .get("http://localhost:5000/api/gallery")
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
  }, [selectedCatId, searchQuery]);

  const totalPhotosCount = photos.length;

  const filteredPhotos = photos.filter((p) => {
    const matchesCat = selectedCatId === "all" || p.category === selectedCatId;
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const visiblePhotos = filteredPhotos.slice(0, visibleCount);

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

  const handleSync = () => {
    loadGalleryData(true);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-12 space-y-10 min-h-screen">
      {/* Title Header Section */}
      <div className="space-y-3">
        <h1 className="text-4xl font-extrabold text-white tracking-tight">
          <span className="text-cyan-400 text-cyan-glow font-mono-tech">ALBUM ẢNH CUỘC THI</span>
        </h1>
        <p className="text-sm text-slate-400 font-sans max-w-2xl leading-relaxed">
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

        {/* Search & Sync Actions */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          {/* Search */}
          <div className="relative min-w-[240px] flex-1 md:flex-initial">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Tìm kiếm ảnh, tên file..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-900/60 hover:bg-slate-900 border border-slate-800 focus:border-cyan-500/50 focus:outline-none rounded-xl text-xs text-white placeholder-slate-500 transition-all font-mono"
            />
          </div>

          {/* Sync Button */}
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
        /* Image Grid */
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 animate-fadeIn">
            {visiblePhotos.map((photo, index) => {
              const isSentinel = index === visiblePhotos.length - 5 || (visiblePhotos.length < 5 && index === visiblePhotos.length - 1);
              return (
                <div
                  key={photo.id}
                  ref={isSentinel ? sentinelRef : null}
                  className="group bg-slate-900/20 hover:bg-slate-900/40 border border-slate-800/80 hover:border-slate-700 rounded-2xl p-3 flex flex-col justify-between transition-all duration-300 shadow-md hover:shadow-cyan-950/10"
                >
                  {/* Photo Box */}
                  <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-slate-950 flex items-center justify-center border border-slate-800/50 group-hover:border-slate-700/50 transition-colors">
                    {/* Loader placeholder behind image */}
                    <div className="absolute inset-0 bg-slate-900/40 animate-pulse flex items-center justify-center">
                      <ImageIcon className="text-slate-700" size={24} />
                    </div>
                    <img
                      src={photo.url}
                      alt={photo.name}
                      loading="eager"
                      decoding="async"
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    {/* Overlay actions */}
                    <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-3">
                      <button
                        onClick={() => setLightboxPhoto(photo)}
                        className="p-2.5 rounded-full bg-cyan-500 hover:bg-cyan-400 text-white transition-all transform scale-90 group-hover:scale-100 hover:scale-105 shadow-lg shadow-cyan-500/20 cursor-pointer"
                        title="Xem chi tiết"
                      >
                        <Eye size={16} />
                      </button>
                      <a
                        href={`https://drive.google.com/uc?export=download&id=${photo.id}`}
                        download={photo.name}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white transition-all transform scale-90 group-hover:scale-100 hover:scale-105 border border-white/5 shadow-lg cursor-pointer"
                        title="Tải ảnh về"
                      >
                        <Download size={16} />
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
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
          <p className="text-xs text-slate-650 mt-1">Hãy thử đổi danh mục hoặc từ khóa tìm kiếm.</p>
        </div>
      )}

      {/* Lightbox / Details Modal */}
      {lightboxPhoto && (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-md flex flex-col justify-between p-4 z-50 animate-fadeIn">
          {/* Top Bar */}
          <div className="flex justify-between items-center w-full max-w-6xl mx-auto py-2">
            <div className="font-mono text-left">
              <p className="text-sm font-bold text-white truncate max-w-md">{lightboxPhoto.name}</p>
              <p className="text-[10px] text-slate-400">{lightboxPhoto.size}</p>
            </div>
            <div className="flex items-center gap-3">
              <a
                href={`https://drive.google.com/uc?export=download&id=${lightboxPhoto.id}`}
                download={lightboxPhoto.name}
                target="_blank"
                rel="noreferrer"
                className="bg-cyan-500 hover:bg-cyan-400 text-white px-4 py-2 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 transition-all active:scale-95 shadow-lg shadow-cyan-500/20 cursor-pointer"
              >
                <Download size={14} />
                Tải ảnh
              </a>
              <button
                onClick={() => setLightboxPhoto(null)}
                className="bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white p-2.5 rounded-xl border border-slate-800 transition-all cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Image Container */}
          <div className="flex-1 flex items-center justify-center max-w-5xl mx-auto w-full overflow-hidden p-4">
            <img
              src={lightboxPhoto.url}
              alt={lightboxPhoto.name}
              className="max-w-full max-h-full object-contain rounded-2xl border border-white/5 shadow-2xl animate-scaleUp"
            />
          </div>

          {/* Bottom Bar Footer (Placeholder for spacing) */}
          <div className="py-2 opacity-0 select-none">Spacer</div>
        </div>
      )}
    </div>
  );
}
