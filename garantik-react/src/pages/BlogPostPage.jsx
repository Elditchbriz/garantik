import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { sanityClient, BLOG_POST_QUERY } from '../lib/sanityClient.js';
import { usePageMeta, articleMeta } from '../lib/seoMeta.js';
import { captureError } from '../lib/monitoring.js';
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

// Rendu minimaliste du Portable Text Sanity
function renderBlock(block, idx) {
  if (!block) return null;

  if (block._type === 'image') {
    const url = block.asset?.url;
    if (!url) return null;
    return <img key={idx} src={url} alt={block.alt || ''} style={{ width: '100%', borderRadius: 10, margin: '24px 0' }} />;
  }

  if (block._type !== 'block') return null;

  const style = block.style || 'normal';

  const renderSpan = (span, i) => {
    let text = span.text;
    const marks = span.marks || [];
    if (marks.includes('strong')) text = <strong key={i}>{text}</strong>;
    if (marks.includes('em')) text = <em key={i}>{text}</em>;
    if (marks.includes('code')) text = <code key={i} style={{ background: '#F1F5F9', padding: '2px 6px', borderRadius: 4, fontSize: '0.9em', fontFamily: 'monospace' }}>{text}</code>;
    return text;
  };

  const children = (block.children || []).map((span, i) => renderSpan(span, i));

  const prose = { color: 'var(--navy)', lineHeight: 1.75, marginBottom: 20 };

  switch (style) {
    case 'h2': return <h2 key={idx} style={{ ...prose, fontSize: 24, fontFamily: 'Fraunces, serif', marginTop: 40, marginBottom: 12 }}>{children}</h2>;
    case 'h3': return <h3 key={idx} style={{ ...prose, fontSize: 19, fontFamily: 'Fraunces, serif', marginTop: 28, marginBottom: 10 }}>{children}</h3>;
    case 'h4': return <h4 key={idx} style={{ ...prose, fontSize: 16, fontWeight: 700, marginTop: 20, marginBottom: 8 }}>{children}</h4>;
    case 'blockquote': return (
      <blockquote key={idx} style={{ borderLeft: '3px solid var(--blue)', paddingLeft: 20, margin: '24px 0', color: 'var(--ink-soft)', fontStyle: 'italic', fontSize: 16 }}>
        {children}
      </blockquote>
    );
    default: return <p key={idx} style={{ ...prose, fontSize: 16 }}>{children}</p>;
  }
}

function renderList(blocks) {
  const result = [];
  let i = 0;
  while (i < blocks.length) {
    const block = blocks[i];
    if (block.listItem === 'bullet') {
      const items = [];
      while (i < blocks.length && blocks[i].listItem === 'bullet') {
        items.push(<li key={i} style={{ fontSize: 16, lineHeight: 1.7, color: 'var(--navy)', marginBottom: 6 }}>
          {(blocks[i].children || []).map((s, j) => s.text)}
        </li>);
        i++;
      }
      result.push(<ul key={`ul-${i}`} style={{ paddingLeft: 24, margin: '16px 0 20px' }}>{items}</ul>);
    } else if (block.listItem === 'number') {
      const items = [];
      while (i < blocks.length && blocks[i].listItem === 'number') {
        items.push(<li key={i} style={{ fontSize: 16, lineHeight: 1.7, color: 'var(--navy)', marginBottom: 6 }}>
          {(blocks[i].children || []).map((s, j) => s.text)}
        </li>);
        i++;
      }
      result.push(<ol key={`ol-${i}`} style={{ paddingLeft: 24, margin: '16px 0 20px' }}>{items}</ol>);
    } else {
      result.push(renderBlock(block, i));
      i++;
    }
  }
  return result;
}

export default function BlogPostPage() {
  const { slug } = useParams();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);   // la requête a réussi mais l'article n'existe pas
  const [loadError, setLoadError] = useState(false);  // la requête a ÉCHOUÉ (panne, réseau, autorisation) : l'article existe peut-être
  const [attempt, setAttempt] = useState(0);

  // Titre, description et adresse canonique de l'article pour Google. Un article réellement introuvable porte « noindex » : sans cela, n'importe quelle
  // adresse /blog/xxx répondrait « 200 » et pourrait être indexée comme une page vide. Une simple ERREUR de chargement ne porte JAMAIS « noindex » :
  // une panne passagère ne doit pas faire retirer un article de Google.
  usePageMeta(notFound ? { title: 'Article introuvable | Hey Did', noindex: true } : articleMeta(post, slug));

  useEffect(() => {
    let alive = true;
    // Repartir d'un état propre à chaque article (sinon un « introuvable » précédent resterait affiché, et marquerait « noindex » un article valide)
    setLoading(true); setNotFound(false); setLoadError(false); setPost(null);
    sanityClient.fetch(BLOG_POST_QUERY, { slug })
      .then(data => {
        if (!alive) return;
        if (!data) setNotFound(true);
        else setPost(data);
        setLoading(false);
      })
      .catch((err) => {
        if (!alive) return;
        setLoadError(true); setLoading(false);
        captureError(err, { where: 'blog:article', extra: { slug } });   // avant : « Article introuvable », sans aucun signalement
      });
    return () => { alive = false; };
  }, [slug, attempt]);

  const cat = post?.category ? categoryColors[post.category] : null;

  return (
    <>

      <main style={{ maxWidth: 720, margin: '0 auto', padding: '48px 24px 80px' }}>
        <Link to="/blog" style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          fontSize: 13.5, color: 'var(--blue)', textDecoration: 'none',
          marginBottom: 32, fontWeight: 600, padding: '8px 14px',
          background: 'var(--blue-pale-2)', borderRadius: 'var(--radius-s)',
        }}>
          ← Retour au blog
        </Link>

        {loading && <p style={{ textAlign: 'center', color: 'var(--ink-faint)', padding: 48 }}>Chargement…</p>}

        {loadError && (
          <div style={{ textAlign: 'center', padding: 48 }}>
            <p style={{ fontSize: 18, color: 'var(--ink-soft)', marginBottom: 16 }}>Impossible de charger l'article pour le moment.</p>
            <button className="btn btn-primary" style={{ marginRight: 10 }} onClick={() => setAttempt((n) => n + 1)}>Réessayer</button>
            <Link to="/blog" className="btn btn-ghost">Retour au blog</Link>
          </div>
        )}

        {notFound && (
          <div style={{ textAlign: 'center', padding: 48 }}>
            <p style={{ fontSize: 18, color: 'var(--ink-soft)', marginBottom: 16 }}>Article introuvable.</p>
            <Link to="/blog" className="btn btn-primary">Retour au blog</Link>
          </div>
        )}

        {post && (
          <article>
            {/* Meta */}
            <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              {cat && (
                <span style={{ ...cat, display: 'inline-block', fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', padding: '4px 10px', borderRadius: 99 }}>
                  {cat.label}
                </span>
              )}
              <span style={{ fontSize: 13, color: 'var(--ink-faint)' }}>{formatDate(post.publishedAt)}</span>
              {post.estimatedReadingTime > 0 && (
                <span style={{ fontSize: 13, color: 'var(--ink-faint)' }}>· {post.estimatedReadingTime} min de lecture</span>
              )}
            </div>

            {/* Titre */}
            <h1 style={{ fontSize: 34, fontFamily: 'Fraunces, serif', color: 'var(--navy)', lineHeight: 1.2, marginBottom: 16 }}>
              {post.title}
            </h1>

            {/* Résumé */}
            {post.excerpt && (
              <p style={{ fontSize: 18, color: 'var(--ink-soft)', lineHeight: 1.6, marginBottom: 28, borderBottom: '1px solid var(--line)', paddingBottom: 28 }}>
                {post.excerpt}
              </p>
            )}

            {/* Image hero */}
            {post.mainImage?.asset?.url && (
              <img src={post.mainImage.asset.url} alt={post.title}
                style={{ width: '100%', borderRadius: 12, marginBottom: 36, maxHeight: 400, objectFit: 'cover' }} />
            )}

            {/* Corps */}
            <div>{post.body ? renderList(post.body) : null}</div>

            {/* CTA bas d'article */}
            <div style={{
              marginTop: 56, padding: '28px 24px', background: 'linear-gradient(135deg, var(--navy) 0%, var(--blue-dark) 100%)',
              borderRadius: 14, textAlign: 'center',
            }}>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', marginBottom: 8 }}>Ne laissez plus vos garanties expirer en silence</p>
              <h3 style={{ fontSize: 20, color: '#fff', fontFamily: 'Fraunces, serif', marginBottom: 16 }}>
                Essayez Hey Did gratuitement
              </h3>
              <Link to="/auth?mode=signup" className="btn btn-amber btn-lg">
                Commencer gratuitement →
              </Link>
            </div>
          </article>
        )}
      </main>
    </>
  );
}
