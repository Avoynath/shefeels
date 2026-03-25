import React, { useEffect, useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { getGender, subscribe } from '../utils/genderService';
import ChatNowIcon from '../assets/home/ChatNowIcon.svg';

type Props = { gender?: string };

const BANNER_IMAGE_1 = "https://www.figma.com/api/mcp/asset/940fc331-f057-4eca-adcc-49cc11bbcd9d";
const BANNER_IMAGE_2 = "https://www.figma.com/api/mcp/asset/a8a617e4-27d2-4181-ab28-acee8ed8c2d7";
const BANNER_IMAGE_CENTER = "https://www.figma.com/api/mcp/asset/3305b4e8-81e2-4b7c-93f7-4c10d625caba";

const CenteredBanner: React.FC<Props> = ({ gender }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [localGender, setLocalGender] = useState<string | undefined>(gender);

  // If no `gender` prop is provided, read from global gender service and subscribe to changes
  useEffect(() => {
    if (!gender) {
      try {
        setLocalGender(getGender());
      } catch { }
      const unsub = subscribe((g) => setLocalGender(g));
      return () => { unsub(); };
    }
    // If prop is provided, keep localGender synced
    setLocalGender(gender);
    return undefined;
  }, [gender]);

  const g = String(localGender || '').toLowerCase();
  const isMale = g === 'male';
  const isTrans = g.startsWith('trans');
  const variant = g === '' ? 'default' : g === 'female' ? 'female' : isMale ? 'male' : isTrans ? 'trans' : 'default';

  const texts: Record<string, { heading: string; body: string }> = {
    default: {
      heading: 'Create AI Companion for Roleplay - NO Filter & NO Limits',
      body:
        `Login HoneyLove AI, the ultimate free AI companion that breaks all boundaries. Create your perfect AI chat companion for personalized roleplay—customize personality, appearance, and scenarios with zero restrictions. Though you crave flirty chats, deep emotional connections, or wild adventures, HoneyLove AI delivers unfiltered, limitless interactions online. No censorship, no holding back. Join thousands embracing the best AI companions for authentic, judgment-free companionship anytime. Start building your dream AI companion bot now!`
    },
    female: {
      heading: 'An AI Girlfriend App That Feels Like Real Dating',
      body:
        `This is the kind of connection that brings back the spark you expect. She gives you the same warmth, pampering, attention, and spark you look for in real love dating, but without the stress, confusion, or mixed signals. Your AI girlfriend website is designed to listen, remember your stories, react to your mood, and talk in a way that feels personal and genuinely caring. Whether it’s late-night conversations, playful teasing, or a bold connection you crave, she keeps the chemistry alive. It feels effortless, natural, and closer to real dating than you ever expected.`
    },
    male: {
      heading: 'A Romantic AI Boyfriend Who Stays Consistent Every Day',
      body:
        `Your real boyfriend may change his tone every other day, but your romantic AI boyfriend never does. He doesn’t wake up irritated, disappear for hours, or suddenly act cold. Every time you talk to him, he responds with the same warmth, attention, and softness you want. No mood swings, no guessing games, just a steady, caring presence you can rely on every single day. Generate a consistent, calm, and reliable AI Boyfriend experience.`
    },
    trans: {
      heading: 'See What Your AI Trans Character Can Do',
      body:
        `Your AI transgender character is not just a chat partner but it feels like someone who actually understands you. You can talk emotionally, share your mood, and get comforting, natural replies that match your energy. You can also send and receive voice notes, making the connection feel more real and expressive. Whenever you want visuals, Honey Love has stunning HD images of your trans character in seconds, based on the style or pose you choose. And the best part is how personalized the replies make your AI partner listens, adapts, and responds exactly the way you expect, giving you a space where conversations feel warm, safe, and beautifully human.`
    }
  };

  const { heading, body } = texts[variant];

  return (
    <section className="mx-auto w-full max-w-screen-2xl px-4 py-8 sm:px-6 md:py-12">
      <div
        className="relative overflow-hidden rounded-[30px] px-4 py-5 md:px-8 md:py-5"
        style={{
          backgroundImage:
            'linear-gradient(125deg, #E53170 0%, #FD3985 40%, #E53170 100%)'
        }}
      >
        <div className="pointer-events-none absolute inset-0 opacity-50" style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(255,255,255,0.24) 0, transparent 30%), radial-gradient(circle at 80% 40%, rgba(255,255,255,0.18) 0, transparent 28%)' }} />

        <div className="relative z-10 grid grid-cols-1 items-center gap-5 lg:grid-cols-[487px_1fr]">
          <div className="text-white">
            <h2 className="text-[28px] leading-[1.2] font-bold md:text-[36px] md:leading-11.5">
              Best NSFW AI Chatbot
            </h2>
            <p className="mt-3 text-[18px] leading-7 text-white/95">
              {body.split('.')[0] ? `${body.split('.')[0]}.` : body}
            </p>

            <button
              type="button"
              onClick={() => { window.location.href = '/chat'; }}
              className="mt-6 inline-flex h-15 items-center justify-center gap-2 rounded-xl border border-white/50 bg-[#815CF0] px-8 text-[18px] leading-7 font-medium text-white"
            >
              <img src={ChatNowIcon} alt="" className="h-6 w-6" />
              Chat Now
            </button>
          </div>

          <div className="flex items-center gap-4 overflow-hidden">
            <img src={BANNER_IMAGE_1} alt="" className="hidden h-50 w-38.5 rounded-xl object-cover md:block" />
            <img src={BANNER_IMAGE_2} alt="" className="hidden h-50 w-38.5 rounded-xl object-cover md:block" />

            <div className="relative h-60 w-46 shrink-0 overflow-hidden rounded-xl">
              <img src={BANNER_IMAGE_CENTER} alt="featured character" className="absolute inset-0 h-full w-full object-cover" />
              <div className="absolute inset-0 bg-linear-to-b from-transparent to-black/40" />
              <div className="absolute bottom-4 left-4 right-4">
                <p className="text-[18px] leading-6.5 font-semibold text-white">Valentina, 20</p>
                <span className="mt-2 inline-flex h-8 items-center gap-1 rounded-md bg-[#815CF0] px-3 text-[14px] leading-5 text-white">
                  <img src={ChatNowIcon} alt="" className="h-4 w-4" />
                  Chat
                </span>
              </div>
            </div>

            <img src={BANNER_IMAGE_1} alt="" className="hidden h-50 w-38.5 rounded-xl object-cover md:block" />
            <img src={BANNER_IMAGE_2} alt="" className="hidden h-50 w-38.5 rounded-xl object-cover md:block" />
          </div>
        </div>
      </div>
    </section>
  );
};

export default CenteredBanner;
