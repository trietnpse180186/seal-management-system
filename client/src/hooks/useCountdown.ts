import { useState, useEffect } from 'react';

export function useCountdown(targetDate: Date | string | null | undefined) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    if (!targetDate) return;
    const interval = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  if (!targetDate) return { isFinished: true, text: '', diffMs: 0 };

  const target = new Date(targetDate);
  const diffMs = target.getTime() - now.getTime();
  const isFinished = diffMs <= 0;

  if (isFinished) {
    return { isFinished: true, text: 'Đã hết thời gian', diffMs: 0 };
  }

  const seconds = Math.floor((diffMs / 1000) % 60);
  const minutes = Math.floor((diffMs / (1000 * 60)) % 60);
  const hours = Math.floor((diffMs / (1000 * 60 * 60)) % 24);
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  const pad = (num: number) => num.toString().padStart(2, '0');
  const timeStr = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  const text = days > 0 ? `${days} ngày ${timeStr}` : timeStr;

  return { isFinished: false, text, diffMs, days, hours, minutes, seconds };
}
