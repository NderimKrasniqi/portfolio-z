"use client";

import { createContext, useContext, useLayoutEffect, useRef, type AnchorHTMLAttributes, type ButtonHTMLAttributes, type MouseEvent, type ReactNode } from "react";
import { loadGsap, prefersReducedMotion } from "./motion";

type Navigate = (href: string) => void;
const NavigationContext = createContext<Navigate | null>(null);

export function NavigationProvider({ navigate, children }: { navigate: Navigate; children: ReactNode }) {
  return <NavigationContext.Provider value={navigate}>{children}</NavigationContext.Provider>;
}

export function useSiteNavigation() {
  return useContext(NavigationContext);
}

function shouldUseBrowserNavigation(event: MouseEvent<HTMLAnchorElement>) {
  return event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
}

function useElementMotion(ref: { current: HTMLElement | null }) {
  useLayoutEffect(() => {
    const link = ref.current;
    if (!link || link.classList.contains("mobile-nav-link") || prefersReducedMotion()) return;
    let cancelled = false;
    let dispose = () => {};
    loadGsap().then((gsap) => {
      if (cancelled || !gsap || prefersReducedMotion()) return;
      const baseOpacity = Number.parseFloat(getComputedStyle(link).opacity) || 1;
      const animate = (active: boolean) => gsap.to(link, {
        opacity: active ? 1 : baseOpacity,
        y: active ? -1 : 0,
        duration: active ? .20 : .22,
        ease: "power2.out",
        overwrite: "auto",
      });
      const enter = () => animate(true);
      const leave = () => animate(false);
      link.addEventListener("pointerenter", enter);
      link.addEventListener("pointerleave", leave);
      link.addEventListener("focus", enter);
      link.addEventListener("blur", leave);
      dispose = () => {
        link.removeEventListener("pointerenter", enter);
        link.removeEventListener("pointerleave", leave);
        link.removeEventListener("focus", enter);
        link.removeEventListener("blur", leave);
        gsap.killTweensOf(link);
        gsap.set(link, { clearProps: "transform" });
      };
    });
    return () => { cancelled = true; dispose(); };
  }, [ref]);
}

function useLinkMotion(ref: { current: HTMLAnchorElement | null }) {
  useElementMotion(ref);
}

export function SiteLink({ href, children, onClick, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  const navigate = useSiteNavigation();
  const linkRef = useRef<HTMLAnchorElement>(null);
  useLinkMotion(linkRef);
  return (
    <a
      {...props}
      ref={linkRef}
      href={href}
      onClick={(event) => {
        onClick?.(event);
        if (!navigate || shouldUseBrowserNavigation(event) || !href || !href.startsWith("/")) return;
        event.preventDefault();
        navigate(href);
      }}
    >
      {children}
    </a>
  );
}

export function MotionAnchor(props: AnchorHTMLAttributes<HTMLAnchorElement>) {
  const ref = useRef<HTMLAnchorElement>(null);
  useLinkMotion(ref);
  return <a {...props} ref={ref} />;
}

export function MotionButton(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  const ref = useRef<HTMLButtonElement>(null);
  useElementMotion(ref);
  return <button {...props} ref={ref} />;
}
