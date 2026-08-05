import React, { useEffect } from 'react';

import { useGlobalStore } from './useGlobalStore';

export const GlobalStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const setWindowHeight = useGlobalStore((state) => state.setWindowHeight);

  useEffect(() => {
    const handleResize = () => {
      setWindowHeight(window.innerHeight);
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [setWindowHeight]);

  return <>{children}</>;
};
