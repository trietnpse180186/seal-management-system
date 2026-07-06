import { useState, useEffect, useRef } from 'react';
import axios from 'axios';

interface GithubUserAutocompleteProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export default function GithubUserAutocomplete({
  value,
  onChange,
  placeholder = "Nhập github-username",
  className = "",
  disabled = false
}: GithubUserAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Debounced search
  useEffect(() => {
    if (!value || value.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`http://localhost:5000/api/github-repositories/search-users?q=${encodeURIComponent(value.trim())}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setSuggestions(res.data || []);
        setIsOpen(res.data && res.data.length > 0);
      } catch (err) {
        console.error('Failed to search github users:', err);
      } finally {
        setLoading(false);
      }
    }, 450);

    return () => clearTimeout(delayDebounce);
  }, [value]);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (username: string) => {
    onChange(username);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="relative flex items-center">
        <input
          type="text"
          disabled={disabled}
          value={value}
          onChange={e => {
            onChange(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => {
            if (suggestions.length > 0) setIsOpen(true);
          }}
          className={`${className} w-full`}
          placeholder={placeholder}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-cyan-400"></div>
          </div>
        )}
      </div>

      {isOpen && suggestions.length > 0 && (
        <div className="absolute z-50 left-0 w-full mt-1.5 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl max-h-48 overflow-y-auto font-sans text-xs">
          <div className="p-1.5 space-y-0.5">
            {suggestions.map((u: any) => (
              <button
                key={u.username}
                type="button"
                onClick={() => handleSelect(u.username)}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-left rounded-lg text-slate-300 hover:text-white hover:bg-cyan-500/10 hover:border-cyan-500/30 border border-transparent transition-all"
              >
                <img
                  src={u.avatarUrl}
                  alt={u.username}
                  className="w-5 h-5 rounded-full border border-slate-700"
                />
                <span className="font-mono font-semibold">{u.username}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
