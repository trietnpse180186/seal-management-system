import Hero from './Hero';
import About from './About';
import Ranking from './Ranking';
import Timeline from './Timeline';
import Prizes from './Prizes';

interface LandingPageProps {
  user: any;
  roles: any[];
}

export default function LandingPage({ user, roles }: LandingPageProps) {
  return (
    <div className="relative overflow-hidden font-sans">
      
      {/* Background Grid & Glow */}
      <div className="absolute inset-0 pointer-events-none z-0 bg-[radial-gradient(circle_at_15%_15%,rgba(0,240,255,0.08)_0%,transparent_40%),radial-gradient(circle_at_85%_85%,rgba(0,240,255,0.05)_0%,transparent_40%)]"></div>

      <Hero user={user} roles={roles} />
      
      <About />

      <Ranking />

      <Timeline />

      <Prizes />

    </div>
  );
}

