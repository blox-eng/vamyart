"use client";

import * as React from "react";
import { onRevalidateFailed } from "@/lib/revalidate";

export type ToastType = "success" | "error" | "info";

interface Toast {
    id: number;
    message: string;
    type: ToastType;
}

interface ToastContextValue {
    toast: (message: string, type?: ToastType) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = React.useState<Toast[]>([]);
    const nextIdRef = React.useRef(0);

    const toast = React.useCallback((message: string, type: ToastType = "info") => {
        const id = ++nextIdRef.current;
        setToasts((prev) => [...prev.slice(-2), { id, message, type }]);
        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 3500);
    }, []);

    React.useEffect(
        () => onRevalidateFailed(() => toast("Saved, but vamy.art didn't refresh. It will catch up within the hour.", "error")),
        [toast]
    );

    return (
        <ToastContext.Provider value={{ toast }}>
            {children}
            <div
                aria-live="polite"
                aria-label="Notifications"
                className="fixed top-4 right-4 z-50 flex flex-col gap-3 pointer-events-none"
            >
                {toasts.map((t) => (
                    <div
                        key={t.id}
                        className={`bg-field shadow-md text-sm font-light px-4 py-3 min-w-[220px] max-w-xs border-l-2 pointer-events-auto ${
                            t.type === "success"
                                ? "border-accent"
                                : t.type === "error"
                                ? "border-neg"
                                : "border-hair"
                        }`}
                    >
                        {t.message}
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}

export function useToast() {
    const ctx = React.useContext(ToastContext);
    if (!ctx) throw new Error("useToast must be used inside ToastProvider");
    return ctx.toast;
}
