import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';

interface FeaturedChatbotCardProps {
  gender?: string;
}

export const FeaturedChatbotCard: React.FC<FeaturedChatbotCardProps> = ({ gender }) => {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // Use a featured image based on gender
  const featuredImage = gender === 'Male' 
    ? 'https://via.placeholder.com/400x500/333/fff?text=Featured+Male' 
    : 'https://via.placeholder.com/400x500/333/fff?text=Featured+Female';

  return (
    <div className="w-full px-4 sm:px-6 py-4">
      <div 
        className={`relative overflow-hidden rounded-2xl ${
          isDark 
            ? 'bg-gradient-to-br from-[#1a1410]/90 to-[#0a0807]/90' 
            : 'bg-gradient-to-br from-gray-900/95 to-black/95'
        }`}
        style={{
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        }}
      >
        {/* Background pattern */}
        <div 
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255, 197, 77, 0.15) 1px, transparent 0)',
            backgroundSize: '40px 40px',
          }}
        />

        <div className="relative grid grid-cols-1 md:grid-cols-2 gap-4 p-4 md:p-6">
          {/* Left side - Image */}
          <div className="relative h-64 md:h-80 rounded-xl overflow-hidden">
            <img 
              src={featuredImage}
              alt="Best NSFW AI Chatbot"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          </div>

          {/* Right side - Content */}
          <div className="flex flex-col justify-center gap-4">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">
                Best <span className="text-[var(--hl-gold)]">NSFW</span> AI Chatbot
              </h2>
              <p className="text-white/80 text-sm md:text-base leading-relaxed">
                Experience unrestricted conversations with the most advanced AI companion. 
                No limits, no judgment - just pure connection and fantasy brought to life.
              </p>
            </div>

            <button
              onClick={() => navigate('/chat')}
              className="inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 font-semibold text-black transition-all hover:scale-[1.02] w-full md:w-auto"
              style={{
                background: 'var(--primary-gradient)',
                boxShadow: '0 4px 16px rgba(255, 197, 77, 0.4)',
              }}
            >
              <svg 
                className="h-5 w-5" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" 
                />
              </svg>
              Chat Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FeaturedChatbotCard;
