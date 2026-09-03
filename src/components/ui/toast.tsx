"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, BellOff, Heart, HeartCrack, Sparkles } from "lucide-react";

export type ToastType = "on" | "off" | "heart" | "unheart" | "info" | "success";

export interface ToastItem {
  id: number;
  type: ToastType;
  message?: string;
  subMessage?: string;
  icon?: string;
  duration?: number;
}

export type ToastPayload =
  | ToastType
  | {
      type: ToastType;
      message?: string;
      subMessage?: string;
      icon?: string;
      duration?: number;
    };

let toastListeners: ((payload: ToastPayload) => void)[] = [];

export function showToast(payload: ToastPayload) {
  toastListeners.forEach((fn) => fn(payload));
}

export function showNotificationToast(type: "on" | "off") {
  showToast(type);
}

export function NotificationToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const handler = (payload: ToastPayload) => {
      const id = Date.now();
      const item: ToastItem =
        typeof payload === "string"
          ? { id, type: payload }
          : { id, ...payload };

      setToasts((prev) => [...prev, item]);
      const duration = item.duration ?? (item.type === "heart" ? 3200 : 2500);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    };

    toastListeners.push(handler);
    return () => {
      toastListeners = toastListeners.filter((fn) => fn !== handler);
    };
  }, []);

  return (
    <div className="fixed top-[calc(1.25rem+env(safe-area-inset-top))] left-1/2 z-50 -translate-x-1/2 flex flex-col gap-2 items-center pointer-events-none max-w-[90vw] w-full sm:w-auto">
      <AnimatePresence>
        {toasts.map((toast) => {
          const isHeart = toast.type === "heart";
          const isUnheart = toast.type === "unheart";
          const isOn = toast.type === "on";
          const isOff = toast.type === "off";

          let bg = "linear-gradient(135deg, #10b981, #0ea5e9)";
          if (isHeart) {
            bg = "linear-gradient(135deg, #f43f5e 0%, #fb7185 50%, #f59e0b 100%)";
          } else if (isUnheart) {
            bg = "linear-gradient(135deg, #64748b 0%, #475569 100%)";
          } else if (isOff) {
            bg = "linear-gradient(135deg, #64748b, #334155)";
          }

          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: -20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.92 }}
              transition={{ type: "spring", stiffness: 450, damping: 26 }}
              className="flex items-center gap-2.5 rounded-full px-5 py-2.5 shadow-xl text-xs sm:text-sm font-bold text-white border border-white/20 whitespace-nowrap"
              style={{
                background: bg,
                backdropFilter: "blur(16px)",
                boxShadow: isHeart
                  ? "0 10px 25px -5px rgba(244, 63, 94, 0.4), 0 8px 10px -6px rgba(245, 158, 11, 0.3)"
                  : "0 10px 20px -5px rgba(0, 0, 0, 0.25)",
              }}
            >
              {isHeart ? (
                <div className="flex items-center justify-center h-6 w-6 rounded-full bg-white/25 shrink-0">
                  <Heart className="h-3.5 w-3.5 fill-white text-white animate-pulse" />
                </div>
              ) : isUnheart ? (
                <div className="flex items-center justify-center h-6 w-6 rounded-full bg-white/20 shrink-0">
                  <HeartCrack className="h-3.5 w-3.5 text-white/90" />
                </div>
              ) : isOn ? (
                <Bell className="h-4 w-4 shrink-0" />
              ) : isOff ? (
                <BellOff className="h-4 w-4 shrink-0" />
              ) : (
                <Sparkles className="h-4 w-4 shrink-0" />
              )}

              <div className="flex flex-col text-left">
                <span>
                  {toast.message ??
                    (isOn
                      ? "알림이 켜졌습니다"
                      : isOff
                        ? "알림이 꺼졌습니다"
                        : "최애 메뉴가 등록되었습니다")}
                </span>
                {toast.subMessage && (
                  <span className="text-2xs font-normal text-white/85">
                    {toast.subMessage}
                  </span>
                )}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
