import React from 'react';

export default React.memo(function AvatarImg({ hue, size = 40, online, imageUrl }: { hue: number; size?: number; online?: boolean; imageUrl?: string | null }) {
  return (
    <div className="relative" style={{ width: size, height: size }}>
      {imageUrl ? (
        <img
          src={imageUrl}
          alt="avatar"
          className="rounded-full object-cover ring-1 ring-white/[0.08]"
          style={{ width: size, height: size }}
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
        />
      ) : (
        <div
          className="rounded-full ring-1 ring-white/[0.08]"
          style={{
            width: size,
            height: size,
            background: `linear-gradient(135deg, hsla(${hue},80%,60%,0.35), transparent)`,
          }}
        />
      )}
      {online && (
        <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-[#121212]" />
      )}
    </div>
  );
});
