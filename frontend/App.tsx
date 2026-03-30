
import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { User, SessionRecord, ChatMessage, UserRole, IpfsPinInfo, CounsellorStudent, CounsellorRequest, CounsellorSchedule } from './types.ts';
import { gemini } from './services/geminiService.ts';
import { connectWallet, storeCidToChain } from './services/chainService.ts';
import ChatWindow from './components/ChatWindow.tsx';
import SessionList from './components/SessionList.tsx';
import { Shield, Plus, User as UserIcon, LogOut, ChevronLeft, Lock, Users, History, AlertCircle, Building2, Stethoscope } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || `${window.location.protocol}//${window.location.hostname}:5000`;

// --- Authentication View ---
const Login: React.FC<{ onLogin: (u: User) => void }> = ({ onLogin }) => {
  const [role, setRole] = useState<UserRole>('student');
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [guardianEmail, setGuardianEmail] = useState('');
  const [guardianPassword, setGuardianPassword] = useState('');
  const [guardianConfirmPassword, setGuardianConfirmPassword] = useState('');
  const [studentEmail, setStudentEmail] = useState('');
  const [relationship, setRelationship] = useState('');
  const [counsellorEmail, setCounsellorEmail] = useState('');
  const [counsellorLoginId, setCounsellorLoginId] = useState('');
  const [counsellorPassword, setCounsellorPassword] = useState('');
  const [counsellorConfirmPassword, setCounsellorConfirmPassword] = useState('');
  const [crrNumber, setCrrNumber] = useState('');
  const [organization, setOrganization] = useState('');
  const [institutionEmail, setInstitutionEmail] = useState('');
  const [institutionPassword, setInstitutionPassword] = useState('');
  const [institutionConfirmPassword, setInstitutionConfirmPassword] = useState('');
  const [institutionName, setInstitutionName] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [studentCollegeCode, setStudentCollegeCode] = useState('');
  const [institutionCollegeCode, setInstitutionCollegeCode] = useState('');
  const [registrationSuccess, setRegistrationSuccess] = useState<{ collegeCode: string } | null>(null);
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
      setRegistrationSuccess(null);

      if (role === 'student') {
        if (mode === 'register') {
          if (!username.trim()) {
            throw new Error('Username is required.');
          }
          if (!sanitizedEmail || password.length < 6) {
            throw new Error('Enter a valid email and 6+ character password.');
          }
          if (!studentCollegeCode.trim()) {
            throw new Error('College ID is required.');
          }
          if (password !== confirmPassword) {
            throw new Error('Password and confirm password do not match.');
          }

          await postJson(`${API_BASE_URL}/api/auth/register`, {
            username: username.trim(),
            email: sanitizedEmail,
            password,
            college_code: studentCollegeCode.trim().toUpperCase()
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
      } else if (role === 'counsellor') {
        if (counsellorPassword.length < 6) throw new Error('Enter a 6+ character password.');
        if (!accessCode.trim()) {
          throw new Error('Provide AISHE or UDISE code.');
        }

        if (mode === 'register') {
          if (!counsellorEmail) throw new Error('Official counsellor email is required.');
          if (!crrNumber.trim()) throw new Error('CRR Number is required.');
          if (counsellorPassword !== counsellorConfirmPassword) {
            throw new Error('Password and confirm password do not match.');
          }
          const res = await postJson(`${API_BASE_URL}/api/counsellor/register`, {
            counsellor_email: counsellorEmail.toLowerCase().trim(),
            counsellor_password: counsellorPassword,
            crr_number: crrNumber.trim(),
            organization: organization.trim() || undefined,
            access_code: accessCode.trim() || undefined
          });
          onLogin({
            id: counsellorEmail.toLowerCase().trim(),
            email: counsellorEmail.toLowerCase().trim(),
            role: 'counsellor',
            crrNumber: crrNumber.trim(),
            organization: organization.trim() || undefined
          });
        } else {
          if (!counsellorLoginId.trim()) throw new Error('Provide counsellor email or CRR ID.');
          const res = await postJson(`${API_BASE_URL}/api/counsellor/login`, {
            login_id: counsellorLoginId.trim(),
            counsellor_password: counsellorPassword,
            access_code: accessCode.trim() || undefined
          });
          onLogin({
            id: (res.counsellor?.counsellor_email || counsellorLoginId).toLowerCase().trim(),
            email: (res.counsellor?.counsellor_email || counsellorLoginId).toLowerCase().trim(),
            role: 'counsellor',
            crrNumber: res.counsellor?.crr_number || crrNumber.trim(),
            organization: res.counsellor?.organization || undefined
          });
        }
      } else if (role === 'institution') {
        if (institutionPassword.length < 6) throw new Error('Enter a 6+ character password.');

        if (mode === 'register') {
          if (!institutionEmail) throw new Error('Institution official email is required.');
          if (!accessCode.trim()) {
            throw new Error('Provide AISHE or UDISE code.');
          }
          if (institutionPassword !== institutionConfirmPassword) {
            throw new Error('Password and confirm password do not match.');
          }

          const res = await postJson(`${API_BASE_URL}/api/institution/register`, {
            institution_email: institutionEmail.toLowerCase().trim(),
            institution_password: institutionPassword,
            institution_name: institutionName.trim() || undefined,
            access_code: accessCode.trim() || undefined
          });

          setRegistrationSuccess({ collegeCode: String(res.college_code || '').toUpperCase() });
          setMode('login');
          setInstitutionCollegeCode(String(res.college_code || '').toUpperCase());
        } else {
          if (!institutionCollegeCode.trim()) throw new Error('College Code is required.');
          const res = await postJson(`${API_BASE_URL}/api/institution/login`, {
            college_code: institutionCollegeCode.trim().toUpperCase(),
            institution_password: institutionPassword
          });
          onLogin({
            id: res.institution?.institution_email || institutionEmail.toLowerCase().trim(),
            email: res.institution?.institution_email || institutionEmail.toLowerCase().trim(),
            role: 'institution',
            institutionName: res.institution?.institution_name || undefined,
            collegeCode: res.institution?.college_code || institutionCollegeCode.trim().toUpperCase()
          });
        }
      } else {
        if (!sanitizedGuardianEmail) {
          throw new Error('Guardian email is required.');
        }
        if (guardianPassword.length < 6) {
          throw new Error('Enter a 6+ character guardian password.');
        }
        if (mode === 'register' && !sanitizedStudentEmail) {
          throw new Error('Student email is required.');
        }
        if (mode === 'register' && !relationship.trim()) {
          throw new Error('Relationship is required.');
        }
        if (mode === 'register' && guardianPassword !== guardianConfirmPassword) {
          throw new Error('Password and confirm password do not match.');
        }

        if (mode === 'register') {
          const registerResult = await postJson(`${API_BASE_URL}/api/guardian/register`, {
            guardian_email: sanitizedGuardianEmail,
            guardian_password: guardianPassword,
            student_email: sanitizedStudentEmail,
            relationship: relationship.trim()
          });

          onLogin({
            id: registerResult.studentId,
            email: sanitizedGuardianEmail,
            role: 'guardian',
            studentEmail: sanitizedStudentEmail,
            studentId: registerResult.studentId
          });
        } else {
          const loginResult = await postJson(`${API_BASE_URL}/api/guardian/login`, {
            guardian_email: sanitizedGuardianEmail,
            guardian_password: guardianPassword
          });

          onLogin({
            id: loginResult.studentId,
            email: sanitizedGuardianEmail,
            role: 'guardian',
            studentEmail: loginResult.studentEmail,
            studentId: loginResult.studentId
          });
        }
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

        <div className="flex bg-slate-100 p-1 rounded-xl mb-6 gap-1">
          <button 
            onClick={() => { setRole('student'); setError(''); setRegistrationSuccess(null); }}
            className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${role === 'student' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'}`}
          >
            Student
          </button>
          <button 
            onClick={() => { setRole('guardian'); setError(''); setRegistrationSuccess(null); }}
            className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${role === 'guardian' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'}`}
          >
            Parent
          </button>
          <button 
            onClick={() => { setRole('counsellor'); setError(''); setRegistrationSuccess(null); }}
            className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${role === 'counsellor' ? 'bg-white shadow-sm text-teal-600' : 'text-slate-500'}`}
          >
            Counsellor
          </button>
          <button 
            onClick={() => { setRole('institution'); setError(''); setRegistrationSuccess(null); }}
            className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${role === 'institution' ? 'bg-white shadow-sm text-amber-600' : 'text-slate-500'}`}
          >
            Institution
          </button>
        </div>

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
              onClick={() => { setMode('register'); setError(''); setRegistrationSuccess(null); }}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${mode === 'register' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'}`}
            >
              Register
            </button>
          </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {role === 'counsellor' && (
            <>
              {mode === 'register' ? (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">CRR Number</label>
                    <input type="text" value={crrNumber} onChange={(e) => setCrrNumber(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 outline-none transition-all"
                      placeholder="CRR123456" required />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">AISHE/UDISE Code</label>
                    <input type="text" value={accessCode} onChange={(e) => setAccessCode(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 outline-none transition-all"
                      placeholder="AISHE12345 or UDISE67890" required />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Organization (optional)</label>
                    <input type="text" value={organization} onChange={(e) => setOrganization(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 outline-none transition-all"
                      placeholder="City Wellness Clinic" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Official Email</label>
                    <input type="email" value={counsellorEmail} onChange={(e) => setCounsellorEmail(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 outline-none transition-all"
                      placeholder="name@officialclinic.org" required />
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Email or CRR Number</label>
                  <input type="text" value={counsellorLoginId} onChange={(e) => setCounsellorLoginId(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 outline-none transition-all"
                    placeholder="name@officialclinic.org or CRR123456" required />
                </div>
              )}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Password</label>
                <input type="password" value={counsellorPassword} onChange={(e) => setCounsellorPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 outline-none transition-all"
                  placeholder="••••••••" required />
              </div>
              {mode === 'register' && (
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Confirm Password</label>
                  <input type="password" value={counsellorConfirmPassword} onChange={(e) => setCounsellorConfirmPassword(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 outline-none transition-all"
                    placeholder="••••••••" required />
                </div>
              )}
              {mode !== 'register' && (
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">AISHE/UDISE Code</label>
                  <input type="text" value={accessCode} onChange={(e) => setAccessCode(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 outline-none transition-all"
                    placeholder="AISHE12345 or UDISE67890" required />
                </div>
              )}
            </>
          )}

          {role === 'institution' && (
            <>
              {mode === 'register' ? (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Institution Name (optional)</label>
                    <input type="text" value={institutionName} onChange={(e) => setInstitutionName(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                      placeholder="State University" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">AISHE/UDISE Code</label>
                    <input type="text" value={accessCode} onChange={(e) => setAccessCode(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                      placeholder="AISHE12345 or UDISE67890" required />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Institution Official Email</label>
                    <input type="email" value={institutionEmail} onChange={(e) => setInstitutionEmail(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                      placeholder="admin@university.edu" required />
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">College Code</label>
                  <input type="text" value={institutionCollegeCode} onChange={(e) => setInstitutionCollegeCode(e.target.value.toUpperCase())}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                    placeholder="CC-ABC123" required />
                </div>
              )}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Password</label>
                <input type="password" value={institutionPassword} onChange={(e) => setInstitutionPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                  placeholder="••••••••" required />
              </div>
              {mode === 'register' && (
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Confirm Password</label>
                  <input type="password" value={institutionConfirmPassword} onChange={(e) => setInstitutionConfirmPassword(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                    placeholder="••••••••" required />
                </div>
              )}
            </>
          )}

          {role === 'guardian' && (
            <>
              {mode === 'register' && (
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
              )}
              {mode === 'register' && (
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Relationship</label>
                  <input
                    type="text"
                    value={relationship}
                    onChange={(e) => setRelationship(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    placeholder="parent, guardian, counselor"
                    required
                  />
                </div>
              )}
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
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Guardian Password</label>
                <input
                  type="password"
                  value={guardianPassword}
                  onChange={(e) => setGuardianPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  placeholder="••••••••"
                  required
                />
              </div>
              {mode === 'register' && (
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Confirm Password</label>
                  <input
                    type="password"
                    value={guardianConfirmPassword}
                    onChange={(e) => setGuardianConfirmPassword(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    placeholder="••••••••"
                    required
                  />
                </div>
              )}
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
              {mode === 'register' && (
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">College ID</label>
                  <input
                    type="text"
                    value={studentCollegeCode}
                    onChange={(e) => setStudentCollegeCode(e.target.value.toUpperCase())}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    placeholder="CC-ABC123"
                    required
                  />
                </div>
              )}
            </>
          )}

          {role === 'student' && (
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

          {role === 'student' && mode === 'register' && (
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                placeholder="••••••••"
                required
              />
            </div>
          )}

          {registrationSuccess && role === 'institution' && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 px-4 py-3 text-xs text-center">
              Registration successful. Your College Code is <span className="font-bold">{registrationSuccess.collegeCode}</span>. Save this code for institution login.
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
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [requestingSessionId, setRequestingSessionId] = useState<string | null>(null);
  const [requestNotice, setRequestNotice] = useState('');

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

        const summaries = await gemini.fetchGuardianSummaries(studentId, user.email);
        const fetchedSessions = await gemini.fetchSessions(studentId);
        setSessions(Array.isArray(fetchedSessions) ? fetchedSessions : []);
        if (summaries.length === 0) {
          setStatus('no_sessions');
          return;
        }

        const formattedReport = await gemini.getGuardianReport(summaries);
        setReport(formattedReport);
        setStatus('ready');
      } catch (err) {
        console.error("Guardian fetch error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchSummaries();
  }, [user.studentEmail, user.studentId, user.email]);

  const handleRequestCounsellor = async (session: SessionRecord) => {
    if (!user.studentId) return;

    setRequestingSessionId(session.id);
    setRequestNotice('');

    try {
      const urgency = session.summary.emotion === 'CRITICAL' ? 'critical' : 'bad';
      await gemini.createCounsellorRequest({
        studentId: user.studentId,
        sessionId: session.id,
        sessionEmotion: session.summary.emotion,
        urgency,
        reason: `Guardian escalated ${session.summary.emotion} behaviour from session summary.`,
        requestedByRole: 'guardian',
        requestedByEmail: user.email
      });
      setRequestNotice('Request sent to counsellor successfully.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send counsellor request.';
      setRequestNotice(message);
    } finally {
      setRequestingSessionId(null);
    }
  };

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

          {sessions.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-serif text-xl text-slate-800">Session Cards</h3>
              {requestNotice && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-700">
                  {requestNotice}
                </div>
              )}
              <SessionList
                sessions={sessions}
                onSelect={() => undefined}
                onRequestCounsellor={handleRequestCounsellor}
                requestingSessionId={requestingSessionId}
              />
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

// --- Counsellor Dashboard ---
const CounsellorDashboard: React.FC<{ user: User; onLogout: () => void }> = ({ user, onLogout }) => {
  const [report, setReport] = useState<string>('');
  const [students, setStudents] = useState<CounsellorStudent[]>([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<CounsellorStudent | null>(null);
  const [selectedStudentSessions, setSelectedStudentSessions] = useState<SessionRecord[]>([]);
  const [selectedSession, setSelectedSession] = useState<SessionRecord | null>(null);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [schedules, setSchedules] = useState<CounsellorSchedule[]>([]);
  const [schedulesLoading, setSchedulesLoading] = useState(false);
  const [scheduleAt, setScheduleAt] = useState('');
  const [scheduleUrgency, setScheduleUrgency] = useState<'critical' | 'bad'>('bad');
  const [scheduleNotes, setScheduleNotes] = useState('');
  const [isScheduling, setIsScheduling] = useState(false);
  const [requests, setRequests] = useState<CounsellorRequest[]>([]);
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);
  const [requestNotice, setRequestNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<'not_found' | 'no_students' | 'no_sessions' | 'ready'>('ready');

  const normalizedStudentSearch = studentSearch.trim().toLowerCase();
  const filteredStudents = students.filter((student) => {
    if (!normalizedStudentSearch) return true;
    const name = String(student.username || '').toLowerCase();
    const email = String(student.email || '').toLowerCase();
    return name.includes(normalizedStudentSearch) || email.includes(normalizedStudentSearch);
  });

  const toInputDateTime = (date: Date) => {
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  };

  const loadStudentSessions = async (student: CounsellorStudent) => {
    setSelectedStudent(student);
    setSelectedSession(null);
    setSessionsLoading(true);
    try {
      const sessions = await gemini.fetchSessions(student.id);
      setSelectedStudentSessions(Array.isArray(sessions) ? sessions : []);
    } catch (err) {
      console.error('Counsellor student sessions fetch error:', err);
      setSelectedStudentSessions([]);
    } finally {
      setSessionsLoading(false);
    }
  };

  const loadStudentSchedules = async (studentId: string) => {
    setSchedulesLoading(true);
    try {
      const rows = await gemini.fetchCounsellorSchedules(user.email, studentId);
      setSchedules(Array.isArray(rows) ? rows : []);
    } catch (err) {
      console.error('Counsellor schedules fetch error:', err);
      setSchedules([]);
    } finally {
      setSchedulesLoading(false);
    }
  };

  const selectStudent = async (student: CounsellorStudent) => {
    await Promise.all([
      loadStudentSessions(student),
      loadStudentSchedules(student.id)
    ]);
    setScheduleUrgency('bad');
    setScheduleNotes('');
    setScheduleAt(toInputDateTime(new Date(Date.now() + 60 * 60 * 1000)));
  };

  useEffect(() => {
    const fetchSummaries = async () => {
      try {
        const [linkedStudents, summaries, pendingRequests] = await Promise.all([
          gemini.fetchCounsellorStudents(user.email),
          gemini.fetchCounsellorSummaries(user.email),
          gemini.fetchCounsellorRequests(user.email)
        ]);

        setStudents(linkedStudents);
        setRequests(Array.isArray(pendingRequests) ? pendingRequests : []);
        if (linkedStudents.length === 0) {
          setStatus('no_students');
          setLoading(false);
          return;
        }

        await selectStudent(linkedStudents[0]);

        if (summaries.length === 0) { setStatus('no_sessions'); setLoading(false); return; }
        const formattedReport = await gemini.getGuardianReport(summaries);
        setReport(formattedReport);
        setStatus('ready');
      } catch (err) {
        console.error('Counsellor fetch error:', err);
        setStatus('not_found');
      } finally {
        setLoading(false);
      }
    };
    fetchSummaries();
  }, [user.email]);

  const handleCreateSessionFromRequest = async (request: CounsellorRequest) => {
    setProcessingRequestId(request.id);
    setRequestNotice('');
    try {
      const delayMs = request.urgency === 'critical' ? 30 * 60 * 1000 : 24 * 60 * 60 * 1000;
      const scheduledForIso = new Date(Date.now() + delayMs).toISOString();

      const scheduled = await gemini.createCounsellorSchedule({
        studentId: request.student_id,
        counsellorEmail: user.email,
        scheduledFor: scheduledForIso,
        urgency: request.urgency,
        notes: request.reason || `Scheduled from ${request.requested_by_role} escalation request.`,
        sourceRequestId: request.id
      });

      setRequests((prev) => prev.map((item) => (
        item.id === request.id ? { ...item, status: 'session_created' } : item
      )));

      if (selectedStudent?.id === request.student_id) {
        setSchedules((prev) => [scheduled, ...prev]);
      }

      setRequestNotice(`Support session scheduled for ${request.student_username || request.student_email || request.student_id}.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create support session.';
      setRequestNotice(message);
    } finally {
      setProcessingRequestId(null);
    }
  };

  const handleScheduleForSelectedStudent = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedStudent) return;

    setIsScheduling(true);
    setRequestNotice('');
    try {
      const scheduled = await gemini.createCounsellorSchedule({
        studentId: selectedStudent.id,
        counsellorEmail: user.email,
        scheduledFor: new Date(scheduleAt).toISOString(),
        urgency: scheduleUrgency,
        notes: scheduleNotes
      });

      setSchedules((prev) => [scheduled, ...prev]);
      setScheduleNotes('');
      setRequestNotice(`Session scheduled for ${selectedStudent.username || selectedStudent.email}.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to schedule session.';
      setRequestNotice(message);
    } finally {
      setIsScheduling(false);
    }
  };

  return (
    <div className="min-h-screen bg-teal-50">
      <nav className="bg-white border-b border-teal-100 h-16 flex items-center justify-between px-6 sticky top-0 z-30">
        <div className="flex items-center gap-2">
          <Stethoscope className="text-teal-600" size={24} />
          <span className="font-serif text-xl font-medium text-slate-900">Counsellor Portal</span>
        </div>
        <button onClick={onLogout} className="text-slate-400 hover:text-rose-500 transition-colors p-2"><LogOut size={20} /></button>
      </nav>
      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="bg-white rounded-3xl p-8 border border-teal-100 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-6">
            <h2 className="text-2xl font-serif text-slate-800">Clinical Session Report</h2>
            <div className="flex flex-wrap gap-3 mt-2">
              <span className="text-[10px] bg-teal-50 text-teal-700 px-2 py-1 rounded font-bold uppercase tracking-tight">INSTITUTION STUDENTS ONLY</span>
              <span className="text-[10px] bg-slate-50 text-slate-600 px-2 py-1 rounded font-bold uppercase tracking-tight">STUDENTS: {students.length}</span>
              {user.organization && <span className="text-[10px] bg-slate-50 text-slate-600 px-2 py-1 rounded font-bold uppercase tracking-tight">{user.organization}</span>}
              <span className="text-[10px] bg-teal-50 text-teal-600 px-2 py-1 rounded font-bold uppercase tracking-widest">CLINICAL VIEW</span>
            </div>
            {students.length > 0 && (
              <p className="text-xs text-slate-500 mt-3">
                {students.map((student) => student.username || student.email).join(', ')}
              </p>
            )}
          </div>
          {loading ? (
            <div className="py-20 text-center text-slate-400">Loading session records...</div>
          ) : status === 'not_found' ? (
            <div className="py-12 text-center space-y-4">
              <AlertCircle className="mx-auto text-rose-300" size={48} />
              <p className="text-slate-600 font-medium">Counsellor Account Not Found</p>
            </div>
          ) : status === 'no_students' ? (
            <div className="py-12 text-center space-y-4">
              <Users className="mx-auto text-slate-300" size={48} />
              <p className="text-slate-600 font-medium">No Students Linked To Your Institution</p>
            </div>
          ) : status === 'no_sessions' ? (
            <div className="py-12 text-center space-y-4">
              <History className="mx-auto text-slate-300" size={48} />
              <p className="text-slate-600 font-medium">No Sessions Recorded Yet</p>
            </div>
          ) : (
            <div className="bg-teal-50 p-6 rounded-2xl border border-teal-100">
              <pre className="whitespace-pre-wrap font-sans text-slate-700 leading-relaxed text-sm">{report}</pre>
            </div>
          )}

          {students.length > 0 && (
            <div className="space-y-5 border-t border-slate-100 pt-6">
              <h3 className="text-lg font-serif text-slate-900">Students</h3>
              <div>
                <input
                  type="text"
                  value={studentSearch}
                  onChange={(event) => setStudentSearch(event.target.value)}
                  placeholder="Search students by name or email"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {filteredStudents.map((student) => (
                  <button
                    key={student.id}
                    type="button"
                    onClick={() => selectStudent(student)}
                    className={`text-left px-4 py-3 rounded-xl border transition-colors ${selectedStudent?.id === student.id ? 'border-teal-300 bg-teal-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
                  >
                    <p className="text-sm font-semibold text-slate-800">{student.username || 'Student'}</p>
                    <p className="text-xs text-slate-500">{student.email}</p>
                  </button>
                ))}
              </div>
              {filteredStudents.length === 0 && (
                <p className="text-sm text-slate-500">No students match your search.</p>
              )}

              <div className="space-y-4">
                <h4 className="text-sm font-bold uppercase tracking-widest text-slate-500">
                  {selectedStudent ? `Sessions - ${selectedStudent.username || selectedStudent.email}` : 'Select a student'}
                </h4>

                {sessionsLoading ? (
                  <div className="py-10 text-center text-slate-400">Loading student sessions...</div>
                ) : selectedStudent ? (
                  <SessionList
                    sessions={selectedStudentSessions}
                    onSelect={(session) => setSelectedSession(session)}
                    showSummary={false}
                  />
                ) : (
                  <div className="py-10 text-center text-slate-400">Choose a student to view sessions.</div>
                )}
              </div>

              {selectedSession && (
                <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm space-y-4">
                  <h4 className="font-serif text-xl text-slate-900">Session Conversation</h4>
                  <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                    {selectedSession.history.map((msg, index) => (
                      <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] px-4 py-2 rounded-xl text-sm leading-relaxed ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-slate-100 text-slate-700 rounded-tl-none'}`}>
                          {msg.content}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedStudent && (
                <div className="space-y-4 border border-teal-100 rounded-2xl p-5 bg-teal-50/50">
                  <h4 className="font-serif text-lg text-slate-900">Schedule Support Session</h4>
                  <form onSubmit={handleScheduleForSelectedStudent} className="grid gap-3 sm:grid-cols-2">
                    <input
                      type="datetime-local"
                      value={scheduleAt}
                      onChange={(event) => setScheduleAt(event.target.value)}
                      className="px-3 py-2 rounded-xl border border-slate-200 text-sm"
                      required
                    />
                    <select
                      value={scheduleUrgency}
                      onChange={(event) => setScheduleUrgency(event.target.value as 'critical' | 'bad')}
                      className="px-3 py-2 rounded-xl border border-slate-200 text-sm"
                    >
                      <option value="bad">Bad</option>
                      <option value="critical">Critical</option>
                    </select>
                    <textarea
                      value={scheduleNotes}
                      onChange={(event) => setScheduleNotes(event.target.value)}
                      placeholder="Session notes or intervention plan"
                      className="sm:col-span-2 px-3 py-2 rounded-xl border border-slate-200 text-sm min-h-20"
                    />
                    <button
                      type="submit"
                      disabled={isScheduling}
                      className="sm:col-span-2 px-4 py-2 rounded-xl bg-teal-600 text-white text-sm font-bold hover:bg-teal-700 disabled:opacity-60"
                    >
                      {isScheduling ? 'Scheduling...' : 'Schedule Session'}
                    </button>
                  </form>

                  <div className="space-y-2">
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Scheduled Sessions</p>
                    {schedulesLoading ? (
                      <p className="text-sm text-slate-500">Loading schedules...</p>
                    ) : schedules.length === 0 ? (
                      <p className="text-sm text-slate-500">No sessions scheduled yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {schedules.map((schedule) => (
                          <div key={schedule.id} className="rounded-xl bg-white border border-slate-100 px-3 py-2">
                            <p className="text-sm font-semibold text-slate-700">
                              {new Date(schedule.scheduled_for).toLocaleString()} | {schedule.urgency.toUpperCase()}
                            </p>
                            {schedule.notes && <p className="text-xs text-slate-500 mt-1">{schedule.notes}</p>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="space-y-4 border-t border-slate-100 pt-6">
            <h3 className="text-lg font-serif text-slate-900">Escalation Requests</h3>
            {requestNotice && (
              <div className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-2 text-xs text-teal-700">
                {requestNotice}
              </div>
            )}
            {requests.length === 0 ? (
              <p className="text-sm text-slate-500">No requests received yet.</p>
            ) : (
              <div className="space-y-3">
                {requests.map((request) => (
                  <div key={request.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-800">
                        {request.student_username || request.student_email || request.student_id}
                      </p>
                      <span className={`text-[10px] px-2 py-1 rounded font-bold uppercase tracking-widest ${request.urgency === 'critical' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                        {request.urgency}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">
                      From {request.requested_by_role}: {request.requested_by_email}
                    </p>
                    {request.reason && <p className="text-sm text-slate-700">{request.reason}</p>}
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Status: {request.status}</span>
                      <button
                        type="button"
                        onClick={() => handleCreateSessionFromRequest(request)}
                        disabled={request.status === 'session_created' || processingRequestId === request.id}
                        className="px-3 py-1.5 rounded-lg bg-teal-600 text-white text-xs font-bold hover:bg-teal-700 disabled:opacity-60"
                      >
                        {processingRequestId === request.id ? 'Scheduling...' : request.status === 'session_created' ? 'Session Created' : 'Schedule by Urgency'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-6 border-t border-slate-100 flex items-center gap-2 text-[10px] text-slate-400 uppercase tracking-widest font-bold">
            <Lock size={12} />
            Secure Counsellor Terminal
          </div>
        </div>
      </main>
    </div>
  );
};

// --- Institution Dashboard ---
const InstitutionDashboard: React.FC<{ user: User; onLogout: () => void }> = ({ user, onLogout }) => {
  const [report, setReport] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<'not_found' | 'no_students' | 'no_sessions' | 'ready'>('ready');
  const [students, setStudents] = useState<CounsellorStudent[]>([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<CounsellorStudent | null>(null);
  const [selectedStudentSessions, setSelectedStudentSessions] = useState<SessionRecord[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [selectedSession, setSelectedSession] = useState<SessionRecord | null>(null);
  const [requestingSessionId, setRequestingSessionId] = useState<string | null>(null);
  const [requestNotice, setRequestNotice] = useState('');

  const normalizedStudentSearch = studentSearch.trim().toLowerCase();
  const filteredStudents = students.filter((student) => {
    if (!normalizedStudentSearch) return true;
    const name = String(student.username || '').toLowerCase();
    const email = String(student.email || '').toLowerCase();
    return name.includes(normalizedStudentSearch) || email.includes(normalizedStudentSearch);
  });

  const loadStudentSessions = async (student: CounsellorStudent) => {
    setSelectedStudent(student);
    setSelectedSession(null);
    setSessionsLoading(true);
    try {
      const sessions = await gemini.fetchSessions(student.id);
      setSelectedStudentSessions(Array.isArray(sessions) ? sessions : []);
    } catch (err) {
      console.error('Institution student sessions fetch error:', err);
      setSelectedStudentSessions([]);
    } finally {
      setSessionsLoading(false);
    }
  };

  useEffect(() => {
    const fetchSummaries = async () => {
      try {
        const collegeCode = user.collegeCode || '';
        if (!collegeCode) { setStatus('not_found'); setLoading(false); return; }
        const [linkedStudents, summaries] = await Promise.all([
          gemini.fetchInstitutionStudents(collegeCode),
          gemini.fetchInstitutionSummaries(collegeCode)
        ]);

        setStudents(linkedStudents);

        if (linkedStudents.length === 0) {
          setStatus('no_students');
          setLoading(false);
          return;
        }

        await loadStudentSessions(linkedStudents[0]);

        if (summaries.length === 0) {
          setStatus('no_sessions');
          setLoading(false);
          return;
        }

        const formattedReport = await gemini.getGuardianReport(summaries);
        setReport(formattedReport);
        setStatus('ready');
      } catch (err) {
        console.error('Institution fetch error:', err);
        setStatus('not_found');
      } finally {
        setLoading(false);
      }
    };
    fetchSummaries();
  }, [user.collegeCode]);

  const handleRequestCounsellor = async (session: SessionRecord) => {
    if (!selectedStudent) return;

    setRequestingSessionId(session.id);
    setRequestNotice('');
    try {
      const urgency = session.summary.emotion === 'CRITICAL' ? 'critical' : 'bad';
      await gemini.createCounsellorRequest({
        studentId: selectedStudent.id,
        sessionId: session.id,
        sessionEmotion: session.summary.emotion,
        urgency,
        reason: `Institution escalated ${session.summary.emotion} behaviour from session summary.`,
        requestedByRole: 'institution',
        requestedByEmail: user.email
      });
      setRequestNotice('Request sent to counsellor successfully.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send counsellor request.';
      setRequestNotice(message);
    } finally {
      setRequestingSessionId(null);
    }
  };

  return (
    <div className="min-h-screen bg-amber-50">
      <nav className="bg-white border-b border-amber-100 h-16 flex items-center justify-between px-6 sticky top-0 z-30">
        <div className="flex items-center gap-2">
          <Building2 className="text-amber-600" size={24} />
          <span className="font-serif text-xl font-medium text-slate-900">Institution Portal</span>
        </div>
        <button onClick={onLogout} className="text-slate-400 hover:text-rose-500 transition-colors p-2"><LogOut size={20} /></button>
      </nav>
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-3xl p-8 border border-amber-100 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-6">
            <h2 className="text-2xl font-serif text-slate-800">Student Wellbeing Overview</h2>
            <div className="flex flex-wrap gap-3 mt-2">
              <span className="text-[10px] bg-amber-50 text-amber-700 px-2 py-1 rounded font-bold uppercase tracking-tight">ALL STUDENTS</span>
              {user.institutionName && <span className="text-[10px] bg-slate-50 text-slate-600 px-2 py-1 rounded font-bold uppercase tracking-tight">{user.institutionName}</span>}
              {user.collegeCode && <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-1 rounded font-bold uppercase tracking-tight">COLLEGE CODE: {user.collegeCode}</span>}
              <span className="text-[10px] bg-amber-50 text-amber-600 px-2 py-1 rounded font-bold uppercase tracking-widest">ADMIN VIEW</span>
            </div>
          </div>
          {loading ? (
            <div className="py-20 text-center text-slate-400">Loading wellbeing data...</div>
          ) : status === 'not_found' ? (
            <div className="py-12 text-center space-y-4">
              <AlertCircle className="mx-auto text-rose-300" size={48} />
              <p className="text-slate-600 font-medium">Institution Not Found</p>
            </div>
          ) : status === 'no_students' ? (
            <div className="py-12 text-center space-y-4">
              <Users className="mx-auto text-slate-300" size={48} />
              <p className="text-slate-600 font-medium">No Students Linked To This Institution</p>
            </div>
          ) : status === 'no_sessions' ? (
            <div className="py-12 text-center space-y-4">
              <History className="mx-auto text-slate-300" size={48} />
              <p className="text-slate-600 font-medium">No Activity Recorded Yet</p>
            </div>
          ) : (
            <div className="bg-amber-50 p-6 rounded-2xl border border-amber-100">
              <pre className="whitespace-pre-wrap font-sans text-slate-700 leading-relaxed text-sm">{report}</pre>
            </div>
          )}

          {students.length > 0 && (
            <div className="space-y-5 border-t border-slate-100 pt-6">
              <h3 className="text-lg font-serif text-slate-900">Students</h3>
              <div>
                <input
                  type="text"
                  value={studentSearch}
                  onChange={(event) => setStudentSearch(event.target.value)}
                  placeholder="Search students by name or email"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {filteredStudents.map((student) => (
                  <button
                    key={student.id}
                    type="button"
                    onClick={() => loadStudentSessions(student)}
                    className={`text-left px-4 py-3 rounded-xl border transition-colors ${selectedStudent?.id === student.id ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
                  >
                    <p className="text-sm font-semibold text-slate-800">{student.username || 'Student'}</p>
                    <p className="text-xs text-slate-500">{student.email}</p>
                  </button>
                ))}
              </div>
              {filteredStudents.length === 0 && (
                <p className="text-sm text-slate-500">No students match your search.</p>
              )}

              <div className="space-y-4">
                <h4 className="text-sm font-bold uppercase tracking-widest text-slate-500">
                  {selectedStudent ? `Sessions - ${selectedStudent.username || selectedStudent.email}` : 'Select a student'}
                </h4>
                {requestNotice && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-700">
                    {requestNotice}
                  </div>
                )}

                {sessionsLoading ? (
                  <div className="py-10 text-center text-slate-400">Loading student sessions...</div>
                ) : selectedStudent ? (
                  <SessionList
                    sessions={selectedStudentSessions}
                    onSelect={(session) => setSelectedSession(session)}
                    onRequestCounsellor={handleRequestCounsellor}
                    requestingSessionId={requestingSessionId}
                    showSummary={false}
                  />
                ) : (
                  <div className="py-10 text-center text-slate-400">Choose a student to view sessions.</div>
                )}
              </div>

              {selectedSession && (
                <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm space-y-4">
                  <h4 className="font-serif text-xl text-slate-900">Session Conversation</h4>
                  <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                    {selectedSession.history.map((msg, index) => (
                      <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] px-4 py-2 rounded-xl text-sm leading-relaxed ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-slate-100 text-slate-700 rounded-tl-none'}`}>
                          {msg.content}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="pt-6 border-t border-slate-100 flex items-center gap-2 text-[10px] text-slate-400 uppercase tracking-widest font-bold">
            <Lock size={12} />
            Secure Institution Terminal
          </div>
        </div>
      </main>
    </div>
  );
};

// --- Student Dashboard ---
const Dashboard: React.FC<{ user: User; onLogout: () => void }> = ({ user, onLogout }) => {
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [deletedSessionIds, setDeletedSessionIds] = useState<string[]>([]);
  const [walletAddress, setWalletAddress] = useState('');
  const [walletError, setWalletError] = useState('');
  const [isConnectingWallet, setIsConnectingWallet] = useState(false);
  const [isStoringCid, setIsStoringCid] = useState<string | null>(null);
  const [view, setView] = useState<'list' | 'chat' | 'view_session'>('list');
  const [selectedSession, setSelectedSession] = useState<SessionRecord | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    let isActive = true;

    const loadSessions = async () => {
      try {
        const stored = await gemini.fetchSessions(user.id);
        if (!isActive) return;
        setSessions(Array.isArray(stored) ? stored : []);
        setDeletedSessionIds([]);
      } catch (e) {
        console.error("Session load error:", e);
        if (isActive) {
          setSessions([]);
          setDeletedSessionIds([]);
        }
      }
    };

    loadSessions();
    return () => {
      isActive = false;
    };
  }, [user.id]);

  const saveSessions = (updated: SessionRecord[] | ((prev: SessionRecord[]) => SessionRecord[])) => {
    setSessions((prev) => (typeof updated === 'function' ? updated(prev) : updated));
  };

  const handleDeleteSession = (sessionId: string) => {
    setDeletedSessionIds((prev) => (prev.includes(sessionId) ? prev : [sessionId, ...prev]));
  };

  const ensureWallet = async () => {
    if (walletAddress) return walletAddress;
    const { address } = await connectWallet();
    setWalletAddress(address);
    return address;
  };

  const handleConnectWallet = async () => {
    setIsConnectingWallet(true);
    setWalletError('');
    try {
      const { address } = await connectWallet();
      setWalletAddress(address);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Wallet connection failed.';
      setWalletError(message);
    } finally {
      setIsConnectingWallet(false);
    }
  };

  const handleStoreCid = async (session: SessionRecord) => {
    if (!session.ipfs?.cid || session.onChain) return;
    setIsStoringCid(session.id);
    setWalletError('');

    try {
      const address = await ensureWallet();
      const contractAddress = import.meta.env.VITE_CID_CONTRACT_ADDRESS as string | undefined;
      if (!contractAddress) {
        throw new Error('Missing VITE_CID_CONTRACT_ADDRESS in frontend env.');
      }

      const { txHash, chainId } = await storeCidToChain(session.ipfs.cid, contractAddress);
      const storedAt = new Date().toISOString();

      try {
        await gemini.recordBlockchainTx({
          chainId,
          address,
          txHash,
          timestamp: storedAt,
          userId: user.id,
          sessionId: session.id,
          cid: session.ipfs.cid,
          contractAddress
        });
      } catch (recordError) {
        console.warn("Blockchain CSV record error:", recordError);
        setWalletError("Stored on-chain, but failed to update blockchain CSV.");
      }

      const updated = sessions.map((item) =>
        item.id === session.id
          ? {
              ...item,
              onChain: {
                txHash,
                chainId,
                contractAddress,
                storedAt
              }
            }
          : item
      );
      saveSessions(updated);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to store CID.';
      setWalletError(message);
    } finally {
      setIsStoringCid(null);
    }
  };

  const visibleSessions = sessions.filter(
    (session) => !deletedSessionIds.includes(session.id)
  );

  const handleSessionEnd = async (history: ChatMessage[]) => {
    setIsProcessing(true);
    try {
      const sessionId = `session_${Date.now()}`;
      const nowIso = new Date().toISOString();
      const startTimestamp = history[0]?.timestamp || nowIso;
      const endTimestamp = history[history.length - 1]?.timestamp || nowIso;
      let summary = {
        userid: user.id,
        start_time_stamp: startTimestamp,
        end_time_stamp: endTimestamp,
        keywords: [],
        emotion: 'NEUTRAL',
        summary: 'Summary unavailable.'
      };

      try {
        summary = await gemini.generateSummary(history, user.id);
      } catch (summaryError) {
        console.error("Summary error:", summaryError);
      }

      summary = {
        ...summary,
        start_time_stamp: startTimestamp,
        end_time_stamp: endTimestamp
      };
      let ipfs: IpfsPinInfo | undefined;

      try {
        const pinnedAt = new Date().toISOString();
        const ipfsResult = await gemini.pinSessionToIpfs({
          sessionId,
          userId: user.id,
          summary,
          history,
          pinnedAt
        });
        ipfs = {
          cid: ipfsResult.cid,
          uri: ipfsResult.uri,
          gatewayUrl: ipfsResult.gatewayUrl,
          pinnedAt
        };
      } catch (ipfsError) {
        console.error("IPFS pin error:", ipfsError);
      }

      const newSession: SessionRecord = {
        id: sessionId,
        summary,
        history,
        status: 'completed',
        ...(ipfs ? { ipfs } : {})
      };
      saveSessions((prev) => [newSession, ...prev]);
    } catch (e) {
      console.error("Session end error:", e);
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
          {walletAddress ? (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-emerald-50 rounded-lg border border-emerald-100">
              <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-700">Wallet</span>
              <span className="text-xs text-emerald-700 font-medium">
                {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
              </span>
            </div>
          ) : (
            <button
              onClick={handleConnectWallet}
              disabled={isConnectingWallet}
              className="px-3 py-1.5 text-xs font-bold uppercase tracking-widest bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-60"
            >
              {isConnectingWallet ? 'Connecting...' : 'Connect Wallet'}
            </button>
          )}
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
            {walletError && (
              <div className="rounded-2xl border border-rose-100 bg-rose-50 text-rose-700 px-4 py-3 text-sm">
                {walletError}
              </div>
            )}
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
              sessions={visibleSessions} 
              onSelect={(s) => { setSelectedSession(s); setView('view_session'); }} 
              onDelete={(s) => handleDeleteSession(s.id)}
              onStoreCid={(s) => handleStoreCid(s)}
              storingSessionId={isStoringCid}
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
              ) : user.role === 'counsellor' ? (
                <CounsellorDashboard user={user} onLogout={handleLogout} />
              ) : user.role === 'institution' ? (
                <InstitutionDashboard user={user} onLogout={handleLogout} />
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
