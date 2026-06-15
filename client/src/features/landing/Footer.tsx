export default function Footer() {
  return (
    <footer className="bg-surface-dim border-t border-outline-variant/20 w-full z-20 relative py-8">
      <div className="flex flex-col md:flex-row justify-between items-center w-full px-6 gap-6 max-w-7xl mx-auto">
        <div className="flex flex-col gap-1 items-center md:items-start">
          <span className="font-mono text-sm font-bold text-primary-container">SEAL_HACKATHON</span>
          <p className="font-mono text-[10px] text-on-surface-variant/60">
            [SYSTEM_READY] &copy; 2026 SEAL_HACKATHON. ALL_RIGHTS_RESERVED.
          </p>
        </div>
        <div className="flex gap-6">
          <a className="text-on-surface-variant font-mono text-xs hover:text-primary-container transition-colors duration-300" href="#">Twitter</a>
          <a className="text-on-surface-variant font-mono text-xs hover:text-primary-container transition-colors duration-300" href="#">Discord</a>
          <a className="text-on-surface-variant font-mono text-xs hover:text-primary-container transition-colors duration-300" href="#">GitHub</a>
          <a className="text-on-surface-variant font-mono text-xs hover:text-primary-container transition-colors duration-300" href="#">Liên hệ</a>
        </div>
        <div className="flex items-center gap-2 grayscale hover:grayscale-0 transition-all opacity-60 hover:opacity-100">
          <span className="font-mono text-[10px] text-on-surface-variant">Powered by</span>
          <img 
            alt="FPT Logo" 
            className="h-6" 
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuA0ukfxwc8FgcysdSwMgh_t5oquEiuxsd6a-ryK49Xgt7TP7fuPqXgKK0uczmAIQMsp8VZMv45NK9-LmrXXFvMaAIKw2_l9qXiNYmvB2JgRW5DBPmY3sWC7iWY8yP5efLSwLZPzvc3mzsrMICWxC6efsJxJ03b7i_4nof1JXaGjSBwVRpAdAUMGQaKvdjoz09vA4T98f9Fyu0FhcTf-3TJhao0_FemyvDagDgWKCITtRE_VHpX1JEVHXuj_11r5R_BWg6dc8VKkF3Gw"
          />
        </div>
      </div>
    </footer>
  );
}
