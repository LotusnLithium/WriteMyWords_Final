import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';

export default function Nav() {
  const { user, logout, toast } = useApp();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  // Close mobile menu whenever the route changes
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  // Prevent background scroll when mobile menu is open
  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  async function handleLogout() {
    setMenuOpen(false);
    await logout();
    toast('Logged out successfully');
  }

  // Mobile Drawer Menu rendered directly on body via Portal to prevent any parent clipping
  const mobileMenuElement = menuOpen && typeof document !== 'undefined'
    ? createPortal(
        <div className="mobile-menu-overlay" onClick={() => setMenuOpen(false)}>
          <div className="mobile-menu-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="mobile-drawer-header">
              <div className="logo" style={{ fontSize: 20 }}>WriteMyWords</div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setMenuOpen(false)}
                style={{ padding: '6px 10px', fontSize: 16 }}
                aria-label="Close menu"
              >
                ✕
              </button>
            </div>

            {user && (
              <div className="mobile-user-profile-badge">
                <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--ink)' }}>
                  👤 {user.name || 'User'}
                </div>
                <div style={{ fontSize: 12.5, color: 'rgba(18,20,43,0.6)', marginTop: 2 }}>
                  {user.email} · <span className="badge" style={{ fontSize: 11, padding: '2px 8px' }}>{user.role === 'expert' ? 'Helper / Expert' : 'Student'}</span>
                </div>
              </div>
            )}

            <div className="mobile-menu-links">
              <Link to="/" className="mobile-nav-link" onClick={() => setMenuOpen(false)}>
                <span>🏠</span> Home
              </Link>
              {user && (
                <Link to="/dashboard" className="mobile-nav-link active-link-highlight" onClick={() => setMenuOpen(false)}>
                  <span>📊</span> <strong>Dashboard & My Projects</strong>
                </Link>
              )}
              <Link to="/board" className="mobile-nav-link" onClick={() => setMenuOpen(false)}>
                <span>📋</span> Browse Requests
              </Link>
              <Link to="/post" className="mobile-nav-link" onClick={() => setMenuOpen(false)}>
                <span>✍️</span> Post an Assignment
              </Link>
            </div>

            <div className="mobile-menu-actions">
              {user ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <Link to="/dashboard" className="btn btn-primary btn-block" onClick={() => setMenuOpen(false)}>
                    Open Dashboard
                  </Link>
                  <button type="button" className="btn btn-ghost btn-block" onClick={handleLogout} style={{ color: 'var(--error)', borderColor: 'rgba(217,85,85,0.25)' }}>
                    Log Out
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <Link to="/login" className="btn btn-ghost btn-block" onClick={() => setMenuOpen(false)}>
                    Log In
                  </Link>
                  <Link to="/signup" className="btn btn-primary btn-block" onClick={() => setMenuOpen(false)}>
                    Get Started / Sign Up
                  </Link>
                  <Link to="/signup?role=expert" className="btn btn-ghost btn-block" onClick={() => setMenuOpen(false)} style={{ fontSize: 13.5 }}>
                    🤝 Become a Helper / Expert
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )
    : null;

  return (
    <>
      <header className="nav">
        <div className="wrap nav-row">
          <Link to="/" className="logo" onClick={() => setMenuOpen(false)}>
            WriteMyWords
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="nav-links desktop-only" aria-label="Main Navigation">
            <Link to="/board">Browse Requests</Link>
            <Link to="/post">Post Request</Link>
            {user && <Link to="/dashboard">Dashboard</Link>}
          </nav>

          {/* Desktop Auth Buttons */}
          <div className="nav-right desktop-only">
            {user ? (
              <>
                <Link to="/dashboard" className="btn btn-ghost btn-sm">Dashboard</Link>
                <button type="button" className="btn btn-ghost btn-sm" onClick={handleLogout}>Log Out</button>
              </>
            ) : (
              <>
                <Link to="/login" className="btn btn-ghost btn-sm">Log In</Link>
                <Link to="/signup" className="btn btn-primary btn-sm">Get Started</Link>
              </>
            )}
          </div>

          {/* Mobile Right Controls: Quick Dashboard Button + Hamburger */}
          <div className="mobile-only" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {user ? (
              <Link to="/dashboard" className="btn btn-ghost btn-sm" style={{ padding: '7px 12px', fontSize: 13, fontWeight: 600 }}>
                📊 Dashboard
              </Link>
            ) : (
              <Link to="/login" className="btn btn-ghost btn-sm" style={{ padding: '7px 12px', fontSize: 13 }}>
                Log In
              </Link>
            )}

            <button
              type="button"
              className="mobile-nav-toggle"
              onClick={() => setMenuOpen((o) => !o)}
              aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={menuOpen}
            >
              {menuOpen ? (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              ) : (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="3" y1="6" x2="21" y2="6"></line>
                  <line x1="3" y1="12" x2="21" y2="12"></line>
                  <line x1="3" y1="18" x2="21" y2="18"></line>
                </svg>
              )}
            </button>
          </div>
        </div>
      </header>

      {mobileMenuElement}
    </>
  );
}

