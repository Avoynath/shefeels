import React from "react";

const LoadMoreButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = (props) => {
  return (
    <button
      {...props}
      className={
        "relative inline-flex h-10 min-w-[140px] items-center justify-center overflow-hidden rounded-full px-8 py-2 text-sm font-medium text-white transition-all hover:brightness-110"
      }
      style={{
        background: 'linear-gradient(90deg, #d9b2ff 0%, #7f5af0 38%, #9d66ff 64%, #f48db5 100%)',
        backdropFilter: 'blur(5px)',
        WebkitBackdropFilter: 'blur(5px)',
        boxShadow: 'inset 0 0 8px rgba(227,222,255,0.2), inset 0 20px 20px rgba(202,172,255,0.3), inset 0 1px 2px rgba(255,255,255,1), inset 0 8px 11px rgba(255,255,255,0.1)',
      }}
    >
      Load More
    </button>
  );
};

export default LoadMoreButton;
