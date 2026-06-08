/**
 * Hafif tema context — açık/koyu tercihi (Paper teması zaten App.tsx'te).
 */
import React, {createContext, useContext, useState} from 'react';

interface ThemeContextValue {
  dark: boolean;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({dark: false, toggle: () => undefined});

export const ThemeProvider: React.FC<{children: React.ReactNode}> = ({children}) => {
  const [dark, setDark] = useState(false);
  return (
    <ThemeContext.Provider value={{dark, toggle: () => setDark(d => !d)}}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useThemePref = () => useContext(ThemeContext);
