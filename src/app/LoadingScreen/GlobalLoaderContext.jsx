"use client";
import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
} from "react";

const GlobalLoaderContext = createContext({
  showLoading: false,
  fadeOut: false,
  startLoading: () => {},
  stopLoading: () => {},
});

export function GlobalLoaderProvider({ children }) {
  const [showLoading, setShowLoading] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  const hideTimerRef = useRef(null);

  // Use useCallback so these functions don't get re-created on every render
  const startLoading = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    setFadeOut(false);
    setShowLoading(true);
  }, []);

  const stopLoading = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
    }

    setFadeOut(true);
    hideTimerRef.current = setTimeout(() => {
      setShowLoading(false);
      setFadeOut(false);
      hideTimerRef.current = null;
    }, 500);
  }, []);

  const value = {
    showLoading,
    fadeOut,
    startLoading,
    stopLoading,
  };

  return (
    <GlobalLoaderContext.Provider value={value}>
      {children}
    </GlobalLoaderContext.Provider>
  );
}

export function useGlobalLoader() {
  return useContext(GlobalLoaderContext);
}
