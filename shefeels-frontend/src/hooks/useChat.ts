/**
 * Custom hooks for chat functionality
 * Handles message sending, streaming responses, and chat history
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { apiClient, getErrorMessage, isAuthError } from '../utils/api';
import type { ChatCreate } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';

export interface ChatMessage {
  id: string;
  from: 'ai' | 'me';
  type: 'text' | 'audio';
  text?: string;
  duration?: string;
  time?: string;
  loading?: boolean;
}

export interface UseChatResult {
  messages: ChatMessage[];
  loading: boolean;
  error: string | null;
  sending: boolean;
  sendMessage: (content: string, characterId: number, sessionId?: string) => Promise<void>;
  sendStreamingMessage: (content: string, chatId: number) => Promise<void>;
  loadChatHistory: (userId?: number) => Promise<void>;
  clearMessages: () => void;
  addMessage: (message: ChatMessage) => void;
}

/**
 * Hook for managing chat functionality
 */
export function useChat(): UseChatResult {
  const { isAuthenticated, logout } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  const addMessage = useCallback((message: ChatMessage) => {
    setMessages(prev => [...prev, message]);
  }, []);

  const loadChatHistory = useCallback(async (userId?: number) => {
    if (!isAuthenticated) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const data = await apiClient.getAllChats(userId);
      
      // Convert API messages to UI format.
      // Backend historically returned { content, sender_type }, but current API uses
      // { user_query, ai_message, created_at, character_id, ... }.
      // Be defensive and support both shapes so history renders regardless of API shape.
      const uiMessages: ChatMessage[] = data.flatMap((msg: any, index: number) => {
        const id = `msg-${msg.id || index}`;
        const createdAt = msg.created_at || msg.createdAt || new Date().toISOString();

        const time = new Date(createdAt).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        });

        // If the backend returned both user_query and ai_message, expose two UI messages
        // (user then assistant) so the conversation shows both sides. Otherwise, fall
        // back to legacy (content/sender_type) shape and emit a single message.
        const out: ChatMessage[] = [];

        if (msg.user_query !== undefined || msg.ai_message !== undefined) {
          if (msg.user_query !== undefined) {
            out.push({
              id: `${id}-u`,
              from: 'me',
              type: 'text',
              text: String(msg.user_query || ''),
              time,
            });
          }
          if (msg.ai_message !== undefined) {
            out.push({
              id: `${id}-a`,
              from: 'ai',
              type: 'text',
              text: String(msg.ai_message || ''),
              time,
            });
          }
        } else {
          // legacy shape
          out.push({
            id,
            from: msg.sender_type === 'user' ? 'me' : 'ai',
            type: 'text',
            text: String(msg.content || msg.text || ''),
            time,
          });
        }

        return out;
      });
      
      setMessages(uiMessages);
    } catch (err) {
      if (isAuthError(err)) {
        logout();
      } else {
        setError(getErrorMessage(err));
      }
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, logout]);

  const sendMessage = useCallback(async (
    content: string, 
    characterId: number, 
    sessionId: string = `session-${Date.now()}`
  ) => {
    if (!isAuthenticated || !content.trim()) return;
    
    setSending(true);
    setError(null);

    // Add user message immediately
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      from: 'me',
      type: 'text',
      text: content,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    
    addMessage(userMessage);

    // Add loading AI message
    const loadingMessage: ChatMessage = {
      id: `ai-loading-${Date.now()}`,
      from: 'ai',
      type: 'text',
      text: 'Typing...',
      loading: true,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    
    addMessage(loadingMessage);

    try {
      const chatData: ChatCreate = {
        session_id: sessionId,
        character_id: characterId,
        user_query: content,
        client_timestamp: new Date().toISOString(),
      };

      const response = await apiClient.sendChatMessage(chatData);
      
      // Remove loading message and add real response
      setMessages(prev => prev.filter(msg => msg.id !== loadingMessage.id));
      
      const aiMessage: ChatMessage = {
        id: `ai-${Date.now()}`,
        from: 'ai',
        type: 'text',
        text: response.chat_response,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      
      addMessage(aiMessage);
      
    } catch (err) {
      // Remove loading message on error
      setMessages(prev => prev.filter(msg => msg.id !== loadingMessage.id));
      
      if (isAuthError(err)) {
        logout();
      } else {
        setError(getErrorMessage(err));
        
        // Add error message
        const errorMessage: ChatMessage = {
          id: `error-${Date.now()}`,
          from: 'ai',
          type: 'text',
          text: 'Sorry, I encountered an error. Please try again.',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        
        addMessage(errorMessage);
      }
    } finally {
      setSending(false);
    }
  }, [isAuthenticated, logout, addMessage]);

  const sendStreamingMessage = useCallback(async (content: string, chatId: number) => {
    if (!isAuthenticated || !content.trim()) return;
    
    setSending(true);
    setError(null);

    // Add user message immediately
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      from: 'me',
      type: 'text',
      text: content,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    
    addMessage(userMessage);

    // Add streaming AI message
    const streamingMessageId = `ai-stream-${Date.now()}`;
    const streamingMessage: ChatMessage = {
      id: streamingMessageId,
      from: 'ai',
      type: 'text',
      text: '',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    
    addMessage(streamingMessage);

    try {
      // Cancel any existing stream
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      abortControllerRef.current = new AbortController();
      
      const stream = await apiClient.streamChatMessage(chatId, content, new Date().toISOString());
      const chunks = apiClient.readStreamingResponse(stream);
      
      let accumulatedText = '';
      
      for await (const chunk of chunks) {
        // Check if we should abort
        if (abortControllerRef.current?.signal.aborted) {
          break;
        }
        
        accumulatedText += chunk;
        
        // Update the streaming message with accumulated text
        setMessages(prev => prev.map(msg => 
          msg.id === streamingMessageId 
            ? { ...msg, text: accumulatedText }
            : msg
        ));
      }
      
    } catch (err) {
      // Remove streaming message on error
      setMessages(prev => prev.filter(msg => msg.id !== streamingMessageId));
      
      if (isAuthError(err)) {
        logout();
      } else {
        setError(getErrorMessage(err));
        
        // Add error message
        const errorMessage: ChatMessage = {
          id: `error-${Date.now()}`,
          from: 'ai',
          type: 'text',
          text: 'Sorry, I encountered an error with the streaming response. Please try again.',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        
        addMessage(errorMessage);
      }
    } finally {
      setSending(false);
      abortControllerRef.current = null;
    }
  }, [isAuthenticated, logout, addMessage]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    messages,
    loading,
    error,
    sending,
    sendMessage,
    sendStreamingMessage,
    loadChatHistory,
    clearMessages,
    addMessage,
  };
}

/**
 * Hook for generating a unique session ID for chat sessions
 */
export function useChatSession() {
  const [sessionId] = useState(() => `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  return sessionId;
}
