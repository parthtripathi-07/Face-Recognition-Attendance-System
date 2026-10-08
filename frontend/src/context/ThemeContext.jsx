import React, { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    // Check if the user previously had a dark preference override or if it was auto-detected.
    // Default strictly to clean white ('light') mode.
    const saved = localStorage.getItem('faceattend_theme_v3');
    if (saved) return saved;
    // Clear legacy auto-detected theme to guarantee clean white light theme
    localStorage.setItem('faceattend_theme_v3', 'light');
    localStorage.setItem('faceattend_theme', 'light');
    return 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('faceattend_theme_v3', theme);
    localStorage.setItem('faceattend_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
