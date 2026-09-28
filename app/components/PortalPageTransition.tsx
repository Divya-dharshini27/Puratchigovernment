"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";

interface PortalPageTransitionProps {
  active: boolean;
  onComplete?: () => void;
  title?: string;
}

export default function PortalPageTransition({
  active,
  onComplete,
  title = "PURATCHI PORTAL"
}: PortalPageTransitionProps) {
  const [animating, setAnimating] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (active) {
      setVisible(true);
      // Trigger slide across
      const timer = setTimeout(() => {
        setAnimating(true);
      }, 50);

      const endTimer = setTimeout(() => {
        setAnimating(false);
        setVisible(false);
        if (onComplete) onComplete();
      }, 750);

      return () => {
        clearTimeout(timer);
        clearTimeout(endTimer);
      };
    }
  }, [active, onComplete]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[100] pointer-events-none overflow-hidden">
      {/* Full-Screen Crimson Red Banner Curtain Slide Transition */}
      <div
        className={`absolute inset-0 bg-gradient-to-r from-red-950 via-red-700 to-red-900 border-l-4 border-amber-300 shadow-2xl flex flex-col items-center justify-center text-white transition-transform duration-[650ms] cubic-bezier(0.77, 0, 0.175, 1) ${
          animating ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ willChange: "transform" }}
      >
        <div className="flex items-center gap-3 px-6 py-3 bg-red-950/80 rounded-2xl border border-amber-300/40 shadow-xl backdrop-blur-sm animate-pop-in">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-red-600 text-white font-black text-lg shadow">
            P
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-amber-300 flex items-center gap-1">
              <Sparkles size={12} /> YOUTH REVOLUTION
            </div>
            <div className="text-lg font-black uppercase tracking-wider text-white">
              {title}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
