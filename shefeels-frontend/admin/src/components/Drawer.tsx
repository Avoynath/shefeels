import React from 'react';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export const Drawer: React.FC<DrawerProps> = ({ open, onClose, title, children }) => {
  return (
    <div className={`fixed inset-0 z-50 flex ${open ? '' : 'pointer-events-none'} transition-all duration-250`}>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black bg-opacity-40 backdrop-blur-sm transition-opacity duration-250 ${open ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />
      {/* Drawer Panel */}
      <div
        className={`fixed right-0 top-0 h-full w-4/5 max-w-300 bg-white shadow-dashboard transform transition-transform duration-250 ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="p-8 relative h-full flex flex-col">
          {title && <h2 className="font-inter text-xl font-semibold mb-4 text-gray-900">{title}</h2>}
          <button
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-900"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
          <div className="flex-1 overflow-y-auto">{children}</div>
        </div>
      </div>
    </div>
  );
};
