import { Outlet, Link, useLocation } from 'react-router-dom';
import { useTheme } from '../../hooks/useTheme';
import AIAssistant from './AIAssistant';

const navItems = [
  { to: '/', label: 'Dashboard', icon: 'grid' },
  { to: '/wells', label: 'Wells', icon: 'target' },
  { to: '/events', label: 'Events', icon: 'activity' },
  { to: '/documents', label: 'Documents', icon: 'file' },
];

function NavIcon({ type, isActive }) {
  const cls = `w-[18px] h-[18px] ${isActive ? 'text-foreground' : 'text-dim'}`;
  switch (type) {
    case 'grid':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
      );
    case 'target':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="5" />
          <circle cx="12" cy="12" r="1" fill="currentColor" />
        </svg>
      );
    case 'activity':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="22,12 18,12 15,21 9,3 6,12 2,12" />
        </svg>
      );
    case 'file':
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14,2 14,8 20,8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
      );
    default:
      return null;
  }
}

function ThemeToggleIcon({ theme }) {
  if (theme === 'dark') {
    return (
      <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="5" />
        <line x1="12" y1="1" x2="12" y2="3" />
        <line x1="12" y1="21" x2="12" y2="23" />
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
        <line x1="1" y1="12" x2="3" y2="12" />
        <line x1="21" y1="12" x2="23" y2="12" />
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
      </svg>
    );
  }
  return (
    <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

export default function Layout() {
  const location = useLocation();
  const [theme, toggleTheme] = useTheme();

  return (
    <div className="h-screen flex overflow-hidden">
      {/* ── Icon Sidebar ── */}
      <aside className="w-[52px] bg-panel border-r border-line flex flex-col items-center py-3 flex-shrink-0 z-50">
        {/* Logo */}
        <div className="mb-6 flex items-center justify-center w-8 h-8 rounded bg-background border border-line">
          <svg className="w-4 h-4 text-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
          </svg>
        </div>

        {/* Nav Icons */}
        <nav className="flex flex-col gap-1 flex-1">
          {navItems.map(item => {
            const isActive = location.pathname === item.to ||
              (item.to === '/' && location.pathname === '/');
            return (
              <Link
                key={item.to}
                to={item.to}
                title={item.label}
                className={`w-9 h-9 flex items-center justify-center rounded transition-colors ${
                  isActive
                    ? 'bg-background border border-line text-foreground'
                    : 'text-dim hover:text-foreground hover:bg-background/50'
                }`}
              >
                <NavIcon type={item.icon} isActive={isActive} />
              </Link>
            );
          })}
        </nav>

        {/* Theme Toggle at bottom */}
        <div className="mt-auto">
          <button
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            className="w-9 h-9 flex items-center justify-center rounded text-dim hover:text-foreground hover:bg-background/50 transition-colors"
          >
            <ThemeToggleIcon theme={theme} />
          </button>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <main className="flex-1 overflow-auto bg-background relative z-0">
        <div className="min-w-[1024px] min-h-[700px] h-full">
          <Outlet />
        </div>
      </main>

      {/* Global AI Assistant Widget */}
      <AIAssistant />
    </div>
  )
}
