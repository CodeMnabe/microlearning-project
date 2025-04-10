"use client";
import React, { createContext, useContext, useState, useCallback } from "react";

const GlobalLoaderContext = createContext({
  showLoading: false,
  fadeOut: false,
  startLoading: () => {},
  stopLoading: () => {},
});

export function GlobalLoaderProvider({ children }) {
  const [showLoading, setShowLoading] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);

  // Use useCallback so these functions don't get re-created on every render
  const startLoading = useCallback(() => {
    setFadeOut(false);
    setShowLoading(true);
  }, []);

  const stopLoading = useCallback(() => {
    setFadeOut(true);
    setTimeout(() => {
      setShowLoading(false);
      setFadeOut(false);
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
