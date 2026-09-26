"use client";

import React, { useEffect, useState } from "react";
import { Download, Sparkles, X } from "lucide-react";

export function PWAInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // Register service worker if supported
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => console.log("Service Worker registered:", reg.scope))
        .catch((err) => console.warn("Service Worker registration failed:", err));
    }

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowBanner(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setShowBanner(false);
    }
    setDeferredPrompt(null);
  };

  if (!showBanner) return null;

  return (
    <div className="bg-indigo-900 text-white px-4 py-2.5 flex items-center justify-between shadow-md text-xs sm:text-sm">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
        <span>
          Install <strong>AHL HR OS</strong> app on your device for lightning-fast offline access.
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={handleInstallClick}
          className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1 rounded-md font-medium transition shadow-sm"
        >
          <Download className="w-3.5 h-3.5" />
          Install App
        </button>
        <button
          onClick={() => setShowBanner(false)}
          className="p-1 hover:bg-indigo-800 rounded transition text-indigo-200"
          aria-label="Dismiss banner"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
