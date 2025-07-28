import { Fragment, useEffect, useState } from "react"; 
import Head from "next/head";
import type { AppProps } from "next/app";
import { useRouter } from "next/router";
import "./global.css";
import "./multidisciplinary.css";
import React from "react"; // Added missing import for React

// Create a global context for sound preference
export const SoundContext = React.createContext({
  soundEnabled: false,
  setSoundEnabled: (enabled: boolean) => {},
});

function MyApp({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionDirection, setTransitionDirection] = useState<'left' | 'right'>('right');
  const [showRotationPrompt, setShowRotationPrompt] = useState(false);
  const [showSoundPrompt, setShowSoundPrompt] = useState(false);
  const [isLandscape, setIsLandscape] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [hasUserChosen, setHasUserChosen] = useState(false);

  // Device orientation detection
  useEffect(() => {
    const checkOrientation = () => {
      const isMobile = window.innerWidth <= 1024; // Consider tablets and mobile as "mobile"
      const isPortrait = window.innerHeight > window.innerWidth;
      
      if (isMobile && isPortrait) {
        setShowRotationPrompt(true);
        setIsLandscape(false);
      } else {
        setShowRotationPrompt(false);
        setIsLandscape(true);
      }
    };

    // Check on mount
    checkOrientation();

    // Listen for orientation changes
    const handleOrientationChange = () => {
      setTimeout(checkOrientation, 100); // Small delay to ensure orientation is updated
    };

    // Listen for window resize
    const handleResize = () => {
      checkOrientation();
    };

    window.addEventListener('orientationchange', handleOrientationChange);
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('orientationchange', handleOrientationChange);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Show sound prompt after rotation check
  useEffect(() => {
    if (!showRotationPrompt && !showSoundPrompt && !hasUserChosen) {
      setShowSoundPrompt(true);
    }
  }, [showRotationPrompt, showSoundPrompt, hasUserChosen]);

  const handleSoundChoice = (withSound: boolean) => {
    setSoundEnabled(withSound);
    setShowSoundPrompt(false);
    setHasUserChosen(true);
  };

  useEffect(() => {
    const handleRouteChangeStart = (url: string) => {
      setIsTransitioning(true);
      // Determine transition direction based on route
      const currentPath = router.pathname;
      const nextPath = url;
      
      // Define the order of pages for transition direction
      const pageOrder = ['/', '/immersive', '/branding', '/multidisciplinary', '/uiux'];
      const currentIndex = pageOrder.indexOf(currentPath);
      const nextIndex = pageOrder.indexOf(nextPath);
      
      if (nextIndex > currentIndex || (currentIndex === pageOrder.length - 1 && nextIndex === 0)) {
        setTransitionDirection('right');
      } else {
        setTransitionDirection('left');
      }
    };

    const handleRouteChangeComplete = () => {
      setTimeout(() => {
        setIsTransitioning(false);
      }, 300); // Match the CSS transition duration
    };

    router.events.on('routeChangeStart', handleRouteChangeStart);
    router.events.on('routeChangeComplete', handleRouteChangeComplete);

    return () => {
      router.events.off('routeChangeStart', handleRouteChangeStart);
      router.events.off('routeChangeComplete', handleRouteChangeComplete);
    };
  }, [router]);

  // Show rotation prompt if needed
  if (showRotationPrompt) {
    return (
      <Fragment>
        <Head>
          <title>Please Rotate Your Device</title>
          <meta
            name="viewport"
            content="minimum-scale=1, initial-scale=1, width=device-width"
          />
        </Head>
        <div className="fixed inset-0 bg-black flex items-center justify-center z-50">
          <div className="text-center text-white p-8 max-w-md">
            <div className="mb-8">
              <svg 
                className="w-24 h-24 mx-auto mb-4 animate-pulse" 
                fill="currentColor" 
                viewBox="0 0 24 24"
              >
                <path d="M16.48 2.52c3.27 1.55 5.61 4.72 5.97 8.48h1.5C23.44 4.84 18.29 0 12 0l-.66.03 3.81 3.81 1.33-1.32zm-6.25-.77c-.59-.59-1.54-.59-2.12 0L1.75 8.11c-.59.59-.59 1.54 0 2.12l12.02 12.02c.59.59 1.54.59 2.12 0l6.36-6.36c.59-.59.59-1.54 0-2.12L10.23 1.75zm4.6 19.44L2.81 9.17l6.36-6.36 12.02 12.02-6.36 6.36z"/>
              </svg>
            </div>
            <h1 className="text-2xl font-bold mb-4 font-[Nasalization]">Please Rotate Your Device</h1>
            <p className="text-lg mb-6 font-[Gilmer]">
              This website is designed for landscape orientation. 
              Please rotate your device to enjoy the full experience.
            </p>
            <div className="flex justify-center items-center space-x-4 text-sm opacity-75">
              <div className="text-center">
                <div className="w-8 h-12 border-2 border-white rounded mb-2 mx-auto"></div>
                <span>Portrait</span>
              </div>
              <div className="text-center">
                <div className="w-12 h-8 border-2 border-cyan-400 rounded mb-2 mx-auto bg-cyan-400/20"></div>
                <span className="text-cyan-400">Landscape</span>
              </div>
            </div>
          </div>
        </div>
      </Fragment>
    );
  }

  // Show sound preference prompt
  if (showSoundPrompt) {
    return (
      <Fragment>
        <Head>
          <title>Sound Preference</title>
          <meta
            name="viewport"
            content="minimum-scale=1, initial-scale=1, width=device-width"
          />
        </Head>
        <div className="fixed inset-0 bg-black flex items-center justify-center z-50">
          <div className="text-center text-white p-8 max-w-md">
            <div className="mb-8">
              <svg 
                className="w-24 h-24 mx-auto mb-4" 
                fill="currentColor" 
                viewBox="0 0 24 24"
              >
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
              </svg>
            </div>
            <h1 className="text-2xl font-bold mb-4 font-[Nasalization]">Sound Experience</h1>
            <p className="text-lg mb-8 font-[Gilmer]">
              Choose your preferred audio experience for the website.
            </p>
            <div className="space-y-4">
              <button
                onClick={() => handleSoundChoice(true)}
                className="w-full py-4 px-6 bg-cyan-400/20 border border-cyan-400 rounded-lg hover:bg-cyan-400/30 hover:border-cyan-300 transition-all duration-300 font-[Gilmer] text-lg"
              >
                <div className="flex items-center justify-center space-x-3">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                  </svg>
                  <span>Continue with Sound</span>
                </div>
              </button>
              <button
                onClick={() => handleSoundChoice(false)}
                className="w-full py-4 px-6 bg-white/10 border border-white/20 rounded-lg hover:bg-white/20 hover:border-white/30 transition-all duration-300 font-[Gilmer] text-lg"
              >
                <div className="flex items-center justify-center space-x-3">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
                  </svg>
                  <span>Continue without Sound</span>
                </div>
              </button>
            </div>
          </div>
        </div>
      </Fragment>
    );
  }

  return (
    <SoundContext.Provider value={{ soundEnabled, setSoundEnabled }}>
      <Fragment>
        <Head>
          <title>updatedwebsite</title>
          <meta
            name="viewport"
            content="minimum-scale=1, initial-scale=1, width=device-width"
          />
          <style jsx global>{`
            .page-transition {
              transition: transform 0.3s ease-in-out, opacity 0.3s ease-in-out;
            }
            
            .page-transition.transitioning {
              transform: ${transitionDirection === 'right' ? 'translateX(-100%)' : 'translateX(100%)'};
              opacity: 0;
            }
            
            .page-transition.entering {
              transform: ${transitionDirection === 'right' ? 'translateX(100%)' : 'translateX(-100%)'};
              opacity: 0;
            }
            
            .page-transition.entered {
              transform: translateX(0);
              opacity: 1;
            }
          `}</style>
        </Head>
        <div className={`page-transition ${isTransitioning ? 'transitioning' : 'entered'}`}>
          <Component {...pageProps} />
        </div>
      </Fragment>
    </SoundContext.Provider>
  );
}

export default MyApp;