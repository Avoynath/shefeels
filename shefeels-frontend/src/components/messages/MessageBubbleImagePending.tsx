/**
 * MessageBubbleImagePending - Placeholder component for async image generation
 * 
 * Displays an animated placeholder while an image is being generated in the background.
 * Shows different states: queued, generating, and provides visual feedback to the user
 * that the image is on its way without blocking their ability to continue chatting.
 */

import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { Loader2, Image as ImageIcon, AlertCircle } from 'lucide-react';
import type { Message, ImageJobStatus } from '../../types/chat';
import { useEffect, useRef } from 'react';

interface Props {
    m: Message;
    showTime?: boolean;
    onMeasure?: (h: number) => void;
}

function MessageBubbleImagePending({ m, showTime = true, onMeasure }: Props) {
    void showTime; // suppress unused warning
    const containerRef = useRef<HTMLDivElement | null>(null);
    const { theme } = useTheme();
    const isDark = theme === 'dark';
    const isMe = m.from === 'me';

    // Measure container height for virtualized list
    useEffect(() => {
        try {
            if (onMeasure && containerRef.current) {
                const h = Math.ceil(containerRef.current.getBoundingClientRect().height || 0);
                onMeasure(h);
            }
        } catch (e) { }
    }, [onMeasure]);

    const status: ImageJobStatus = m.imageJobStatus || 'queued';
    const isFailed = status === 'failed';
    const isGenerating = status === 'generating';

    // Status text based on current state
    const getStatusText = () => {
        if (isFailed) {
            return m.imageJobError || 'Image generation failed';
        }
        if (isGenerating) {
            return 'Generating image...';
        }
        return 'Preparing image...';
    };

    // Gradient animation for the shimmer effect
    const shimmerKeyframes = `
    @keyframes hl-shimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }
  `;

    return (
        <>
            <style>{shimmerKeyframes}</style>
            <div
                className={`bubble flex ${isMe ? 'justify-end' : 'justify-start'}`}
                style={{
                    maxWidth: '75%',
                    alignSelf: isMe ? 'flex-end' : 'flex-start',
                    boxSizing: 'border-box',
                    paddingRight: isMe ? 8 : undefined,
                    display: 'flex',
                    willChange: 'auto',
                    contain: 'layout style paint',
                }}
            >
                <div
                    ref={containerRef}
                    className="relative inline-flex flex-col items-center justify-center overflow-hidden rounded-xl"
                    style={{
                        width: 'min(320px, 75vw)',
                        height: isFailed ? 'auto' : '200px',
                        minHeight: isFailed ? '80px' : '200px',
                        padding: '24px',
                        transform: 'translateZ(0)',
                    }}
                >
                    {/* Shimmer overlay for loading states */}
                    {!isFailed && (
                        <div
                            className="absolute inset-0 pointer-events-none"
                            style={{
                                background: isDark
                                    ? 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.04) 50%, transparent 100%)'
                                    : 'linear-gradient(90deg, transparent 0%, rgba(0,0,0,0.03) 50%, transparent 100%)',
                                backgroundSize: '200% 100%',
                                animation: 'hl-shimmer 2s infinite linear',
                            }}
                        />
                    )}

                    {/* Icon */}
                    <div
                        className={`flex items-center justify-center rounded-full mb-3 ${isFailed
                                ? isDark
                                    ? 'bg-red-500/20'
                                    : 'bg-red-100'
                                : isDark
                                    ? 'bg-white/10'
                                    : 'bg-gray-100'
                            }`}
                        style={{
                            width: 48,
                            height: 48,
                        }}
                    >
                        {isFailed ? (
                            <AlertCircle
                                className={isDark ? 'text-red-400' : 'text-red-500'}
                                size={24}
                            />
                        ) : isGenerating ? (
                            <Loader2
                                className={`animate-spin ${isDark ? 'text-amber-400' : 'text-amber-500'
                                    }`}
                                size={24}
                            />
                        ) : (
                            <ImageIcon
                                className={isDark ? 'text-white/60' : 'text-gray-400'}
                                size={24}
                            />
                        )}
                    </div>

                    {/* Status text */}
                    <p
                        className={`text-sm font-medium text-center ${isFailed
                                ? isDark
                                    ? 'text-red-400'
                                    : 'text-red-600'
                                : isDark
                                    ? 'text-white/70'
                                    : 'text-gray-500'
                            }`}
                    >
                        {getStatusText()}
                    </p>

                    {/* Subtle progress dots for non-failed states */}
                    {!isFailed && (
                        <div className="flex items-center gap-1 mt-3">
                            {[0, 1, 2].map((i) => (
                                <div
                                    key={i}
                                    className={`w-1.5 h-1.5 rounded-full ${isDark ? 'bg-white/30' : 'bg-gray-300'
                                        }`}
                                    style={{
                                        animation: `pulse 1.4s ease-in-out ${i * 0.2}s infinite`,
                                    }}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}

// Memoize to prevent unnecessary re-renders
export default React.memo(MessageBubbleImagePending, (prevProps, nextProps) => {
    return (
        prevProps.m?.id === nextProps.m?.id &&
        prevProps.m?.imageJobStatus === nextProps.m?.imageJobStatus &&
        prevProps.m?.imageJobError === nextProps.m?.imageJobError &&
        prevProps.showTime === nextProps.showTime
    );
});
