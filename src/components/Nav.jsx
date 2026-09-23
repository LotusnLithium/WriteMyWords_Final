import React, { useState, useEffect } from 'react';
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
    toast('Logged out');
  }

  return (
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
              <button className="btn btn-ghost btn-sm" onClick={handleLogout}>Log Out</button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn-ghost btn-sm">Log In</Link>
              <Link to="/signup" className="btn btn-primary btn-sm">Get Started</Link>
            </>
          )}
        </div>

        {/* Mobile Hamburger Button */}
        <button
          className="mobile-nav-toggle mobile-only"
          onClick={() => setMenuOpen((o) => !o)}
          aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={menuOpen}
        >
          {menuOpen ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          )}
        </button>
      </div>

      {/* Mobile Drawer / Dropdown Menu */}
      {menuOpen && (
        <div className="mobile-menu-overlay" onClick={() => setMenuOpen(false)}>
          <div className="mobile-menu-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="mobile-menu-links">
              <Link to="/" className="mobile-nav-link" onClick={() => setMenuOpen(false)}>
                🏠 Home
              </Link>
              <Link to="/board" className="mobile-nav-link" onClick={() => setMenuOpen(false)}>
                📋 Browse Requests
              </Link>
              <Link to="/post" className="mobile-nav-link" onClick={() => setMenuOpen(false)}>
                ✍️ Post a Request
              </Link>
              {user && (
                <Link to="/dashboard" className="mobile-nav-link" onClick={() => setMenuOpen(false)}>
                  📊 Dashboard
                </Link>
              )}
            </div>

            <div className="mobile-menu-actions">
              {user ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ fontSize: 13, color: 'rgba(18,20,43,0.6)', padding: '0 4px' }}>
                    Signed in as <strong style={{ color: 'var(--ink)' }}>{user.name || user.email}</strong>
                  </div>
                  <Link to="/dashboard" className="btn btn-ghost btn-block" onClick={() => setMenuOpen(false)}>
                    View Dashboard
                  </Link>
                  <button className="btn btn-primary btn-block" onClick={handleLogout}>
                    Log Out
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <Link to="/login" className="btn btn-ghost btn-block" onClick={() => setMenuOpen(false)}>
                    Log In
                  </Link>
                  <Link to="/signup" className="btn btn-primary btn-block" onClick={() => setMenuOpen(false)}>
                    Get Started
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
