import { useEffect, useState } from 'react';

// Hook: report approximate keyboard overlap (visual viewport) for mobile layouts
export function useKeyboardOffset(isMobile: boolean) {
  const [kbOffset, setKbOffset] = useState<number>(0);

  useEffect(() => {
    if (!isMobile) {
      setKbOffset(0);
      return;
    }

    const vv: any = (window as any).visualViewport;
    if (!vv) return;

    const update = () => {
      try {
        const overlap = Math.max(0, window.innerHeight - ((vv.height || 0) + (vv.offsetTop || 0)));
        setKbOffset(Math.round(overlap));
      } catch (e) {
        // ignore
      }
    };

    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    update();

    return () => {
      try { vv.removeEventListener('resize', update); vv.removeEventListener('scroll', update); } catch (e) {}
    };
  }, [isMobile]);

  return kbOffset;
}

export default useKeyboardOffset;
