import { useEffect, useState } from 'react';

/** Two screens are enough for a hash router: "#/" and "#/stories/<slug>". */
export type Route = { name: 'stories' } | { name: 'story'; slug: string };

function parse(hash: string): Route {
  const match = /^#\/stories\/([^/]+)$/.exec(hash);
  return match ? { name: 'story', slug: decodeURIComponent(match[1]!) } : { name: 'stories' };
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parse(window.location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parse(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

export const navigate = {
  stories: () => (window.location.hash = '#/'),
  story: (slug: string) => (window.location.hash = `#/stories/${encodeURIComponent(slug)}`),
};
