// Lightweight route prefetch helper.
// Exposes a map of route -> dynamic import loader and a prefetch function.

type Loader = () => Promise<any>;

const routeLoaders: Record<string, Loader> = {
  '/create-character': () => import('../pages/CreateCharacter'),
  '/gallery': () => import('../pages/Gallery'),
  '/generate-image': () => import('../pages/GenerateImage'),
  '/my-ai': () => import('../pages/MyAI'),
  '/chat': () => import('../pages/Chat'),
  '/profile': () => import('../pages/Profile'),
  '/character-profile': () => import('../pages/CharacterProfile'),
  '/login': () => import('../pages/Login'),
  '/premium': () => import('../pages/Premium'),
};

export function prefetchRoute(path: string) {
  const loader = routeLoaders[path];
  if (!loader) return;
  try {
    // use requestIdleCallback when available
    const run = () => loader().catch(() => {});
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      (window as any).requestIdleCallback(run, { timeout: 1500 });
    } else {
      setTimeout(run, 800);
    }
  } catch (e) {}
}

export default prefetchRoute;
