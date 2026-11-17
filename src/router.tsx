/**
 * A tiny client-side router: "/" is the landing page, "/app" the scanner.
 * No dependency; uses the History API. Hosting must serve index.html for
 * every path (see vercel.json).
 */
import { type AnchorHTMLAttributes, type MouseEvent, useEffect, useState } from "react";

export type Route = "landing" | "app";

const listeners = new Set<() => void>();

function routeOf(pathname: string): Route {
  return pathname.replace(/\/+$/, "") === "/app" ? "app" : "landing";
}

export function navigate(to: string) {
  const url = new URL(to, window.location.origin);
  if (url.origin !== window.location.origin) {
    window.location.href = to;
    return;
  }
  window.history.pushState({}, "", url.pathname + url.search + url.hash);
  listeners.forEach((l) => l());
  if (url.hash) {
    requestAnimationFrame(() => document.querySelector(url.hash)?.scrollIntoView({ behavior: "smooth", block: "start" }));
  } else {
    window.scrollTo({ top: 0 });
  }
}

export function useRoute(): { route: Route; search: URLSearchParams } {
  const [, force] = useState(0);
  useEffect(() => {
    const update = () => force((n) => n + 1);
    listeners.add(update);
    window.addEventListener("popstate", update);
    return () => {
      listeners.delete(update);
      window.removeEventListener("popstate", update);
    };
  }, []);
  return { route: routeOf(window.location.pathname), search: new URLSearchParams(window.location.search) };
}

/** An <a> that navigates inside the app without a page load (external links behave normally). */
export function Link({ href, onClick, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  const internal = href.startsWith("/") || href.startsWith("#");
  return (
    <a
      href={href}
      {...rest}
      onClick={(e: MouseEvent<HTMLAnchorElement>) => {
        onClick?.(e);
        if (!internal || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        navigate(href.startsWith("#") ? window.location.pathname + href : href);
      }}
    />
  );
}

/** Where things live. */
export const LINKS = {
  github: "https://github.com/phoenix-2203/unyoke",
  docs: "https://docs.qorechain.io/developer-guide/evm-development",
  fest: "https://build.qorechain.io/projects",
  qorex: "https://qorechain.io/qorex",
  faucet: "https://dashboard.qorechain.io/faucet",
  explorer: "https://explore.qore.network",
} as const;
