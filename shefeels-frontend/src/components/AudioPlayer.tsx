import { useState, useRef, useEffect } from 'react';

interface AudioPlayerProps {
  audioUrl: string;
  from: 'me' | 'ai';
  onError?: () => void;
}

export default function AudioPlayer({ audioUrl, from, onError }: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      setDuration(isFinite(audio.duration) ? audio.duration : 0);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      const pct = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0;
      setProgress(Math.min(100, Math.max(0, pct)));
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      setProgress(0);
    };

    const handleError = () => {
      console.error('Audio playback error');
      onError?.();
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };
  }, [onError]);

  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play();
      setIsPlaying(true);
    }
    // Debug log for playback actions
    try {
      console.debug(`[AudioPlayer] togglePlayPause -> ${isPlaying ? 'pause' : 'play'} | url:`, audioUrl);
    } catch (e) {}
  };

  const formatTime = (timeInSeconds: number): string => {
    if (!isFinite(timeInSeconds)) return '0:00';
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const isMe = from === 'me';

  return (
    // Make the whole player clickable (WhatsApp-style): clicking anywhere toggles play/pause
    <div
      className="flex w-full max-w-[280px] items-center gap-1.5 cursor-pointer"
      onClick={() => togglePlayPause()}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); togglePlayPause(); } }}
      role="button"
      tabIndex={0}
      style={{ minHeight: 20 }}
    >
      <audio ref={audioRef} src={audioUrl} preload="metadata" playsInline />

      {/* Play/Pause Button */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); togglePlayPause(); }}
        className={`flex-shrink-0 rounded-full flex items-center justify-center transition-colors ${
          isMe
            ? 'bg-black/15 hover:bg-black/25 active:bg-black/35'
            : 'bg-white/10 hover:bg-white/15 active:bg-white/20'
        }`}
        style={{ 
          width: '22px', 
          height: '22px', 
          padding: '0',
          margin: '0',
          border: 'none',
          minWidth: '22px',
          minHeight: '22px'
        }}
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? (
          // Pause icon
          <div className="flex gap-[2px]" style={{ padding: 0, margin: 0 }}>
            <div className={`w-[2px] h-[9px] rounded-full ${isMe ? 'bg-black/80' : 'bg-white/90'}`} />
            <div className={`w-[2px] h-[9px] rounded-full ${isMe ? 'bg-black/80' : 'bg-white/90'}`} />
          </div>
        ) : (
          // Play icon
          <div
            className={`w-0 h-0 border-l-[7px] border-t-[4px] border-b-[4px] border-t-transparent border-b-transparent ml-[1px] ${
              isMe ? 'border-l-black/80' : 'border-l-white/90'
            }`}
            style={{ padding: 0, margin: 0, marginLeft: '1px' }}
          />
        )}
      </button>

      {/* Duration next to play button */}
      <span className={`flex-shrink-0 text-[11px] font-semibold tabular-nums ml-1.5 ${
        isMe ? 'text-black opacity-100' : 'opacity-90'
      }`}>
        {formatTime(isPlaying ? currentTime : duration)}
      </span>

      {/* Waveform Container */}
      <div className="flex-1 flex items-center justify-start gap-[2.5px] ml-1.5">
        {Array.from({ length: 25 }).map((_, i) => {
          const seed = (i * 11 + 7) % 89;
          const barHeight = 3 + ((seed * seed) % 7); // 3-9px (reduced max height)
          const isActive = progress > (i / 25) * 100;
          const activeColor = isMe ? '#000' : '#fff';
          const inactiveColor = isMe ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.4)';
          return (
            <div
              key={i}
              className="w-[2px] rounded-full transition-all duration-200"
              style={{
                height: `${barHeight}px`,
                backgroundColor: isActive ? activeColor : inactiveColor
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
