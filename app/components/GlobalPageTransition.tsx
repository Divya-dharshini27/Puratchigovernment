"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";

interface TransitionContextType {
  navigateTo: (url: string) => void;
}

const TransitionContext = createContext<TransitionContextType>({
  navigateTo: () => {}
});

export const usePortalNavigation = () => useContext(TransitionContext);

export default function GlobalPageTransition({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  // Animation Panel States: 'IDLE' | 'SLIDING_IN' | 'COVERED' | 'SLIDING_OUT'
  const [animState, setAnimState] = useState<"IDLE" | "SLIDING_IN" | "COVERED" | "SLIDING_OUT">("IDLE");
  const [targetUrl, setTargetUrl] = useState<string | null>(null);

  // Trigger Right-to-Left Panel Slide Navigation
  const navigateTo = (url: string) => {
    if (!url || url === pathname || url.startsWith("#")) return;
    setTargetUrl(url);
    setAnimState("SLIDING_IN");
  };

  // Step 1: Slide panel in from right to left (350ms) -> Covered -> router.push(targetUrl)
  useEffect(() => {
    if (animState === "SLIDING_IN") {
      const timer = setTimeout(() => {
        setAnimState("COVERED");
        if (targetUrl) {
          router.push(targetUrl);
        }
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [animState, targetUrl, router]);

  // Step 2: Route change or covered state -> Slide panel out to left (350ms)
  useEffect(() => {
    if (animState === "COVERED" || (animState === "SLIDING_IN" && targetUrl && targetUrl !== pathname)) {
      const timer = setTimeout(() => {
        setAnimState("SLIDING_OUT");
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [pathname, animState, targetUrl]);

  // Step 3: Complete slide out -> IDLE
  useEffect(() => {
    if (animState === "SLIDING_OUT") {
      const timer = setTimeout(() => {
        setAnimState("IDLE");
        setTargetUrl(null);
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [animState]);

  // Intercept global link clicks for internal page navigation
  useEffect(() => {
    const handleGlobalLinkClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest("a");
      if (!target) return;

      const href = target.getAttribute("href");
      if (!href) return;

      // Only transition for internal page routes that differ from current pathname
      if (
        href.startsWith("/") &&
        !href.startsWith("#") &&
        !href.startsWith("mailto:") &&
        !href.startsWith("tel:") &&
        target.target !== "_blank" &&
        href !== pathname
      ) {
        e.preventDefault();
        navigateTo(href);
      }
    };

    document.addEventListener("click", handleGlobalLinkClick, true);
    return () => {
      document.removeEventListener("click", handleGlobalLinkClick, true);
    };
  }, [pathname]);

  return (
    <TransitionContext.Provider value={{ navigateTo }}>
      {children}

      {/* Global PURATCHI Maroon/Red Full-Screen Transition Panel */}
      {animState !== "IDLE" && (
        <div className="fixed inset-0 z-[9999] pointer-events-none overflow-hidden">
          <div
            className="absolute inset-0 bg-gradient-to-r from-red-950 via-red-900 to-red-950 border-l-4 border-amber-400 shadow-2xl flex flex-col items-center justify-center text-white transition-transform duration-[350ms] cubic-bezier(0.77, 0, 0.175, 1)"
            style={{
              willChange: "transform",
              transform:
                animState === "SLIDING_IN" || animState === "COVERED"
                  ? "translateX(0%)"
                  : animState === "SLIDING_OUT"
                  ? "translateX(-100%)"
                  : "translateX(100%)"
            }}
          >
            <div className="flex items-center gap-3.5 px-6 py-3.5 bg-red-950/90 rounded-2xl border border-amber-400/40 shadow-2xl backdrop-blur-md animate-pop-in">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-red-600 text-white font-black text-lg shadow-md">
                P
              </div>
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-amber-300 flex items-center gap-1">
                  <Sparkles size={13} /> YOUTH REVOLUTION
                </div>
                <div className="text-lg font-black uppercase tracking-wider text-white">
                  PURATCHI
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </TransitionContext.Provider>
  );
}
