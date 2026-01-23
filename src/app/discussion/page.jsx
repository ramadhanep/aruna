"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { 
  Loader2, 
  Send, 
  ArrowLeft,
  Trash2
} from "lucide-react";
import { fetchEncodedJson } from "@/lib/api-client";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import Link from "next/link";

/**
 * Parse message content and convert stock mentions to links
 * $CODE -> /chart?symbol=CODE.JK (IDX stocks)
 * US$CODE -> /chart?symbol=CODE (US stocks)
 */
function parseMessageContent(content) {
  if (!content) return null;
  
  const parts = [];
  let lastIndex = 0;
  
  // Combined regex for both US$ and $ mentions
  const mentionRegex = /(US\$[A-Z]{1,5})|(?<!US)(\$[A-Z]{4})/gi;
  let match;
  
  while ((match = mentionRegex.exec(content)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      parts.push({
        type: 'text',
        content: content.slice(lastIndex, match.index)
      });
    }
    
    const matchedText = match[0];
    
    if (matchedText.toUpperCase().startsWith('US$')) {
      // US stock
      const code = matchedText.slice(3).toUpperCase();
      parts.push({
        type: 'mention',
        content: matchedText,
        symbol: code,
        isUS: true
      });
    } else {
      // IDX stock
      const code = matchedText.slice(1).toUpperCase();
      parts.push({
        type: 'mention',
        content: matchedText,
        symbol: `${code}.JK`,
        isUS: false
      });
    }
    
    lastIndex = match.index + matchedText.length;
  }
  
  // Add remaining text
  if (lastIndex < content.length) {
    parts.push({
      type: 'text',
      content: content.slice(lastIndex)
    });
  }
  
  return parts;
}

function MessageBubble({ message, isOwn, onDelete, currentUserId }) {
  const router = useRouter();
  const parsedContent = parseMessageContent(message.content);
  const [showDelete, setShowDelete] = useState(false);
  
  const handleMentionClick = (symbol) => {
    router.push(`/chart?symbol=${encodeURIComponent(symbol)}`);
  };

  // System messages have different styling (centered, italic, no bubble)
  if (message.isSystem) {
    return (
      <div className="flex justify-center py-1">
        <p className="text-[10px] italic text-white/40 text-center">
          {message.content}
        </p>
      </div>
    );
  }

  return (
    <div 
      className={`flex ${isOwn ? 'justify-end' : 'justify-start'} group`}
      onMouseEnter={() => setShowDelete(true)}
      onMouseLeave={() => setShowDelete(false)}
    >
      <div className={`max-w-[85%] ${isOwn ? 'order-2' : 'order-1'}`}>
        {/* User info */}
        {!isOwn && (
          <div className="flex items-center gap-1.5 mb-0.5 px-1">
            {message.user?.avatar ? (
              <img 
                src={message.user.avatar} 
                alt="" 
                className="w-4 h-4 rounded-full"
              />
            ) : (
              <div className="w-4 h-4 rounded-full bg-emerald-900/50 flex items-center justify-center">
                <span className="text-[8px] font-bold text-emerald-500">
                  {message.user?.name?.charAt(0)?.toUpperCase() || '?'}
                </span>
              </div>
            )}
            <span className="text-[9px] text-white/50 font-medium">
              {message.user?.name || 'Anonymous'}
            </span>
          </div>
        )}
        
        {/* Message bubble */}
        <div 
          className={`relative px-3 py-2 rounded-2xl ${
            isOwn 
              ? 'bg-emerald-900/40 border border-emerald-800/30 rounded-br-md' 
              : 'bg-white/5 border border-white/10 rounded-bl-md'
          }`}
        >
          <p className="text-xs leading-relaxed text-white/90 break-words">
            {parsedContent?.map((part, i) => {
              if (part.type === 'mention') {
                return (
                  <button
                    key={i}
                    onClick={() => handleMentionClick(part.symbol)}
                    className={`font-semibold ${
                      part.isUS ? 'text-blue-400 hover:text-blue-300' : 'text-emerald-400 hover:text-emerald-300'
                    } transition-colors`}
                  >
                    {part.content}
                  </button>
                );
              }
              return <span key={i}>{part.content}</span>;
            }) || message.content}
          </p>
          
          {/* Timestamp */}
          <p className={`text-[8px] mt-1 ${isOwn ? 'text-emerald-500/50' : 'text-white/30'}`}>
            {new Date(message.createdAt).toLocaleTimeString('id-ID', {
              hour: '2-digit',
              minute: '2-digit'
            })}
          </p>
        </div>
      </div>
      
      {/* Delete button */}
      {isOwn && showDelete && (
        <button
          onClick={() => onDelete(message.id)}
          className="order-1 self-center mr-1 p-1 rounded-full hover:bg-red-900/30 transition-colors"
        >
          <Trash2 className="w-3 h-3 text-red-400/70" />
        </button>
      )}
    </div>
  );
}

function MessageInput({ onSend, disabled }) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const inputRef = useRef(null);

  const handleSend = async () => {
    if (!message.trim() || sending || disabled) return;
    
    setSending(true);
    try {
      await onSend(message.trim());
      setMessage("");
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="sticky bottom-0 bg-background/95 backdrop-blur border-t border-border/40 p-3">
      <div className="flex items-end gap-2">
        <textarea
          ref={inputRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={disabled ? "Sign in to chat..." : "Type a message..."}
          disabled={disabled || sending}
          maxLength={1000}
          rows={1}
          className="flex-1 px-3 py-2.5 text-xs bg-white/5 border border-white/10 rounded-xl resize-none focus:outline-none focus:ring-1 focus:ring-emerald-500/50 placeholder:text-white/30 disabled:opacity-50"
          style={{ minHeight: '36px', maxHeight: '100px' }}
        />
        <Button
          onClick={handleSend}
          disabled={!message.trim() || sending || disabled}
          size="icon"
          className="h-10 w-14 rounded-xl bg-emerald-900 hover:bg-emerald-800 border border-emerald-800/30 text-white"
        >
          {sending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </Button>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center">
      <p className="text-xs text-white/40">No messages yet</p>
      <p className="text-[10px] text-white/30 mt-1">Start the conversation!</p>
    </div>
  );
}

export default function DiscussionPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [supabase] = useState(() => getSupabaseBrowserClient());
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(true);
  const messagesEndRef = useRef(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Redirect to signin if not authenticated (after auth check completes)
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/signin?redirect=discussion');
    }
  }, [user, authLoading, router]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Handle keyboard appearance on mobile
  useEffect(() => {
    const handleResize = () => {
      if (typeof window !== 'undefined' && window.visualViewport) {
        const viewportHeight = window.visualViewport.height;
        const windowHeight = window.innerHeight;
        const keyboardOpen = windowHeight - viewportHeight;
        setKeyboardHeight(keyboardOpen > 0 ? keyboardOpen : 0);
      }
    };

    if (typeof window !== 'undefined' && window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize);
      handleResize();
      
      return () => {
        window.visualViewport.removeEventListener('resize', handleResize);
      };
    }
  }, []);

  // Hide mobile nav and header
  useEffect(() => {
    document.body.style.overflow = "hidden";
    const header = document.querySelector("header");
    const nav = document.querySelector("nav");
    const bottomNav = document.querySelector(".mobile-bottom-nav");
    
    if (header) header.style.display = "none";
    if (nav) nav.style.display = "none";
    if (bottomNav) bottomNav.style.display = "none";

    return () => {
      document.body.style.overflow = "";
      if (header) header.style.display = "";
      if (nav) nav.style.display = "";
      if (bottomNav) bottomNav.style.display = "";
    };
  }, []);

  const fetchMessages = useCallback(async () => {
    if (!user) return; // Don't fetch if not authenticated
    
    try {
      const { data } = await fetchEncodedJson('/api/discussions?limit=100');
      setMessages(data?.messages || []);
      setTimeout(scrollToBottom, 100);
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    } finally {
      setMessagesLoading(false);
    }
  }, [scrollToBottom, user]);

  useEffect(() => {
    if (!user) return;
    
    fetchMessages();
    
    // Auto-refresh every 10 seconds
    const interval = setInterval(fetchMessages, 10000);
    return () => clearInterval(interval);
  }, [fetchMessages, user]);

  // Show loading while checking auth - redirect happens via useEffect
  if (authLoading || !user) {
    return (
      <div className="fixed inset-0 w-screen h-screen overflow-hidden flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-white/50" />
      </div>
    );
  }

  const handleSendMessage = async (content) => {
    if (!user) return;
    
    try {
      // Extract mentions
      const mentionRegex = /(US\$[A-Z]{1,5})|(?<!US)(\$[A-Z]{4})/gi;
      const mentions = [];
      let match;
      while ((match = mentionRegex.exec(content)) !== null) {
        if (match[0].toUpperCase().startsWith('US$')) {
          mentions.push(match[0].slice(3).toUpperCase());
        } else {
          mentions.push(match[0].slice(1).toUpperCase() + '.JK');
        }
      }

      // Insert using browser client (RLS will handle auth)
      const { data, error } = await supabase
        .from('discussion_messages')
        .insert({
          user_id: user.id,
          content: content.trim(),
          mentions,
        })
        .select('*')
        .single();

      if (error) throw error;

      // Fetch user profile for display
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, avatar_url, email')
        .eq('id', user.id)
        .single();

      const newMessage = {
        id: data.id,
        content: data.content,
        mentions: data.mentions || [],
        replyToId: data.reply_to_id,
        isSystem: data.is_system || false,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        userId: data.user_id,
        user: profile ? {
          name: profile.full_name || profile.email?.split('@')[0] || 'Anonymous',
          avatar: profile.avatar_url,
        } : { name: 'Anonymous', avatar: null },
      };

      setMessages(prev => [...prev, newMessage]);
      setTimeout(scrollToBottom, 100);
    } catch (err) {
      console.error('Failed to send message:', err);
      alert(err.message || 'Failed to send message');
    }
  };

  const handleDeleteMessage = async (messageId) => {
    if (!confirm('Delete this message?')) return;
    
    try {
      const { error } = await supabase
        .from('discussion_messages')
        .delete()
        .eq('id', messageId)
        .eq('user_id', user.id);

      if (error) throw error;
      setMessages(prev => prev.filter(m => m.id !== messageId));
    } catch (err) {
      console.error('Failed to delete message:', err);
      alert(err.message || 'Failed to delete message');
    }
  };

  return (
    <div 
      className="fixed inset-0 w-screen flex flex-col pb-10"
      style={{ 
        height: keyboardHeight > 0 ? `${window.innerHeight - keyboardHeight}px` : '100vh',
        overflow: 'hidden'
      }}
    >
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-3 py-2.5 border-b border-white/5">
        <button
          onClick={() => router.push('/')}
          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
        >
          <ArrowLeft className="size-6 text-muted-foreground" />
        </button>
        <h1 className="text-sm font-bold text-white">Discussion</h1>
        <div className="w-8" />
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-3 py-3" style={{ minHeight: 0 }}>
        {messagesLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-white/50" />
          </div>
        ) : messages.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-2.5">
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                isOwn={user?.id === message.userId}
                onDelete={handleDeleteMessage}
                currentUserId={user?.id}
              />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Message input */}
      <MessageInput 
        onSend={handleSendMessage} 
        disabled={!user}
      />
    </div>
  );
}
