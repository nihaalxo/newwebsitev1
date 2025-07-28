import { useEffect, useRef, useContext } from 'react';
import { SoundContext } from '../pages/_app';

export const useVideoSound = () => {
  const { soundEnabled } = useContext(SoundContext);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);

  // Update video muted state when sound preference changes
  useEffect(() => {
    videoRefs.current.forEach((video) => {
      if (video) {
        video.muted = !soundEnabled;
      }
    });
  }, [soundEnabled]);

  // Function to add video ref
  const addVideoRef = (video: HTMLVideoElement | null, index: number) => {
    videoRefs.current[index] = video;
    if (video) {
      video.muted = !soundEnabled;
    }
  };

  return { addVideoRef, soundEnabled, videoRefs: videoRefs.current };
}; 