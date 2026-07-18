const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'seal_hackathon_secret_key_2026';

/**
 * Generates a random alphanumeric string of a given length.
 */
function generateRandomText(length = 5) {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjklmnpqrstuvwxyz'; // Exclude ambiguous characters like 1, l, 0, O
  let text = '';
  for (let i = 0; i < length; i++) {
    text += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return text;
}

/**
 * Generates a simple SVG captcha.
 */
function generateSvgCaptcha(text) {
  const width = 120;
  const height = 40;
  
  // Background lines
  let lines = '';
  for (let i = 0; i < 4; i++) {
    const x1 = Math.floor(Math.random() * width);
    const y1 = Math.floor(Math.random() * height);
    const x2 = Math.floor(Math.random() * width);
    const y2 = Math.floor(Math.random() * height);
    lines += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="rgba(242, 112, 36, 0.24)" stroke-width="1.5" />`;
  }

  // Background noise dots
  let dots = '';
  for (let i = 0; i < 30; i++) {
    const cx = Math.floor(Math.random() * width);
    const cy = Math.floor(Math.random() * height);
    const r = Math.random() * 1.5 + 0.5;
    dots += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="rgba(242, 112, 36, 0.18)" />`;
  }

  // Draw characters with random rotation, color, and font-size
  let charsSvg = '';
  const charWidth = width / (text.length + 1);
  for (let i = 0; i < text.length; i++) {
    const char = text.charAt(i);
    const x = (i + 0.5) * charWidth + (Math.random() * 5 - 2.5);
    const y = 26 + (Math.random() * 6 - 3);
    const angle = Math.floor(Math.random() * 30 - 15); // Rotate -15 to 15 deg
    const fontSize = Math.floor(Math.random() * 4 + 18); // Font size 18 to 22px
    
    // Orange range for the light FPT landing theme
    const hue = Math.floor(Math.random() * 18 + 18);
    const color = `hsl(${hue}, 88%, 45%)`;

    charsSvg += `
      <text 
        x="${x}" 
        y="${y}" 
        font-family="monospace, Courier, sans-serif" 
        font-weight="bold" 
        font-size="${fontSize}" 
        fill="${color}"
        transform="rotate(${angle} ${x} ${y})"
      >
        ${char}
      </text>
    `;
  }

  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" style="background: #fff7f2; border: 1px solid rgba(242, 112, 36, 0.3); border-radius: 8px; user-select: none;">
      ${lines}
      ${dots}
      ${charsSvg}
    </svg>
  `;
  return svg;
}

/**
 * Creates a captcha challenge: returns { captchaId, captchaSvg }
 */
function createCaptcha() {
  const text = generateRandomText(5);
  const captchaSvg = generateSvgCaptcha(text);
  
  // Encrypt the text into captchaId token (expires in 5 minutes)
  const captchaId = jwt.sign({ text: text }, JWT_SECRET, { expiresIn: '5m' });
  
  return { captchaId, captchaSvg };
}

/**
 * Verifies a captcha value against the captchaId
 */
function verifyCaptcha(captchaId, captchaValue) {
  if (!captchaId || !captchaValue) return false;
  try {
    const decoded = jwt.verify(captchaId, JWT_SECRET);
    return decoded.text === captchaValue.trim();
  } catch (err) {
    return false; // Token expired or invalid signature
  }
}

module.exports = {
  createCaptcha,
  verifyCaptcha
};
