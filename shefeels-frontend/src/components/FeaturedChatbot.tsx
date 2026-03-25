import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { Sparkles } from 'lucide-react';

export const FeaturedChatbot: React.FC = () => {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <div className="w-full px-4 py-4 md:hidden">
      <div 
        className="relative rounded-2xl overflow-hidden"
        style={{
          background: isDark 
            ? 'linear-gradient(135deg, rgba(255, 197, 77, 0.15) 0%, rgba(192, 155, 98, 0.1) 100%)'
            : 'linear-gradient(135deg, rgba(255, 197, 77, 0.2) 0%, rgba(192, 155, 98, 0.15) 100%)',
        }}
      >
        {/* Background image with overlay */}
        <div 
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: 'url(https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&q=80)',
            filter: 'brightness(0.6) saturate(1.2)',
          }}
        />
        
        {/* Content overlay */}
        <div className="relative z-10 p-6 flex flex-col items-center text-center">
          <h3 className="text-white text-xl font-bold mb-2">
            Best <span className="text-[var(--hl-gold)]">NSFW</span> AI Chatbot
          </h3>
          
          <p className="text-white/80 text-sm mb-4 max-w-xs">
            Experience the most advanced AI companions with unlimited possibilities
          </p>
          
          <button
            onClick={() => navigate('/chat')}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full font-semibold text-sm transition-all hover:scale-105"
            style={{
              background: 'var(--primary-gradient)',
              color: 'var(--hl-black)',
              boxShadow: '0 4px 20px rgba(255, 197, 77, 0.4)',
            }}
          >
            <Sparkles className="h-4 w-4" />
            Chat Now
          </button>
        </div>
      </div>
    </div>
  );
};

export default FeaturedChatbot;
