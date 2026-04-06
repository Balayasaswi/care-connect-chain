import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage } from '../types.ts';
import { gemini } from '../services/geminiService.ts';
import { Send, LogOut, Info } from 'lucide-react';

interface ChatWindowProps {
  userId: string;
  onSessionEnd: (history: ChatMessage[]) => void;
  onSessionCheckpoint?: (history: ChatMessage[]) => void | Promise<void>;
}

const ChatWindow: React.FC<ChatWindowProps> = ({ userId, onSessionEnd, onSessionCheckpoint }) => {
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Initial greeting
  useEffect(() => {
    setHistory([
      {
        role: 'assistant',
        content: 'How are you feeling today?',
        timestamp: new Date().toISOString(),
      },
    ]);
  }, []);

  // Auto-scroll to bottom whenever history updates
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history, isLoading]);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const messageText = input.trim();
    if (!messageText || isLoading || isEnding) return;

    const userMsg: ChatMessage = {
      role: 'user',
      content: messageText,
      timestamp: new Date().toISOString(),
    };

    // Store the history before the update for the API call
    const previousHistory = [...history];

    // Update state optimistically
    setHistory((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      // Pass the history (without the new message) to the service.
      // The chat.sendMessage API will internally handle adding the current user input to context.
      const responseText = await gemini.getChatResponse(previousHistory, messageText);

      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: responseText,
        timestamp: new Date().toISOString(),
      };

      setHistory((prev) => [...prev, assistantMsg]);
      const checkpointHistory = [...previousHistory, userMsg, assistantMsg];
      if (onSessionCheckpoint) {
        void Promise.resolve(onSessionCheckpoint(checkpointHistory)).catch((checkpointError) => {
          console.error('Checkpoint pin error:', checkpointError);
        });
      }
    } catch (error) {
      console.error('Chat Error:', error);
      const errorMsg: ChatMessage = {
        role: 'assistant',
        content: "I'm having a brief connection issue. Let's try again in a moment.",
        timestamp: new Date().toISOString(),
      };
      setHistory((prev) => [...prev, errorMsg]);
      const checkpointHistory = [...previousHistory, userMsg, errorMsg];
      if (onSessionCheckpoint) {
        void Promise.resolve(onSessionCheckpoint(checkpointHistory)).catch((checkpointError) => {
          console.error('Checkpoint pin error:', checkpointError);
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleEndSession = () => {
    const finalMsg: ChatMessage = {
      role: 'assistant',
      content: 'This session has ended and is securely stored.',
      timestamp: new Date().toISOString(),
    };

    const finalHistory = [...history, finalMsg];
    setHistory(finalHistory);
    setIsEnding(true);

    setTimeout(() => {
      onSessionEnd(finalHistory);
    }, 1500);
  };

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100">
      <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
        <div>
          <h2 className="font-serif text-xl text-slate-800">Care Connect Listener</h2>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
            <span className="text-xs text-slate-500 uppercase tracking-widest font-semibold">
              Active Session
            </span>
          </div>
        </div>
        <button
          onClick={handleEndSession}
          disabled={isEnding}
          className="flex items-center gap-2 px-4 py-2 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-xl transition-colors text-sm font-medium disabled:opacity-50"
        >
          <LogOut size={16} />
          End Session
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth">
        {history.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`
              max-w-[80%] px-5 py-3 rounded-2xl text-base leading-relaxed
              ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-tr-none'
                  : 'bg-slate-100 text-slate-800 rounded-tl-none'
              }
            `}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-slate-100 px-5 py-3 rounded-2xl rounded-tl-none flex gap-1">
              <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></span>
              <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.2s]"></span>
              <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.4s]"></span>
            </div>
          </div>
        )}
      </div>

      {!isEnding && (
        <form onSubmit={handleSend} className="p-6 bg-slate-50 border-t border-slate-100">
          <div className="flex gap-4">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="How are you feeling right now?"
              className="flex-1 px-5 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              <Send size={20} />
            </button>
          </div>
          <div className="mt-4 flex items-center justify-center gap-2 text-[10px] text-slate-400 uppercase tracking-widest">
            <Info size={12} />
            Secure Private Connection
          </div>
        </form>
      )}
    </div>
  );
};

export default ChatWindow;
