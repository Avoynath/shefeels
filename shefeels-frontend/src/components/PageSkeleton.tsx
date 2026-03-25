import { useLocation } from 'react-router-dom';
import ChatSkeleton from './Skeletons/ChatSkeleton';
import DefaultSkeleton from './Skeletons/DefaultSkeleton';
import CreateCharacterSkeleton from './Skeletons/CreateCharacterSkeleton';
import ProfileSkeleton from './Skeletons/ProfileSkeleton';

export default function PageSkeleton() {
  const { pathname } = useLocation();

  if (pathname.startsWith('/chat')) return <ChatSkeleton />;
  if (pathname.startsWith('/create-character')) return <CreateCharacterSkeleton />;
  if (pathname.startsWith('/generate-image')) return <DefaultSkeleton />;
  if (pathname.startsWith('/profile')) return <ProfileSkeleton />;

  return <DefaultSkeleton />;
}
