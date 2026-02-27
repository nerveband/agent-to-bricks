import { useEffect } from "react";
import { useAtom } from "jotai";
import { themeAtom } from "../atoms/app";

export function useTheme() {
  const [theme, setTheme] = useAtom(themeAtom);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    // Cache in localStorage so index.html inline script can read it
    // before React mounts — prevents flash of wrong theme
    try { localStorage.setItem("atb-theme", theme); } catch {}
  }, [theme]);

  const toggle = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  return { theme, toggle };
}
