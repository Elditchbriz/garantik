import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { sanityClient, BLOG_LIST_QUERY } from '../lib/sanityClient.js';
import '../styles/landing.css';

const categoryColors = {
  'droits-consommateurs': { bg: '#EEF2FF', color: '#4338CA', label: 'Droits consommateurs' },
  'guides-pratiques':     { bg: '#F0FDF4', color: '#15803D', label: 'Guides pratiques' },
  'actualites':           { bg: '#FFF7ED', color: '#C2410C', label: 'Actualités' },
  'garanties':            { bg: '#EFF6FF', color: '#1D4ED8', label: 'Garanties' },
};

function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function BlogListPage() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    sanityClient.fetch(BLOG_LIST_QUERY)
      .then(data => { setPosts(data || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const categories = [...new Set(posts.map(p => p.category).filter(Boolean))];
  const filtered = filter === 'all' ? posts : posts.filter(p => p.category === filter);
  const [featured, ...rest] = filtered;

  return (
    <div style={{ minHeight: '100vh', background: '#fff' }}>
      {/* Header */}
      <header className="lp-header" style={{ position: 'sticky', top: 0, zIndex: 100 }}>
        <div className="lp-header-inner">
          <Link to="/" className="lp-logo">
            <div className="mark" style={{ width: 32, height: 32 }}></div>
            <div className="word">Garantik</div>
          </Link>
          <nav className="lp-nav">
            <Link to="/">Accueil</Link>
            <Link to="/blog" style={{ color: 'var(--navy)', fontWeight: 600 }}>Blog</Link>
          </nav>
          <div className="lp-header-actions">
            <Link to="/auth" className="btn btn-ghost lp-btn-login">Se connecter</Link>
            <Link to="/auth?mode=signup" className="btn btn-primary lp-btn-signup">Essayer gratuitement</Link>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 960, margin: '0 auto', padding: '56px 24px 80px' }}>
        {/* Titre */}
        <div style={{ marginBottom: 40, textAlign: 'center' }}>
          <div style={{ display: 'inline-block', background: '#EEF2FF', color: '#4338CA', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', padding: '5px 12px', borderRadius: 99, marginBottom: 14 }}>
            Le blog Garantik
          </div>
          <h1 style={{ fontSize: 36, fontFamily: 'Fraunces, serif', color: 'var(--navy)', marginBottom: 12 }}>
            Vos droits. Vos garanties. Vos contrats.
          </h1>
          <p style={{ fontSize: 16, color: 'var(--ink-soft)', maxWidth: 560, margin: '0 auto' }}>
            Guides pratiques, législation consommateur et actualités pour mieux gérer vos achats et contrats au quotidien.
          </p>
        </div>

        {/* Filtres catégories */}
        {categories.length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 40 }}>
            <button onClick={() => setFilter('all')} style={{
              padding: '7px 16px', borderRadius: 99, border: '1px solid var(--line)', fontSize: 13.5, fontWeight: 600,
              background: filter === 'all' ? 'var(--navy)' : '#fff', color: filter === 'all' ? '#fff' : 'var(--ink-soft)',
              cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
            }}>Tous</button>
            {categories.map(cat => {
              const c = categoryColors[cat] || { bg: '#F8FAFC', color: 'var(--ink-soft)', label: cat };
              return (
                <button key={cat} onClick={() => setFilter(cat)} style={{
                  padding: '7px 16px', borderRadius: 99, border: '1px solid var(--line)', fontSize: 13.5, fontWeight: 600,
                  background: filter === cat ? c.bg : '#fff', color: filter === cat ? c.color : 'var(--ink-soft)',
                  cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                }}>{c.label}</button>
              );
            })}
          </div>
        )}

        {loading ? (
          <p style={{ textAlign: 'center', color: 'var(--ink-faint)', padding: 48 }}>Chargement…</p>
        ) : filtered.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--ink-faint)', padding: 48 }}>Aucun article pour le moment.</p>
        ) : (
          <>
            {/* Article mis en avant */}
            {featured && (
              <Link to={`/blog/${featured.slug?.current}`} style={{ textDecoration: 'none', display: 'block', marginBottom: 40 }}>
                <div style={{
                  display: 'grid', gridTemplateColumns: featured.mainImage ? '1fr 1fr' : '1fr',
                  gap: 32, background: 'var(--bg)', borderRadius: 16, overflow: 'hidden',
                  border: '1px solid var(--line)', transition: 'box-shadow 0.15s',
                }} onMouseEnter={e => e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,0.1)'}
                   onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}>
                  {featured.mainImage?.asset?.url && (
                    <img src={featured.mainImage.asset.url} alt={featured.title}
                      style={{ width: '100%', height: 280, objectFit: 'cover', display: 'block' }} />
                  )}
                  <div style={{ padding: '32px 28px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    {featured.category && categoryColors[featured.category] && (
                      <span style={{ ...categoryColors[featured.category], display: 'inline-block', fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', padding: '4px 10px', borderRadius: 99, marginBottom: 14, width: 'fit-content' }}>
                        {categoryColors[featured.category].label}
                      </span>
                    )}
                    <h2 style={{ fontSize: 22, fontFamily: 'Fraunces, serif', color: 'var(--navy)', marginBottom: 12, lineHeight: 1.25 }}>
                      {featured.title}
                    </h2>
                    {featured.excerpt && (
                      <p style={{ fontSize: 14.5, color: 'var(--ink-soft)', lineHeight: 1.6, marginBottom: 16 }}>
                        {featured.excerpt}
                      </p>
                    )}
                    <div style={{ fontSize: 12.5, color: 'var(--ink-faint)', display: 'flex', gap: 12 }}>
                      <span>{formatDate(featured.publishedAt)}</span>
                      {featured.estimatedReadingTime > 0 && <span>· {featured.estimatedReadingTime} min de lecture</span>}
                    </div>
                  </div>
                </div>
              </Link>
            )}

            {/* Grille d'articles */}
            {rest.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 24 }}>
                {rest.map(post => {
                  const cat = categoryColors[post.category];
                  return (
                    <Link key={post._id} to={`/blog/${post.slug?.current}`} style={{ textDecoration: 'none' }}>
                      <div style={{
                        background: '#fff', borderRadius: 12, border: '1px solid var(--line)',
                        overflow: 'hidden', height: '100%', transition: 'box-shadow 0.15s',
                      }} onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.08)'}
                         onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}>
                        {post.mainImage?.asset?.url && (
                          <img src={post.mainImage.asset.url} alt={post.title}
                            style={{ width: '100%', height: 160, objectFit: 'cover', display: 'block' }} />
                        )}
                        <div style={{ padding: '20px 18px' }}>
                          {cat && (
                            <span style={{ ...cat, display: 'inline-block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', padding: '3px 8px', borderRadius: 99, marginBottom: 10, width: 'fit-content' }}>
                              {cat.label}
                            </span>
                          )}
                          <h3 style={{ fontSize: 16, fontFamily: 'Fraunces, serif', color: 'var(--navy)', marginBottom: 8, lineHeight: 1.3 }}>
                            {post.title}
                          </h3>
                          {post.excerpt && (
                            <p style={{ fontSize: 13.5, color: 'var(--ink-soft)', lineHeight: 1.55, marginBottom: 12,
                              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                              {post.excerpt}
                            </p>
                          )}
                          <div style={{ fontSize: 12, color: 'var(--ink-faint)' }}>
                            {formatDate(post.publishedAt)}
                            {post.estimatedReadingTime > 0 && ` · ${post.estimatedReadingTime} min`}
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </>
        )}
      </main>

      {/* Footer simple */}
      <footer style={{ borderTop: '1px solid var(--line)', padding: '28px 24px', textAlign: 'center' }}>
        <p style={{ fontSize: 13, color: 'var(--ink-faint)' }}>
          © 2026 Garantik · <Link to="/" style={{ color: 'var(--blue)' }}>Retour à l'accueil</Link>
        </p>
      </footer>
    </div>
  );
}
