"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, BellOff } from "lucide-react";

type ToastType = "on" | "off";

interface ToastItem {
  id: number;
  type: ToastType;
}

let toastListeners: ((type: ToastType) => void)[] = [];

export function showNotificationToast(type: ToastType) {
  toastListeners.forEach((fn) => fn(type));
}

export function NotificationToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const handler = (type: ToastType) => {
      const id = Date.now();
      setToasts((prev) => [...prev, { id, type }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 2500);
    };

    toastListeners.push(handler);
    return () => {
      toastListeners = toastListeners.filter((fn) => fn !== handler);
    };
  }, []);

  return (
    <div className="fixed top-[calc(1.25rem+env(safe-area-inset-top))] left-1/2 z-50 -translate-x-1/2 flex flex-col gap-2 items-center pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: -16, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.94 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            className="flex items-center gap-2.5 rounded-full px-5 py-3 shadow-lg text-sm font-semibold text-white"
            style={{
              background:
                toast.type === "on"
                  ? "linear-gradient(135deg, #10b981, #0ea5e9)"
                  : "linear-gradient(135deg, #64748b, #334155)",
              backdropFilter: "blur(12px)",
            }}
          >
            {toast.type === "on" ? (
              <Bell className="h-4 w-4" />
            ) : (
              <BellOff className="h-4 w-4" />
            )}
            {toast.type === "on" ? "알림이 켜졌습니다" : "알림이 꺼졌습니다"}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
