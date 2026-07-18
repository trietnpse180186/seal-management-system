import { useEffect } from 'react';
import Hero from './Hero';
import About from './About';
import Timeline from './Timeline';
import Prizes from './Prizes';

interface LandingPageProps {
  user: any;
  roles: any[];
}

export default function LandingPage({ user, roles }: LandingPageProps) {
  useEffect(() => {
    if (window.location.hash === '#schedule') {
      const element = document.getElementById('schedule');
      if (element) {
        setTimeout(() => {
          element.scrollIntoView({ behavior: 'smooth' });
        }, 300);
      }
    }
  }, []);

  return (
    <div className="relative overflow-hidden font-sans bg-slate-50 text-slate-900">

      {/* Background Grid & Glow */}
      <div className="absolute inset-0 pointer-events-none z-0 bg-[radial-gradient(circle_at_15%_15%,rgba(242,112,36,0.08)_0%,transparent_40%),radial-gradient(circle_at_85%_85%,rgba(242,112,36,0.05)_0%,transparent_40%)]"></div>

      <Hero user={user} roles={roles} />

      <About />

      <Timeline />

      <Prizes />

    </div>
  );
}

