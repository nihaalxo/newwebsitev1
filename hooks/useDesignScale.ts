import { useEffect } from 'react';

// Simple debounce function since we don't have lodash
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): T & { cancel: () => void } {
  let timeout: NodeJS.Timeout;
  
  const debounced = ((...args: any[]) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  }) as T & { cancel: () => void };
  
  debounced.cancel = () => clearTimeout(timeout);
  
  return debounced;
}

export default function useDesignScale() {
  useEffect(() => {
    const apply = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const scale = Math.min(vw / 1920, vh / 1080);
      console.log('design-scale =', scale, 'vw:', vw, 'vh:', vh);
      document.documentElement.style.setProperty('--design-scale', String(scale));
    };

    const debounced = debounce(apply, 50);
    window.addEventListener('resize', debounced);
    window.addEventListener('orientationchange', apply);
    apply();

    return () => {
      window.removeEventListener('resize', debounced);
      window.removeEventListener('orientationchange', apply);
      debounced.cancel();
    };
  }, []);
} 