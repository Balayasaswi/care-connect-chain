
import * as React from 'react';
import { SessionRecord } from '../types.ts';
import { Calendar, Clock, ChevronRight, MessageCircle } from 'lucide-react';

interface SessionListProps {
  sessions: SessionRecord[];
  onSelect: (session: SessionRecord) => void;
  showSummary?: boolean;
}

const SessionList: React.FC<SessionListProps> = ({ sessions, onSelect, showSummary = true }) => {
  if (sessions.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-2xl border border-slate-100 shadow-sm">
        <p className="text-slate-400">No past sessions found. Start a new one to begin.</p>
      </div>
    );
  }

  const getEmotionColor = (emotion: string) => {
    switch (emotion) {
      case 'HAPPY': return 'bg-emerald-100 text-emerald-700';
      case 'GOOD': return 'bg-blue-100 text-blue-700';
      case 'NEUTRAL': return 'bg-slate-100 text-slate-700';
      case 'BAD': return 'bg-orange-100 text-orange-700';
      case 'CRITICAL': return 'bg-rose-100 text-rose-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {sessions.map((session) => (
        <button
          key={session.id}
          onClick={() => onSelect(session)}
          className="text-left p-6 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all group active:scale-[0.98] flex flex-col h-full"
        >
          <div className="flex justify-between items-start mb-4">
            {showSummary ? (
              <div className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${getEmotionColor(session.summary.emotion)}`}>
                {session.summary.emotion}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-indigo-600">
                <MessageCircle size={18} />
                <span className="text-xs font-bold uppercase tracking-widest">Conversation Log</span>
              </div>
            )}
            <span className="text-slate-400 group-hover:text-slate-600 transition-colors">
              <Calendar size={18} />
            </span>
          </div>
          
          <p className="text-slate-800 font-medium line-clamp-2 mb-4 h-12">
            {showSummary ? session.summary.summary : "A private conversation from your journey."}
          </p>

          <div className="mt-auto space-y-2 text-xs text-slate-500">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock size={14} />
                <span>{new Date(session.summary.start_time_stamp).toLocaleDateString()}</span>
              </div>
              {!showSummary && <ChevronRight size={14} className="text-slate-300" />}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
};

export default SessionList;
