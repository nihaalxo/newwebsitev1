'use client';

import { createContext, useCallback, useContext, useState } from 'react';

// Lets a form know whether any of its media fields are mid-upload, so it can hold off saving
// (and warn before leaving) until the files have landed.

type Track = <T>(work: Promise<T>) => Promise<T>;

const TrackerContext = createContext<Track>((work) => work);

export const UploadTrackerProvider = TrackerContext.Provider;

export function useUploadTracker(): Track {
  return useContext(TrackerContext);
}

/** Returns how many uploads are running and the `track` function to provide to the fields below. */
export function useUploadCount(): [number, Track] {
  const [count, setCount] = useState(0);
  const track = useCallback<Track>(async (work) => {
    setCount((n) => n + 1);
    try {
      return await work;
    } finally {
      setCount((n) => n - 1);
    }
  }, []);
  return [count, track];
}
