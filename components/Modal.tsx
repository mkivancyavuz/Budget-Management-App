"use client";

import React from "react";
import { X } from "lucide-react";

export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      // data-modal lets the tour overlay detect an open modal and step aside;
      // highlighting something behind a modal would be meaningless.
      data-modal
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-overlay backdrop-blur-sm p-0 sm:p-4"
    >
      <div className="animate-rise bg-app-surface border border-app-border rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-app-border sticky top-0 bg-app-surface">
          <h2 className="text-base font-semibold text-app-text">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-app-text-secondary hover:text-app-text transition-colors p-1.5 rounded-lg hover:bg-glass-subtle"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
