import React from 'react';
import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer>
      <div className="wrap" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', justifyContent: 'center', fontSize: 13.5 }}>
          <Link to="/" style={{ color: 'rgba(18,20,43,0.7)' }}>Home</Link>
          <Link to="/board" style={{ color: 'rgba(18,20,43,0.7)' }}>Open Requests</Link>
          <Link to="/post" style={{ color: 'rgba(18,20,43,0.7)' }}>Post Request</Link>
          <Link to="/signup?role=expert" style={{ color: 'rgba(18,20,43,0.7)' }}>Become an Expert</Link>
          <Link to="/admin" style={{ color: '#4338ca', fontWeight: 600 }}>Admin Operations Portal</Link>
        </div>
        <div style={{ fontSize: 13, color: 'rgba(18,20,43,0.5)' }}>
          © {new Date().getFullYear()} WriteMyWords. All rights reserved.
        </div>
      </div>
    </footer>
  );
}

