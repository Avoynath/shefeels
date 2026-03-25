import React from 'react';
import { createPortal } from 'react-dom';

type Props = {
  visible: boolean;
  anchorRect?: DOMRect | null;
  label: React.ReactNode;
};

const CollapsedTooltip: React.FC<Props> = ({ visible, anchorRect, label }) => {
  if (!visible || !anchorRect) return null;

  const style: React.CSSProperties = {
    position: 'fixed',
    left: anchorRect.right + 12,
    top: anchorRect.top + anchorRect.height / 2,
    transform: 'translateY(-50%)',
    zIndex: 9999,
  };

  // Minimal tooltip: only plain text on hover, no extra styling/bubbles.
  const container = (
    <div style={style} className="whitespace-nowrap text-sm font-medium text-white drop-shadow-sm">
      {label}
    </div>
  );

  return createPortal(container, document.body);
};

export default CollapsedTooltip;
