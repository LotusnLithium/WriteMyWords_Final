import React from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { IconEdit, IconHandshake } from '../components/Icons.jsx';

export default function Home() {
  const { user, requests } = useApp();
  const getHelpHref = user ? '/post' : '/signup';
  const offerHelpHref = user ? '/board' : '/signup?role=expert';

  return (
    <section className="wrap" style={{ paddingTop: 'clamp(28px, 6vw, 64px)', paddingBottom: 'clamp(36px, 6vw, 64px)' }}>
      <div style={{ textAlign: 'center', maxWidth: 640, margin: '0 auto 36px', padding: '0 8px' }}>
        <div className="eyebrow">WRITEMYWORDS</div>
        <h1 style={{ marginTop: 12 }}>What do you need today?</h1>
        <p className="lede" style={{ margin: '14px auto 0' }}>
          One account, two ways to use it. Pick whichever fits right now — you can switch anytime.
        </p>
      </div>

      <div className="grid grid-2" style={{ maxWidth: 760, margin: '0 auto' }}>
        <Link to={getHelpHref} className="card home-choice-card" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', padding: '32px 24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--soft-blue)', color: 'var(--blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <IconEdit size={26} color="var(--blue)" />
            </div>
            <h2 style={{ fontSize: 21, fontWeight: 700 }}>Post your assignment</h2>
            <p className="muted" style={{ fontSize: 14.5, marginTop: 8, lineHeight: 1.55 }}>
              Post your assignment, project, presentation or journal brief, and set your payment amount. Pay only after you approve the work.
            </p>
          </div>
          <span className="btn btn-primary btn-block" style={{ marginTop: 22 }}>
            Get Help
          </span>
        </Link>

        <Link to={offerHelpHref} className="card home-choice-card" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', padding: '32px 24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(47, 143, 104, 0.12)', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <IconHandshake size={26} color="var(--success)" />
            </div>
            <h2 style={{ fontSize: 21, fontWeight: 700 }}>I will help</h2>
            <p className="muted" style={{ fontSize: 14.5, marginTop: 8, lineHeight: 1.55 }}>
              Browse open student requests, offer solutions and Word documents, and get paid securely upon approval.
            </p>
          </div>
          <span className="btn btn-ghost btn-block" style={{ marginTop: 22 }}>
            Offer Help
          </span>
        </Link>
      </div>

      {requests.length > 0 && (
        <p className="muted" style={{ textAlign: 'center', marginTop: 32, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'var(--success)' }}></span>
          <span><strong>{requests.length}</strong> request{requests.length === 1 ? '' : 's'} open for help right now.</span>
        </p>
      )}
    </section>
  );
}

