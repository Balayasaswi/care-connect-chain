
import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { User, SessionRecord, ChatMessage, UserRole } from './types.ts';
import { gemini } from './services/geminiService.ts';
import ChatWindow from './components/ChatWindow.tsx';
import SessionList from './components/SessionList.tsx';
import { Shield, Plus, User as UserIcon, LogOut, ChevronLeft, Lock, Users, History, AlertCircle } from 'lucide-react';

const API_BASE_URL = 'http://localhost:5000';

// --- Authentication View ---
const Login: React.FC<{ onLogin: (u: User) => void }> = ({ onLogin }) => {
  const [role, setRole] = useState<UserRole>('student');
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [guardianName, setGuardianName] = useState('');
  const [guardianEmail, setGuardianEmail] = useState('');
  const [studentEmail, setStudentEmail] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const postJson = async (url: string, body: Record<string, unknown>) => {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(errText || 'Request failed');
    }

    return res.json();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    const sanitizedEmail = email.toLowerCase().trim();
    const sanitizedStudentEmail = studentEmail.toLowerCase().trim();
    const sanitizedGuardianEmail = guardianEmail.toLowerCase().trim();

    try {
      if (role === 'student') {
        if (mode === 'register') {
          if (!username.trim()) {
            throw new Error('Username is required.');
          }
          if (!sanitizedEmail || password.length < 6) {
            throw new Error('Enter a valid email and 6+ character password.');
          }

          await postJson(`${API_BASE_URL}/api/auth/register`, {
            username: username.trim(),
            email: sanitizedEmail,
            password
          });
        }

        if (!sanitizedEmail || password.length < 6) {
          throw new Error('Enter a valid email and 6+ character password.');
        }

        const loginResult = await postJson(`${API_BASE_URL}/api/auth/login`, {
          username: sanitizedEmail,
          password
        });

        onLogin({
          id: loginResult.user.id,
          email: loginResult.user.email,
          username: loginResult.user.username,
          role: 'student'
        });
      } else {
        if (!guardianName.trim()) {
          throw new Error('Guardian name is required.');
        }
        if (!sanitizedGuardianEmail) {
          throw new Error('Guardian email is required.');
        }
        if (!sanitizedStudentEmail) {
          throw new Error('Student email is required.');
        }

        const studentRes = await fetch(`${API_BASE_URL}/api/user?email=${encodeURIComponent(sanitizedStudentEmail)}`);
        if (!studentRes.ok) {
          throw new Error('Student not registered.');
        }
        const student = await studentRes.json();

        const guardianRes = await fetch(`${API_BASE_URL}/api/guardian/${student.id}`);
        if (!guardianRes.ok) {
          throw new Error('Guardian not registered for this student.');
        }
        const guardian = await guardianRes.json();

        if ((guardian.guardian_name || '').toLowerCase() !== guardianName.trim().toLowerCase()) {
          throw new Error('Guardian name does not match our records.');
        }
        if ((guardian.guardian_email || '').toLowerCase() !== sanitizedGuardianEmail) {
          throw new Error('Guardian email does not match our records.');
        }

        onLogin({
          id: guardian.student_id,
          email: sanitizedGuardianEmail,
          role: 'guardian',
          name: guardian.guardian_name,
          studentEmail: sanitizedStudentEmail,
          studentId: guardian.student_id
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication failed.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-slate-50">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 border border-slate-100">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 mb-6">
            <Shield size={32} />
          </div>
          <h1 className="font-serif text-3xl text-slate-900 mb-2">Care Connect Chain</h1>
          <p className="text-slate-500 text-sm">Secure Emotional Support Network</p>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-xl mb-6">
          <button 
            onClick={() => { setRole('student'); setError(''); }}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${role === 'student' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'}`}
          >
            Student
          </button>
          <button 
            onClick={() => { setRole('guardian'); setError(''); }}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${role === 'guardian' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'}`}
          >
            Guardian
          </button>
        </div>

        {role === 'student' && (
          <div className="flex bg-slate-100 p-1 rounded-xl mb-6">
            <button
              type="button"
              onClick={() => { setMode('login'); setError(''); }}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${mode === 'login' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'}`}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => { setMode('register'); setError(''); }}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${mode === 'register' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'}`}
            >
              Register
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {role === 'guardian' && (
            <>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Guardian Name</label>
                <input
                  type="text"
                  value={guardianName}
                  onChange={(e) => setGuardianName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  placeholder="Your full name"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Guardian Email</label>
                <input
                  type="email"
                  value={guardianEmail}
                  onChange={(e) => setGuardianEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  placeholder="guardian@example.com"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Student Email to Monitor</label>
                <input
                  type="email"
                  value={studentEmail}
                  onChange={(e) => setStudentEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  placeholder="student@example.com"
                  required
                />
              </div>
            </>
          )}

          {role === 'student' && (
            <>
              {mode === 'register' && (
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Username</label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    placeholder="your_username"
                    required
                  />
                </div>
              )}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Your Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  placeholder="you@school.edu"
                  required
                />
              </div>
            </>
          )}

          {role === 'student' && (
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                placeholder="••••••••"
                required
              />
            </div>
          )}

          {error && <p className="text-rose-500 text-xs text-center">{error}</p>}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 mt-2 disabled:opacity-60"
          >
            {isSubmitting ? 'Please wait...' : 'Access Chain'}
          </button>
        </form>
      </div>
    </div>
  );
};

// --- Guardian View ---
const GuardianDashboard: React.FC<{ user: User; onLogout: () => void }> = ({ user, onLogout }) => {
  const [report, setReport] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<'not_found' | 'no_sessions' | 'ready'>('ready');

  useEffect(() => {
    const fetchSummaries = async () => {
      try {
        const studentEmail = user.studentEmail?.toLowerCase() || '';
        const studentId = user.studentId || '';

        if (!studentId || !studentEmail) {
          setStatus('not_found');
          setLoading(false);
          return;
        }
        const saved = localStorage.getItem(`sessions_${studentId}`);
        if (!saved) {
          setStatus('no_sessions');
          setLoading(false);
          return;
        }

        let sessions: SessionRecord[] = [];
        try {
          sessions = JSON.parse(saved);
        } catch {
          sessions = [];
        }

        if (sessions.length === 0) {
          setStatus('no_sessions');
        } else {
          const summaries = sessions.map(s => s.summary);
          const formattedReport = await gemini.getGuardianReport(summaries);
          setReport(formattedReport);
          setStatus('ready');
        }
      } catch (err) {
        console.error("Guardian fetch error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchSummaries();
  }, [user.studentEmail]);

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b border-slate-100 h-16 flex items-center justify-between px-6 sticky top-0 z-30">
        <div className="flex items-center gap-2">
          <Users className="text-indigo-600" size={24} />
          <span className="font-serif text-xl font-medium text-slate-900">Guardian Viewer</span>
        </div>
        <button onClick={onLogout} className="text-slate-400 hover:text-rose-500 transition-colors p-2"><LogOut size={20} /></button>
      </nav>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-6">
            <h2 className="text-2xl font-serif text-slate-800">Student Progress Report</h2>
            <div className="flex gap-4 mt-2">
              <span className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-1 rounded font-bold uppercase tracking-tight">STUDENT: {user.studentEmail}</span>
              <span className="text-[10px] bg-slate-50 text-slate-600 px-2 py-1 rounded font-bold uppercase tracking-widest">PRIVATE DATA PROTECTED</span>
            </div>
          </div>

          {loading ? (
            <div className="py-20 text-center text-slate-400">Analyzing records...</div>
          ) : status === 'not_found' ? (
            <div className="py-12 text-center space-y-4">
              <AlertCircle className="mx-auto text-rose-300" size={48} />
              <p className="text-slate-600 font-medium">Student Not Registered</p>
            </div>
          ) : status === 'no_sessions' ? (
            <div className="py-12 text-center space-y-4">
              <History className="mx-auto text-slate-300" size={48} />
              <p className="text-slate-600 font-medium">No Active Sessions</p>
            </div>
          ) : (
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
              <pre className="whitespace-pre-wrap font-sans text-slate-700 leading-relaxed text-sm">
                {report}
              </pre>
            </div>
          )}

          <div className="pt-6 border-t border-slate-100 flex items-center gap-2 text-[10px] text-slate-400 uppercase tracking-widest font-bold">
            <Lock size={12} />
            Secure Guardian Terminal
          </div>
        </div>
      </main>
    </div>
  );
};

// --- Student Dashboard ---
const Dashboard: React.FC<{ user: User; onLogout: () => void }> = ({ user, onLogout }) => {
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [view, setView] = useState<'list' | 'chat' | 'view_session'>('list');
  const [selectedSession, setSelectedSession] = useState<SessionRecord | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(`sessions_${user.id}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setSessions(parsed);
      }
    } catch (e) {
      console.error("Session load error:", e);
    }
  }, [user.id]);

  const saveSessions = (updated: SessionRecord[]) => {
    setSessions(updated);
    localStorage.setItem(`sessions_${user.id}`, JSON.stringify(updated));
  };

  const handleSessionEnd = async (history: ChatMessage[]) => {
    setIsProcessing(true);
    try {
      const summary = await gemini.generateSummary(history, user.id);
      const newSession: SessionRecord = { id: `session_${Date.now()}`, summary, history, status: 'completed' };
      saveSessions([newSession, ...sessions]);
    } catch (e) {
      console.error("Summary error:", e);
    } finally {
      setIsProcessing(false);
      setView('list');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b border-slate-100 h-16 flex items-center justify-between px-6 sticky top-0 z-30">
        <div className="flex items-center gap-2">
          <Shield className="text-indigo-600" size={24} />
          <span className="font-serif text-xl font-medium text-slate-900">Care Connect Chain</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-100">
            <UserIcon size={14} className="text-slate-400" />
            <span className="text-xs text-slate-600 font-medium">{user.email}</span>
          </div>
          <button onClick={onLogout} className="p-2 text-slate-400 hover:text-rose-500 transition-colors"><LogOut size={20} /></button>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {view === 'list' && (
          <div className="space-y-8">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-serif text-slate-900">My Conversations</h2>
                <p className="text-slate-500 text-sm">Strictly private records.</p>
              </div>
              <button onClick={() => setView('chat')} className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 font-medium">
                <Plus size={20} /> New Session
              </button>
            </div>
            <SessionList 
              sessions={sessions} 
              onSelect={(s) => { setSelectedSession(s); setView('view_session'); }} 
              showSummary={false} 
            />
          </div>
        )}

        {view === 'chat' && (
          <div className="h-[calc(100vh-12rem)]">
            <ChatWindow userId={user.id} onSessionEnd={handleSessionEnd} />
          </div>
        )}

        {view === 'view_session' && selectedSession && (
          <div className="max-w-3xl mx-auto space-y-6">
            <button onClick={() => setView('list')} className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 transition-colors text-sm">
              <ChevronLeft size={16} /> Back
            </button>
            <div className="bg-white rounded-3xl p-8 shadow-xl border border-slate-100 space-y-6">
              <h3 className="font-serif text-2xl text-slate-900">Session Review</h3>
              <div className="space-y-6 pt-4 border-t border-slate-50">
                {selectedSession.history.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] px-4 py-2 rounded-xl text-sm leading-relaxed ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-slate-100 text-slate-700 rounded-tl-none'}`}>
                      {msg.content}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {isProcessing && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white p-8 rounded-3xl shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-slate-800 font-medium">Securing session records...</p>
          </div>
        </div>
      )}
    </div>
  );
};

// --- Main App Entry ---
const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('care_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const handleLogin = (u: User) => {
    setUser(u);
    localStorage.setItem('care_user', JSON.stringify(u));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('care_user');
  };

  return (
    <HashRouter>
      <Routes>
        <Route 
          path="/" 
          element={
            user ? (
              user.role === 'guardian' ? (
                <GuardianDashboard user={user} onLogout={handleLogout} />
              ) : (
                <Dashboard user={user} onLogout={handleLogout} />
              )
            ) : (
              <Login onLogin={handleLogin} />
            )
          } 
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
};

export default App;
