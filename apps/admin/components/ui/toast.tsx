"use client";

import * as React from "react";

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

let nextId = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = React.useState<Toast[]>([]);

    const toast = React.useCallback((message: string, type: ToastType = "info") => {
        const id = ++nextId;
        setToasts((prev) => [...prev.slice(-2), { id, message, type }]);
        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 3500);
    }, []);

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
                        className={`bg-white shadow-md text-sm font-light px-4 py-3 min-w-[220px] max-w-xs border-l-2 pointer-events-auto ${
                            t.type === "success"
                                ? "border-green-500"
                                : t.type === "error"
                                ? "border-red-500"
                                : "border-gray-400"
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
