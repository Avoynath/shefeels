import React from "react";
import { useThemeStyles } from "../utils/theme";

type Props = {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
};

export default function Modal({ open, onClose, children }: Props) {
  const { components } = useThemeStyles();
  const cardBase = components.cardBase;

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[2000]">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(560px,92vw)]">
        <div className={`${cardBase} p-8`}>{children}</div>
      </div>
    </div>
  );
}
