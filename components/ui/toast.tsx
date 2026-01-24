"use client";

import { useEffect, useState } from "react";
import { X, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface Toast {
  id: string;
  title: string;
  description?: string;
  duration?: number;
}

interface ToastProps {
  toast: Toast;
  onClose: (id: string) => void;
}

function ToastItem({ toast, onClose }: ToastProps) {
  useEffect(() => {
    if (toast.duration && toast.duration > 0) {
      const timer = setTimeout(() => {
        onClose(toast.id);
      }, toast.duration);

      return () => clearTimeout(timer);
    }
  }, [toast.id, toast.duration, onClose]);

  return (
    <div
      className={cn(
        "group pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-lg border border-border bg-card p-4 pr-8 shadow-lg transition-all animate-in slide-in-from-bottom-5",
      )}
    >
      <div className="flex items-start gap-3">
        <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
        <div className="grid gap-1 flex-1">
          <div className="text-sm font-semibold">{toast.title}</div>
          {toast.description && (
            <div className="text-sm text-muted-foreground">{toast.description}</div>
          )}
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-2 top-2 h-6 w-6 rounded-md opacity-0 transition-opacity hover:opacity-100 focus:opacity-100 focus:outline-none focus:ring-2 group-hover:opacity-100"
        onClick={() => onClose(toast.id)}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    // Listen for toast events
    const handleToast = (event: CustomEvent<Toast>) => {
      const toast = event.detail;
      setToasts((prev) => [...prev, toast]);
    };

    window.addEventListener("show-toast" as any, handleToast as EventListener);
    return () => {
      window.removeEventListener("show-toast" as any, handleToast as EventListener);
    };
  }, []);

  const handleClose = (id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 w-full max-w-[420px] px-4">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onClose={handleClose} />
      ))}
    </div>
  );
}

export function toast(toastData: Omit<Toast, "id">) {
  const id = Math.random().toString(36).substring(2, 9);
  const toast: Toast = {
    ...toastData,
    id,
    duration: toastData.duration ?? 5000,
  };

  window.dispatchEvent(
    new CustomEvent("show-toast", {
      detail: toast,
    })
  );
}
