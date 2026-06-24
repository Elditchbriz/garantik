import { createClient } from '@sanity/client';

export const sanityClient = createClient({
  projectId: 't02fj7um',
  dataset: 'production',
  useCdn: true,
  apiVersion: '2026-06-24',
});

// Construire l'URL d'une image Sanity
export function sanityImageUrl(ref) {
  if (!ref) return null;
  // Format ref: image-{id}-{width}x{height}-{format}
  const [, id, dimensions, format] = ref.split('-');
  return `https://cdn.sanity.io/images/t02fj7um/production/${id}-${dimensions}.${format}`;
}

// Requêtes GROQ
export const BLOG_LIST_QUERY = `
  *[_type == "post" && defined(slug.current)] | order(publishedAt desc) {
    _id,
    title,
    slug,
    publishedAt,
    excerpt,
    category,
    "estimatedReadingTime": round(length(pt::text(body)) / 5 / 180),
    mainImage { asset->{ _id, url } }
  }
`;

export const BLOG_POST_QUERY = `
  *[_type == "post" && slug.current == $slug][0] {
    _id,
    title,
    slug,
    publishedAt,
    excerpt,
    category,
    "estimatedReadingTime": round(length(pt::text(body)) / 5 / 180),
    mainImage { asset->{ _id, url } },
    body,
    seo
  }
`;
