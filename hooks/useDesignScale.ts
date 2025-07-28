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

const useDesignScale = () => {
  useEffect(() => {
    const updateDesignScale = () => {
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      // Calculate scale based on viewport dimensions relative to 1920x1080
      const widthScale = viewportWidth / 1920;
      const heightScale = viewportHeight / 1080;
      
      // Use the smaller scale to ensure everything fits
      const scale = Math.min(widthScale, heightScale);
      
      // Set CSS custom property for design scale (used for images/videos)
      document.documentElement.style.setProperty('--design-scale', scale.toString());
      
      // Only apply viewport-based scaling on mobile/tablet devices (width < 1024px)
      const isMobileOrTablet = viewportWidth < 1024;
      if (isMobileOrTablet) {
        document.documentElement.style.setProperty('--viewport-scale', scale.toString());
      } else {
        // On desktop, use 1 (no scaling) to keep original pixel values
        document.documentElement.style.setProperty('--viewport-scale', '1');
      }
    };

    // Initial update
    updateDesignScale();

    // Update on resize
    window.addEventListener('resize', updateDesignScale);

    return () => {
      window.removeEventListener('resize', updateDesignScale);
    };
  }, []);
};

export default useDesignScale; 