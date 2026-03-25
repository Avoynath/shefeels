import React from "react";

const LoadMoreButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = (props) => {
  return (
    <button
      {...props}
      className={
        "relative inline-flex h-[62px] min-w-[174px] items-center justify-center overflow-hidden rounded-[12px] px-[41px] py-5 text-[20px] font-medium text-white transition-all hover:brightness-110"
      }
      style={{
        background: 'linear-gradient(90deg, #d9b2ff 0%, #7f5af0 38%, #9d66ff 64%, #f48db5 100%)',
        backdropFilter: 'blur(5.049px)',
        WebkitBackdropFilter: 'blur(5.049px)',
        boxShadow: 'inset 0 0 8.078px rgba(227,222,255,0.2), inset 0 20px 20.196px rgba(202,172,255,0.3), inset 0 1px 2.222px rgba(255,255,255,1), inset 0 8px 11.31px rgba(255,255,255,0.1)',
      }}
    >
      Load More
    </button>
  );
};

export default LoadMoreButton;
