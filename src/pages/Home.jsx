import React from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';

export default function Home() {
  const { user, requests } = useApp();
  const getHelpHref = user ? '/post' : '/signup';
  const offerHelpHref = user ? '/board' : '/signup?role=expert';

  return (
    <section className="wrap" style={{ paddingTop: 64, paddingBottom: 64 }}>
      <div style={{ textAlign: 'center', maxWidth: 640, margin: '0 auto 44px' }}>
        <div className="eyebrow">WRITEMYWORDS</div>
        <h1 style={{ marginTop: 12 }}>What do you need today?</h1>
        <p className="lede" style={{ margin: '16px auto 0' }}>
          One account, two ways to use it. Pick whichever fits right now — you can switch anytime.
        </p>
      </div>

      <div className="grid grid-2" style={{ maxWidth: 760, margin: '0 auto' }}>
        <Link to={getHelpHref} className="card" style={{ padding: 32, textAlign: 'center' }}>
          <div style={{ fontSize: 30, marginBottom: 10 }}>📝</div>
          <h3 style={{ fontSize: 20 }}>Post your assignment</h3>
          <p className="muted" style={{ fontSize: 14.5, marginTop: 8 }}>
            Describe what you're stuck on, set a budget and deadline. Pay once you approve the help you get.
          </p>
          <span className="btn btn-primary" style={{ marginTop: 18 }}>Get Help</span>
        </Link>
        <Link to={offerHelpHref} className="card" style={{ padding: 32, textAlign: 'center' }}>
          <div style={{ fontSize: 30, marginBottom: 10 }}>🤝</div>
          <h3 style={{ fontSize: 20 }}>I will help</h3>
          <p className="muted" style={{ fontSize: 14.5, marginTop: 8 }}>
            Browse open requests, offer guidance and feedback, and get paid once the student approves it.
          </p>
          <span className="btn btn-ghost" style={{ marginTop: 18 }}>Offer Help</span>
        </Link>
      </div>

      {requests.length > 0 && (
        <p className="muted" style={{ textAlign: 'center', marginTop: 36, fontSize: 14 }}>
          {requests.length} request{requests.length === 1 ? '' : 's'} open right now.
        </p>
      )}
    </section>
  );
}
