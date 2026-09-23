import React from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';

export default function Nav() {
  const { user, logout, toast } = useApp();

  async function handleLogout() {
    await logout();
    toast('Logged out');
  }

  return (
    <header className="nav">
      <div className="wrap nav-row">
        <Link to="/" className="logo">WriteMyWords</Link>
        <div className="nav-right">
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
      </div>
    </header>
  );
}
