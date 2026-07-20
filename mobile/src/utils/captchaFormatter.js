/**
 * Normalizes and formats raw Captcha SVG strings from any backend (local or staging server)
 * into a clean, 100% mobile-compatible 160px x 48px SVG with perfectly aligned horizontal characters.
 */
export const formatCaptchaSvg = (rawSvg) => {
  if (!rawSvg || typeof rawSvg !== 'string') return '';

  try {
    // Extract text content from all <text> elements in the SVG string
    const textMatches = [...rawSvg.matchAll(/<text[^>]*>([\s\S]*?)<\/text>/gi)];
    const chars = textMatches.map(m => m[1].replace(/<[^>]+>/g, '').trim()).filter(Boolean);

    // If characters were extracted successfully
    if (chars.length > 0) {
      const width = 160;
      const height = 48;
      const hexColors = ['#c2410c', '#b45309', '#9a3412', '#ea580c', '#c2410c'];
      
      // 5 fixed starting x positions across 160px width
      const xPositions = [14, 44, 74, 104, 134];

      let charsSvg = '';
      for (let i = 0; i < chars.length; i++) {
        const x = xPositions[i] || (14 + i * 30);
        const color = hexColors[i % hexColors.length];
        charsSvg += `<text x="${x}" y="32" font-size="22" font-weight="bold" fill="${color}">${chars[i]}</text>`;
      }

      // Return a clean, standardized SVG string
      return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="background: #fff7ed; border: 1.5px solid #fed7aa; border-radius: 10px;">
        <line x1="8" y1="14" x2="152" y2="34" stroke="#fed7aa" stroke-width="1.5" />
        <line x1="12" y1="36" x2="148" y2="12" stroke="#fed7aa" stroke-width="1.5" />
        <circle cx="20" cy="12" r="1.5" fill="#fdba74" opacity="0.5" />
        <circle cx="80" cy="38" r="1.5" fill="#fdba74" opacity="0.5" />
        <circle cx="140" cy="14" r="1.5" fill="#fdba74" opacity="0.5" />
        ${charsSvg}
      </svg>`;
    }
  } catch (err) {
    console.error('Lỗi khi định dạng Captcha SVG:', err);
  }

  // Fallback: ensure viewBox is set if missing
  if (!rawSvg.includes('viewBox')) {
    return rawSvg.replace('<svg ', '<svg viewBox="0 0 160 48" ');
  }
  return rawSvg;
};
