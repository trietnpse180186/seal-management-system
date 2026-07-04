import { useState, useRef, useEffect } from 'react';
import { ChevronDown, X, Loader2 } from 'lucide-react';
import axios from 'axios';

export interface University {
  name: string;
  short: string;
  aliases: string[];
}

// Curated list of major Vietnamese universities with common abbreviations and aliases for instant matching
const LOCAL_UNIVERSITIES: University[] = [
  { name: 'Trường Đại học FPT', short: 'FPT', aliases: ['FPT', 'FPT University', 'FU'] },
  { name: 'Đại học Bách Khoa Hà Nội', short: 'HUST', aliases: ['HUST', 'Bach Khoa Ha Noi', 'BKA', 'Bach Khoa'] },
  { name: 'Đại học Bách Khoa TP.HCM', short: 'HCMUT', aliases: ['HCMUT', 'Bach Khoa HCM', 'BK TP.HCM', 'Bach Khoa'] },
  { name: 'Trường Đại học Công nghệ thông tin - ĐHQG TP.HCM', short: 'UIT', aliases: ['UIT', 'CNTT', 'Cong nghe thong tin'] },
  { name: 'Trường Đại học Khoa học tự nhiên - ĐHQG TP.HCM', short: 'HCMUS', aliases: ['HCMUS', 'KHTN', 'Khoa hoc tu nhien'] },
  { name: 'Trường Đại học Công nghệ - ĐHQG Hà Nội', short: 'UET', aliases: ['UET', 'UET HNU', 'Cong nghe HN'] },
  { name: 'Trường Đại học Sư phạm Kỹ thuật TP.HCM', short: 'HCMUTE', aliases: ['HCMUTE', 'SPKT', 'Su pham Ky thuat'] },
  { name: 'Học viện Công nghệ Bưu chính Viễn thông', short: 'PTIT', aliases: ['PTIT', 'Buu chinh vien thong', 'Học viện Bưu chính'] },
  { name: 'Đại học Greenwich Việt Nam', short: 'Greenwich', aliases: ['Greenwich', 'GW', 'Greenwich VN'] },
  { name: 'Đại học Swinburne Việt Nam', short: 'Swinburne', aliases: ['Swinburne', 'SUT', 'Swinburne VN'] },
  { name: 'Trường Đại học Ngoại thương', short: 'FTU', aliases: ['FTU', 'Ngoai thuong'] },
  { name: 'Trường Đại học Kinh tế Quốc dân', short: 'NEU', aliases: ['NEU', 'Kinh te quoc dan'] },
  { name: 'Trường Đại học Công nghệ TP.HCM', short: 'HUTECH', aliases: ['HUTECH', 'DKC', 'Cong nghe TPHCM'] },
  { name: 'Trường Đại học Kinh tế TP.HCM', short: 'UEH', aliases: ['UEH', 'Kinh te TPHCM'] },
  { name: 'Trường Đại học Tôn Đức Thắng', short: 'TDTU', aliases: ['TDTU', 'TDT', 'Ton Duc Thang'] },
  { name: 'Trường Đại học RMIT Việt Nam', short: 'RMIT', aliases: ['RMIT', 'Dai hoc RMIT'] },
  { name: 'Trường Đại học Việt Đức', short: 'VGU', aliases: ['VGU', 'Viet Duc'] },
  { name: 'Đại học Quốc gia Hà Nội', short: 'VNU', aliases: ['VNU', 'ĐHQGHN'] },
  { name: 'Đại học Quốc gia TP.HCM', short: 'VNU-HCM', aliases: ['VNU-HCM', 'ĐHQGTPHCM'] },
  { name: 'Trường Đại học Khoa học và Công nghệ Hà Nội', short: 'USTH', aliases: ['USTH', 'Viet Phap', 'Vietnam France'] },
  { name: 'Học viện Kỹ thuật Mật mã', short: 'KMA', aliases: ['KMA', 'Mat ma', 'Ky thuat Mat ma'] },
  { name: 'Trường Đại học Thủy lợi', short: 'TLU', aliases: ['TLU', 'Thuy loi'] },
  { name: 'Trường Đại học Xây dựng Hà Nội', short: 'NUCE', aliases: ['NUCE', 'Xay dung', 'HUCE'] },
  { name: 'Trường Đại học Giao thông Vận tải', short: 'UTC', aliases: ['UTC', 'Giao thong van tai'] },
  { name: 'Học viện Hàng không Việt Nam', short: 'VAA', aliases: ['VAA', 'Hang khong'] },
  { name: 'Trường Đại học Công nghiệp TP.HCM', short: 'IUH', aliases: ['IUH', 'Cong nghiep TPHCM', 'Cong nghiep'] },
  { name: 'Trường Đại học Công nghiệp Hà Nội', short: 'HaUI', aliases: ['HaUI', 'Ha UI', 'HaUI'] },
  { name: 'Trường Đại học Cần Thơ', short: 'CTU', aliases: ['CTU', 'Can Tho'] },
  { name: 'Trường Đại học Duy Tân', short: 'DTU', aliases: ['DTU', 'Duy Tan'] },
  { name: 'Trường Đại học Văn Lang', short: 'VLU', aliases: ['VLU', 'Van Lang'] },
  { name: 'Trường Đại học Hoa Sen', short: 'HSU', aliases: ['HSU', 'Hoa Sen'] },
  { name: 'Trường Đại học Mở TP.HCM', short: 'OU', aliases: ['OU', 'Mo TPHCM', 'Dai hoc Mo'] },
  { name: 'Trường Đại học Ngoại ngữ - Tin học TP.HCM', short: 'HUFLIT', aliases: ['HUFLIT', 'Ngoai ngu Tin hoc'] },
  { name: 'Trường Đại học Quốc tế - ĐHQG TP.HCM', short: 'IU', aliases: ['IU', 'Quoc te', 'International University'] },
  { name: 'Trường Đại học Kinh tế - Luật - ĐHQG TP.HCM', short: 'UEL', aliases: ['UEL', 'Kinh te Luat'] },
  { name: 'Trường Đại học Khoa học Xã hội và Nhân văn - ĐHQG TP.HCM', short: 'USSH', aliases: ['USSH', 'Nhan van'] },
  { name: 'Trường Đại học Tài chính - Marketing', short: 'UFM', aliases: ['UFM', 'Tai chinh Marketing'] },
  { name: 'Trường Đại học Sài Gòn', short: 'SGU', aliases: ['SGU', 'Sai Gon'] },
  { name: 'Trường Đại học Sư phạm TP.HCM', short: 'HCMUE', aliases: ['HCMUE', 'Su pham TPHCM'] },
  { name: 'Học viện Ngân hàng', short: 'BA', aliases: ['BA', 'Ngan hang'] },
  { name: 'Trường Đại học Luật Hà Nội', short: 'HLU', aliases: ['HLU', 'Luat Ha Noi'] },
  { name: 'Trường Đại học Luật TP.HCM', short: 'ULS', aliases: ['ULS', 'Luat TPHCM'] },
  { name: 'Trường Đại học Y Hà Nội', short: 'HMU', aliases: ['HMU', 'Y Ha Noi'] },
  { name: 'Trường Đại học Y Dược TP.HCM', short: 'UMP', aliases: ['UMP', 'Y Duoc TPHCM'] },
  { name: 'Trường Đại học Phenikaa', short: 'PKA', aliases: ['PKA', 'Phenikaa'] },
  { name: 'Trường Đại học VinUniversity', short: 'VinUni', aliases: ['VinUni', 'VinUniversity'] },
  { name: 'Trường Đại học Fulbright Việt Nam', short: 'FUV', aliases: ['FUV', 'Fulbright'] },
];

// Helper to remove accents/diacritics for search matching
const removeAccents = (str: string): string => {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
};

// Global cache variable to avoid re-fetching when multiple comboboxes are rendered
let apiCachedUniversities: University[] | null = null;

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  inputClassName?: string;
}

export default function UniversityCombobox({
  value,
  onChange,
  placeholder = 'Nhập hoặc chọn tên trường...',
  className = '',
  disabled = false,
  inputClassName = '',
}: Props) {
  const [inputValue, setInputValue] = useState(value || '');
  const [isOpen, setIsOpen] = useState(false);
  const [universities, setUniversities] = useState<University[]>(LOCAL_UNIVERSITIES);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync external value -> internal input
  useEffect(() => {
    setInputValue(value || '');
  }, [value]);

  // Load universities from API & Cache
  useEffect(() => {
    if (apiCachedUniversities) {
      setUniversities(apiCachedUniversities);
      return;
    }

    let isSubscribed = true;
    setLoading(true);

    const fetchAllUniversities = async () => {
      try {
        // Query both variations of the country name from Hipolabs to get all entries (Viet Nam and Vietnam)
        // Using HTTPS to prevent mixed content blocking in production
        const [res1, res2] = await Promise.all([
          axios.get('https://universities.hipolabs.com/search?country=vietnam', { timeout: 8000 }),
          axios.get('https://universities.hipolabs.com/search?country=Viet%20Nam', { timeout: 8000 })
        ]);
        
        const rawList = [
          ...(Array.isArray(res1.data) ? res1.data : []),
          ...(Array.isArray(res2.data) ? res2.data : [])
        ];

        if (rawList.length > 0) {
          const apiList: University[] = rawList.map((item: any) => ({
            name: item.name,
            short: item.name,
            aliases: item.domains || [],
          }));

          // Merge local curated list and API list avoiding duplicates
          const merged: University[] = [...LOCAL_UNIVERSITIES];
          apiList.forEach((apiItem) => {
            const normalizedApiName = removeAccents(apiItem.name).toLowerCase();
            const exists = merged.some((localItem) => {
              const normalizedLocalName = removeAccents(localItem.name).toLowerCase();
              return normalizedLocalName === normalizedApiName || 
                     localItem.aliases.some(alias => removeAccents(alias).toLowerCase() === normalizedApiName);
            });
            
            if (!exists) {
              merged.push(apiItem);
            }
          });

          apiCachedUniversities = merged;
          if (isSubscribed) {
            setUniversities(merged);
          }
        }
      } catch (err) {
        console.warn('Could not fetch external universities list, falling back to local dataset.', err);
      } finally {
        if (isSubscribed) {
          setLoading(false);
        }
      }
    };

    fetchAllUniversities();

    return () => {
      isSubscribed = false;
    };
  }, []);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter logic using normalized accent-free matching + aliases support
  const query = removeAccents(inputValue.trim()).toLowerCase();
  
  const filtered = query
    ? universities.filter(u => {
        const nameMatch = removeAccents(u.name).toLowerCase().includes(query);
        const shortMatch = removeAccents(u.short).toLowerCase().includes(query);
        const aliasMatch = u.aliases.some(alias => 
          removeAccents(alias).toLowerCase().includes(query)
        );
        return nameMatch || shortMatch || aliasMatch;
      })
    : universities;

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    onChange(val);
    setIsOpen(true);
  };

  const handleSelect = (university: University) => {
    // Save/fill with the short name (e.g. HUTECH) if it is one of the local ones
    setInputValue(university.short);
    onChange(university.short);
    setIsOpen(false);
    inputRef.current?.blur();
  };

  const handleClear = () => {
    setInputValue('');
    onChange('');
    inputRef.current?.focus();
    setIsOpen(true);
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Input Field */}
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          type="text"
          disabled={disabled}
          value={inputValue}
          onChange={handleInput}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className={`w-full pr-16 bg-slate-900/50 border border-slate-800 text-white px-3 py-2 rounded-lg text-xs focus:outline-none focus:border-cyan-500/50 transition-all font-mono disabled:opacity-50 disabled:cursor-not-allowed ${inputClassName}`}
        />
        <div className="absolute right-2 flex items-center gap-1">
          {loading && (
            <Loader2 size={12} className="animate-spin text-slate-500" />
          )}
          {inputValue && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="text-slate-500 hover:text-slate-300 transition-colors cursor-pointer p-0.5"
              tabIndex={-1}
            >
              <X size={11} />
            </button>
          )}
          <button
            type="button"
            disabled={disabled}
            onClick={() => { setIsOpen(o => !o); inputRef.current?.focus(); }}
            className="text-slate-500 hover:text-slate-300 transition-colors cursor-pointer p-0.5 disabled:opacity-50"
            tabIndex={-1}
          >
            <ChevronDown
              size={13}
              className={`transition-transform duration-200 ${isOpen ? 'rotate-180 text-cyan-400' : ''}`}
            />
          </button>
        </div>
      </div>

      {/* Dropdown List */}
      {isOpen && (
        <div className="absolute z-[9999] left-0 mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg shadow-[0_12px_40px_rgba(0,0,0,0.85)] overflow-hidden animate-in fade-in slide-in-from-top-1 duration-100">
          <div className="max-h-60 overflow-y-auto p-1.5 space-y-1 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
            {filtered.length > 0 ? (
              filtered.map(u => {
                const isSelected = u.short === value || u.name === value;
                return (
                  <button
                    key={u.name}
                    type="button"
                    onMouseDown={e => { e.preventDefault(); handleSelect(u); }}
                    className={`w-full text-left px-3 py-2 rounded-md text-xs font-mono transition-all cursor-pointer flex flex-col justify-center gap-0.5 ${
                      isSelected
                        ? 'bg-cyan-500 text-slate-950 font-bold'
                        : 'text-white hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    {/* Primary acronym / short name */}
                    <span className="font-extrabold text-xs block leading-tight">
                      {u.short}
                    </span>
                    {/* Secondary full name in high-contrast text */}
                    {u.short !== u.name && (
                      <span className={`text-[9.5px] font-mono leading-normal block whitespace-normal break-words ${
                        isSelected ? 'text-slate-900/90' : 'text-slate-400'
                      }`}>
                        {u.name}
                      </span>
                    )}
                  </button>
                );
              })
            ) : (
              <div className="px-3 py-4 text-xs text-slate-400 font-mono italic text-center">
                Không tìm thấy trường này
              </div>
            )}
          </div>
          {inputValue.trim() && !universities.some(u => u.name.toLowerCase() === inputValue.trim().toLowerCase() || u.short.toLowerCase() === inputValue.trim().toLowerCase()) && (
            <div className="border-t border-slate-700 px-3 py-2.5 bg-slate-950">
              <p className="text-[10px] font-mono text-amber-300 flex items-center gap-1.5 leading-relaxed">
                <span>✎ Sẽ lưu tên tự nhập:</span>
                <span className="text-white font-bold bg-slate-900 px-1.5 py-0.5 rounded border border-slate-850">
                  {inputValue.trim()}
                </span>
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
