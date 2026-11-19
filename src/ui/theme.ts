/** Light or dark: the visitor's choice if they made one, otherwise their system setting. */
import { useEffect, useState } from "react";

export type Theme = "light" | "dark";
const KEY = "unyoke-theme";
const BG: Record<Theme, string> = { dark: "#07080a", light: "#f5f4ef" };

/** A saved "light"/"dark" wins; anything else falls back to the system setting. */
export function resolveTheme(saved: string | null, systemPrefersLight: boolean): Theme {
  if (saved === "light" || saved === "dark") return saved;
  return systemPrefersLight ? "light" : "dark";
}

function saved(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null; // storage can be blocked; the system setting still applies
  }
}

const systemQuery = () => window.matchMedia("(prefers-color-scheme: light)");

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", BG[theme]));
}

export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(() => resolveTheme(saved(), systemQuery().matches));

  useEffect(() => applyTheme(theme), [theme]);

  // Follow the system setting until the visitor picks one here.
  useEffect(() => {
    const q = systemQuery();
    const onChange = () => {
      if (!saved()) setTheme(q.matches ? "light" : "dark");
    };
    q.addEventListener("change", onChange);
    return () => q.removeEventListener("change", onChange);
  }, []);

  const toggle = () =>
    setTheme((t) => {
      const next: Theme = t === "dark" ? "light" : "dark";
      try {
        localStorage.setItem(KEY, next);
      } catch {
        /* not saved, but still switched for this visit */
      }
      return next;
    });

  return [theme, toggle];
}
