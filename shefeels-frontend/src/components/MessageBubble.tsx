import React from 'react';
import MessageBubbleText from './messages/MessageBubbleText';
import MessageBubbleImage from './messages/MessageBubbleImage';
import MessageBubbleAudio from './messages/MessageBubbleAudio';
import type { Message } from '../types/chat';

function MessageBubbleSelector({ m, showTime = true, onMeasure, isContinuation = false, hasTimeAbove = false }: { m: Message; showTime?: boolean; onMeasure?: (h: number) => void; isContinuation?: boolean; hasTimeAbove?: boolean }) {
  if (!m) return null as any;
  // Image messages (including those that completed from async generation)
  if (m.type === 'image') return <MessageBubbleImage m={m} showTime={showTime} onMeasure={onMeasure} />;
  if (m.type === 'audio' || m.type === 'voice') return <MessageBubbleAudio m={m} showTime={showTime} onMeasure={onMeasure} />;
  // Text messages (including "Sending image..." that are waiting for async image)
  return <MessageBubbleText m={m} showTime={showTime} onMeasure={onMeasure} isContinuation={isContinuation} hasTimeAbove={hasTimeAbove} />;
}

export const MemoMessageBubble = React.memo(MessageBubbleSelector, (prevProps: any, nextProps: any) => {
  try {
    if (prevProps.m?.id && nextProps.m?.id && String(prevProps.m.id) === String(nextProps.m.id)) {
      return prevProps.showTime === nextProps.showTime && prevProps.isContinuation === nextProps.isContinuation && prevProps.hasTimeAbove === nextProps.hasTimeAbove;
    }
    return prevProps.m?.from === nextProps.m?.from && prevProps.m?.type === nextProps.m?.type && prevProps.m?.text === nextProps.m?.text && prevProps.m?.imageUrl === nextProps.m?.imageUrl && prevProps.m?.audioUrl === nextProps.m?.audioUrl && prevProps.showTime === nextProps.showTime && prevProps.isContinuation === nextProps.isContinuation && prevProps.hasTimeAbove === nextProps.hasTimeAbove;
  } catch (e) {
    return false;
  }
});

export default MessageBubbleSelector;
