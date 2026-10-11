import React, { useState, useEffect, useMemo } from 'react';
import { UserProfile, AdminUserSummary, AdminStats } from '../types';
import { SUPPORTED_LANGUAGES } from '../data/languages';
import {
  Crown,
  ShieldCheck,
  Users,
  Search,
  Download,
  RefreshCw,
  Calendar,
  Clock,
  Mail,
  CheckCircle2,
  Trash2,
  Eye,
  X,
  Copy,
  Check,
  Sparkles,
  ChevronRight,
  AlertCircle,
  Flame,
  BookOpen
} from 'lucide-react';
import { TranslationOverridesDashboard } from './TranslationOverridesDashboard';
import { fetchAllProfilesForAdmin, deleteUserFromFirestore } from '../lib/firebase';
import { extractDistinctPracticeDates, calculateCurrentStreak } from '../utils/streak';
import { calculateTotalKnownWords } from '../utils/srs';

interface AdminDashboardProps {
  currentProfile: UserProfile;
  onClose?: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ currentProfile, onClose }) => {
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [communityCount, setCommunityCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [languageFilter, setLanguageFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'created' | 'words' | 'streak'>('recent');
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);
  const [activeAdminTab, setActiveAdminTab] = useState<'users' | 'overrides'>('users');
  const [pendingOverrideCount, setPendingOverrideCount] = useState<number>(0);
  
  // Inspection modal state
  const [inspectingEmail, setInspectingEmail] = useState<string | null>(null);
  const [inspectingUser, setInspectingUser] = useState<any | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  // Deletion state
  const [deletingEmail, setDeletingEmail] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const fetchAdminData = async () => {
    setIsLoading(true);
    setActionMessage(null);
    try {
      // Fetch in parallel from server and Cloud Firestore
      const serverPromise = fetch(`/api/admin/users?currentEmail=${encodeURIComponent(currentProfile.email)}`)
        .then(r => r.json())
        .catch(() => ({ success: false, users: [], stats: null, communityCount: 0 }));

      const firestorePromise = fetchAllProfilesForAdmin()
        .catch(err => {
          console.warn('Firestore admin fetch warning:', err);
          return [] as AdminUserSummary[];
        });

      const [serverData, firestoreUsers] = await Promise.all([serverPromise, firestorePromise]);

      const serverUsers: AdminUserSummary[] = (serverData.success && Array.isArray(serverData.users)) ? serverData.users : [];
      
      // Combine and deduplicate users by email and username
      const userMap = new Map<string, AdminUserSummary>();

      const registerUser = (u: AdminUserSummary) => {
        const cleanEmail = (u.email || '').toLowerCase().trim();
        const cleanUser = (u.username || '').toLowerCase().trim();
        const key = cleanEmail || cleanUser;
        if (!key) return;

        const effectiveStreak = calculateCurrentStreak(u);

        const existing = (cleanEmail ? userMap.get(cleanEmail) : undefined) ||
                         (cleanUser ? userMap.get(cleanUser) : undefined);

        if (existing) {
          existing.wordsCount = Math.max(existing.wordsCount || 0, u.wordsCount || 0);
          existing.maxStreakDays = Math.max(existing.maxStreakDays || 0, u.maxStreakDays || 0, existing.streakDays || 0, u.streakDays || 0);
          existing.totalSessionsCompleted = Math.max(existing.totalSessionsCompleted || 0, u.totalSessionsCompleted || 0);
          existing.lastActiveAt = Math.max(existing.lastActiveAt || 0, u.lastActiveAt || 0);
          existing.streakDays = calculateCurrentStreak(existing);
          if (u.name && (!existing.name || existing.name === existing.email.split('@')[0])) {
            existing.name = u.name;
          }
          if (u.avatarUrl && !existing.avatarUrl) {
            existing.avatarUrl = u.avatarUrl;
          }
          if (u.targetLanguage && existing.targetLanguage === 'he' && u.targetLanguage !== 'he') {
            existing.targetLanguage = u.targetLanguage;
          }
          if (cleanEmail.includes('@') && (!existing.email.includes('@') || existing.email.endsWith('@vocabpulse.com'))) {
            existing.email = cleanEmail;
          }
          if (cleanUser && !existing.username) {
            existing.username = cleanUser;
          }
        } else {
          userMap.set(key, { ...u, streakDays: effectiveStreak });
          if (cleanEmail) userMap.set(cleanEmail, { ...u, streakDays: effectiveStreak });
          if (cleanUser) userMap.set(cleanUser, { ...u, streakDays: effectiveStreak });
        }
      };

      serverUsers.forEach(registerUser);
      firestoreUsers.forEach(registerUser);

      const finalUsers = Array.from(new Set(userMap.values()));

      // Calculate accurate aggregated metrics across all accounts
      const totalRegistered = finalUsers.length;
      const totalWordsLearned = finalUsers.reduce((sum, u) => sum + (u.wordsCount || 0), 0);
      const totalSessions = finalUsers.reduce((sum, u) => sum + (u.totalSessionsCompleted || 0), 0);
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
      const activeTodayCount = finalUsers.filter(u => u.lastActiveAt && u.lastActiveAt > oneDayAgo).length;

      const languageCounts: Record<string, number> = {};
      const levelCounts: Record<string, number> = {};
      finalUsers.forEach(u => {
        if (u.targetLanguage) languageCounts[u.targetLanguage] = (languageCounts[u.targetLanguage] || 0) + 1;
        if (u.level) levelCounts[u.level] = (levelCounts[u.level] || 0) + 1;
      });

      setUsers(finalUsers);
      setStats({
        totalRegistered,
        totalWordsLearned,
        totalSessions,
        activeTodayCount,
        languageCounts,
        levelCounts,
      });
      setCommunityCount(serverData.communityCount || 0);

      // Fetch pending translation override count
      try {
        const overrideRes = await fetch('/api/admin/translation-overrides');
        const overrideData = await overrideRes.json();
        if (overrideData.success && overrideData.stats) {
          setPendingOverrideCount(overrideData.stats.pendingCount || 0);
        }
      } catch (err) {
        // silent
      }
    } catch (e) {
      console.error('Failed to fetch admin users:', e);
      setActionMessage('Netwerkfout bij ophalen van gebruikers.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, [currentProfile.email]);

  const handleCopyEmail = (email: string) => {
    navigator.clipboard.writeText(email);
    setCopiedEmail(email);
    setTimeout(() => setCopiedEmail(null), 2000);
  };

  const handleInspectUser = async (email: string) => {
    setInspectingEmail(email);
    setIsLoadingDetail(true);
    setInspectingUser(null);
    try {
      const res = await fetch(`/api/admin/user/${encodeURIComponent(email)}?currentEmail=${encodeURIComponent(currentProfile.email)}`);
      const data = await res.json();
      if (data.success && data.user) {
        setInspectingUser(data.user);
      } else {
        const fallback = users.find(u => u.email.toLowerCase() === email.toLowerCase());
        if (fallback) {
          setInspectingUser(fallback);
        }
      }
    } catch (e) {
      console.error('Failed to load user details:', e);
      const fallback = users.find(u => u.email.toLowerCase() === email.toLowerCase());
      if (fallback) {
        setInspectingUser(fallback);
      }
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const handleDeleteUser = async (email: string) => {
    if (!window.confirm(`Weet je zeker dat je het account van ${email} permanent wilt verwijderen van de server en Firestore?`)) {
      return;
    }
    setIsDeleting(true);
    try {
      const serverResPromise = fetch('/api/admin/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentEmail: currentProfile.email,
          targetEmail: email,
        }),
      }).then(r => r.json()).catch(() => ({ success: false }));

      const firestoreDeletePromise = deleteUserFromFirestore(email).catch(() => false);

      const [serverResult, fsDeleted] = await Promise.all([serverResPromise, firestoreDeletePromise]);

      if (serverResult.success || fsDeleted) {
        setActionMessage(`Account ${email} is succesvol verwijderd.`);
        setDeletingEmail(null);
        fetchAdminData();
      } else {
        alert(serverResult.error || 'Kon account niet verwijderen.');
      }
    } catch (e) {
      console.error('Failed to delete user:', e);
      alert('Fout bij het verwijderen van account.');
    } finally {
      setIsDeleting(false);
    }
  };

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return 'Onbekend';
    return new Date(timestamp).toLocaleDateString('nl-NL', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const exportCSV = () => {
    if (!users || users.length === 0) return;
    const headers = [
      'Naam',
      'Gebruikersnaam',
      'Email',
      'Doeltaal',
      'Niveau',
      'Geregistreerd Op',
      'Laatst Actief',
      'Woorden Geleerd',
      'Max Streak Dagen',
    ];

    const rows = users.map(u => [
      `"${u.name || ''}"`,
      `"@${u.username || ''}"`,
      `"${u.email}"`,
      `"${u.targetLanguage}"`,
      `"${u.level}"`,
      u.createdAt ? `"${new Date(u.createdAt).toLocaleString('nl-NL')}"` : '""',
      u.lastActiveAt ? `"${new Date(u.lastActiveAt).toLocaleString('nl-NL')}"` : '""',
      u.wordsCount,
      u.maxStreakDays || u.streakDays || 0,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `vocabpulse_geregistreerde_accounts_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtered and sorted users
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const q = searchQuery.toLowerCase().trim();
      const matchQuery =
        !q ||
        u.email.toLowerCase().includes(q) ||
        (u.name && u.name.toLowerCase().includes(q)) ||
        (u.username && u.username.toLowerCase().includes(q));

      const matchLang = languageFilter === 'all' || u.targetLanguage === languageFilter;
      return matchQuery && matchLang;
    }).sort((a, b) => {
      if (sortBy === 'recent') {
        return (b.lastActiveAt || b.createdAt || 0) - (a.lastActiveAt || a.createdAt || 0);
      }
      if (sortBy === 'created') {
        return (b.createdAt || 0) - (a.createdAt || 0);
      }
      if (sortBy === 'words') {
        return b.wordsCount - a.wordsCount;
      }
      if (sortBy === 'streak') {
        const streakA = a.maxStreakDays || a.streakDays || 0;
        const streakB = b.maxStreakDays || b.streakDays || 0;
        return streakB - streakA;
      }
      return 0;
    });
  }, [users, searchQuery, languageFilter, sortBy]);

  const formatRelativeTime = (timestamp?: number) => {
    if (!timestamp) return 'Nooit';
    const diffSec = Math.floor((Date.now() - timestamp) / 1000);
    if (diffSec < 60) return 'Zojuist';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m geleden`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}u geleden`;
    const diffDay = Math.floor(diffHour / 24);
    if (diffDay === 1) return 'Gisteren';
    if (diffDay < 30) return `${diffDay}d geleden`;
    return new Date(timestamp).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
  };

  const getLanguageName = (code: string) => {
    switch (code) {
      case 'he': return 'Hebreeuws';
      case 'es': return 'Spaans';
      case 'fr': return 'Frans';
      case 'de': return 'Duits';
      case 'it': return 'Italiaans';
      case 'nl': return 'Nederlands';
      case 'ar': return 'Arabisch';
      default: return code.toUpperCase();
    }
  };

  const getLanguageFlag = (code: string) => {
    switch (code) {
      case 'he': return '🇮🇱';
      case 'es': return '🇪🇸';
      case 'fr': return '🇫🇷';
      case 'de': return '🇩🇪';
      case 'it': return '🇮🇹';
      case 'nl': return '🇳🇱';
      case 'ar': return '🇸🇦';
      default: return '🌐';
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Admin Tab Switcher */}
      <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-stone-100 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 w-fit">
        <button
          type="button"
          onClick={() => setActiveAdminTab('users')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
            activeAdminTab === 'users'
              ? 'bg-white dark:bg-stone-800 text-stone-900 dark:text-white shadow-sm'
              : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
          }`}
        >
          <Users className="w-4 h-4 text-amber-500" />
          <span>Accounts &amp; Voortgang</span>
          <span className="px-1.5 py-0.5 rounded-md bg-stone-200 dark:bg-stone-750 text-[10px] font-black">
            {stats ? stats.totalRegistered : users.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveAdminTab('overrides')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
            activeAdminTab === 'overrides'
              ? 'bg-white dark:bg-stone-800 text-stone-900 dark:text-white shadow-sm'
              : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
          }`}
        >
          <Flame className="w-4 h-4 text-amber-500" />
          <span>'I was correct' Feedback &amp; Vertalingen</span>
          {pendingOverrideCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-amber-500 text-stone-950 text-[10px] font-extrabold animate-pulse">
              {pendingOverrideCount} open
            </span>
          )}
        </button>
      </div>

      {activeAdminTab === 'overrides' ? (
        <TranslationOverridesDashboard currentProfile={currentProfile} />
      ) : (
        <>
          {/* Top Header Card */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-stone-900 via-stone-850 to-stone-900 border border-stone-800 text-stone-100 p-6 sm:p-8 shadow-xl">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Accounts
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              id="admin-refresh-btn"
              onClick={fetchAdminData}
              disabled={isLoading}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-stone-800 hover:bg-stone-750 text-stone-200 border border-stone-700 text-xs font-semibold transition-all cursor-pointer shadow-sm active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-amber-400' : ''}`} />
              <span>Vernieuwen</span>
            </button>
            <button
              id="admin-export-csv-btn"
              onClick={exportCSV}
              disabled={users.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-450 text-stone-950 font-bold text-xs transition-all cursor-pointer shadow-md shadow-amber-500/20 active:scale-95 disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exporteer CSV</span>
            </button>
          </div>
        </div>

        {/* Action Message Banner */}
        {actionMessage && (
          <div className="mt-4 p-3 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs flex items-center justify-between">
            <span>{actionMessage}</span>
            <button onClick={() => setActionMessage(null)} className="text-stone-400 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Metrics Grid: Geregistreerd en Actief Vandaag met icoon bovenaan en 1-regelige tekst */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:max-w-md mt-6 pt-6 border-t border-stone-800/80">
          <div className="p-3.5 sm:p-4 rounded-2xl bg-stone-850/80 border border-stone-800 flex flex-col justify-between">
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-2">
              <Users className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <span className="text-xl sm:text-3xl font-black text-white block leading-none">
                {stats ? stats.totalRegistered : users.length}
              </span>
              <span className="text-[11px] sm:text-xs font-semibold text-stone-400 block mt-1.5 truncate whitespace-nowrap">
                Geregistreerd
              </span>
            </div>
          </div>

          <div className="p-3.5 sm:p-4 rounded-2xl bg-stone-850/80 border border-stone-800 flex flex-col justify-between">
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-2">
              <Clock className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <span className="text-xl sm:text-3xl font-black text-white block leading-none">
                {stats ? stats.activeTodayCount : 0}
              </span>
              <span className="text-[11px] sm:text-xs font-semibold text-stone-400 block mt-1.5 truncate whitespace-nowrap">
                Actief vandaag
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Filters & Search Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white dark:bg-stone-900 p-4 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm">
        {/* Search input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            id="admin-search-users-input"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Zoek op naam, e-mailadres of @gebruikersnaam..."
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-stone-50 dark:bg-stone-850 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter by Language & Sort */}
        <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2">
          <select
            id="admin-language-filter"
            value={languageFilter}
            onChange={(e) => setLanguageFilter(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 text-xs rounded-xl bg-stone-50 dark:bg-stone-850 border border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-200 font-medium focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
          >
            <option value="all">Alle talen (13)</option>
            {SUPPORTED_LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.flag} {l.name}
              </option>
            ))}
          </select>

          <select
            id="admin-sort-filter"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="w-full sm:w-auto px-3 py-2 text-xs rounded-xl bg-stone-50 dark:bg-stone-850 border border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-200 font-medium focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
          >
            <option value="recent">Sorteer: Meest recent actief</option>
            <option value="created">Sorteer: Registratiedatum</option>
            <option value="words">Sorteer: Meeste woorden</option>
            <option value="streak">Sorteer: Hoogste streak</option>
          </select>

          <span className="text-xs text-stone-500 dark:text-stone-400 font-medium px-1 py-0.5 sm:px-2 sm:py-1">
            {filteredUsers.length} {filteredUsers.length === 1 ? 'account' : 'accounts'}
          </span>
        </div>
      </div>

      {/* Users List */}
      {isLoading ? (
        <div className="py-16 text-center text-stone-400 bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800">
          <RefreshCw className="w-8 h-8 mx-auto animate-spin text-amber-500 mb-3" />
          <p className="text-sm font-medium">Geregistreerde accounts laden van server...</p>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="py-16 text-center text-stone-400 bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800">
          <Users className="w-10 h-10 mx-auto text-stone-300 dark:text-stone-700 mb-3" />
          <h3 className="text-base font-bold text-stone-800 dark:text-stone-200">Geen accounts gevonden</h3>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 max-w-sm mx-auto">
            {searchQuery ? 'Geen gebruikers gevonden die voldoen aan je zoekterm.' : 'Er zijn nog geen accounts geregistreerd.'}
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm overflow-hidden">
          {/* Desktop Table Header */}
          <div className="hidden lg:grid grid-cols-12 gap-3 px-6 py-3.5 bg-stone-100/75 dark:bg-stone-850/60 border-b border-stone-200 dark:border-stone-800 text-[11px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">
            <div className="col-span-4">Account</div>
            <div className="col-span-2">Registratie</div>
            <div className="col-span-2">Taal</div>
            <div className="col-span-3">Activiteit</div>
            <div className="col-span-1 text-right"></div>
          </div>

          {/* User Rows */}
          <div className="divide-y divide-stone-100 dark:divide-stone-800/80">
            {filteredUsers.map((user) => {
              const isOwner = user.email.toLowerCase() === 'irithfuks@gmail.com';

              return (
                <div
                  key={user.email}
                  className="p-4 sm:p-5 lg:px-6 lg:py-4.5 hover:bg-amber-50/30 dark:hover:bg-amber-950/10 transition-colors flex flex-col lg:grid lg:grid-cols-12 gap-3 lg:gap-3 items-start lg:items-center"
                >
                  {/* Account (naam + email + tag) */}
                  <div className="col-span-4 flex items-center gap-3 w-full">
                    <div className="relative flex-shrink-0">
                      <div className="w-10 h-10 rounded-xl overflow-hidden bg-gradient-to-tr from-amber-500 to-amber-300 text-stone-950 font-bold flex items-center justify-center text-sm shadow-sm">
                        {user.avatarUrl ? (
                          <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
                        ) : (
                          <span>{(user.name || user.email).charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                      {isOwner && (
                        <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-amber-500 text-stone-950 rounded-full flex items-center justify-center shadow-xs text-[9px] font-bold" title="Beheerder">
                          👑
                        </span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs sm:text-sm font-bold text-stone-900 dark:text-stone-100 truncate">
                          {user.name}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 font-mono">
                          @{user.username}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                        <span className="truncate font-mono text-[11px]">{user.email}</span>
                        <button
                          onClick={() => handleCopyEmail(user.email)}
                          className="text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition-colors p-0.5 cursor-pointer"
                          title="Kopieer e-mailadres"
                        >
                          {copiedEmail === user.email ? (
                            <Check className="w-3 h-3 text-emerald-500" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Registratie (datum van registratie) */}
                  <div className="col-span-2 flex items-center gap-1.5 text-xs text-stone-700 dark:text-stone-300">
                    <Calendar className="w-3.5 h-3.5 text-stone-400 flex-shrink-0" />
                    <span>{formatDate(user.createdAt)}</span>
                  </div>

                  {/* Taal */}
                  <div className="col-span-2 flex items-center gap-2">
                    <span className="text-xl leading-none">{getLanguageFlag(user.targetLanguage)}</span>
                    <span className="text-xs font-semibold text-stone-800 dark:text-stone-200">
                      {getLanguageName(user.targetLanguage)}
                    </span>
                  </div>

                  {/* Activiteit */}
                  <div className="col-span-3 flex items-center gap-1.5 text-xs text-stone-700 dark:text-stone-300">
                    <Clock className="w-3.5 h-3.5 text-stone-400 flex-shrink-0" />
                    <span>{formatRelativeTime(user.lastActiveAt)}</span>
                  </div>

                  {/* Details */}
                  <div className="col-span-1 flex items-center justify-end gap-1.5 w-full lg:w-auto mt-2 lg:mt-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-stone-100 dark:border-stone-800">
                    <button
                      id={`admin-inspect-${user.email}`}
                      onClick={() => handleInspectUser(user.email)}
                      className="px-2.5 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-750 text-stone-700 dark:text-stone-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Details"
                    >
                      <Eye className="w-3.5 h-3.5 text-stone-500" />
                      <span>Details</span>
                    </button>

                    {!isOwner && (
                      <button
                        id={`admin-delete-${user.email}`}
                        onClick={() => handleDeleteUser(user.email)}
                        disabled={isDeleting}
                        className="p-1.5 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                        title="Verwijder dit account"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      </>
      )}

      {/* User Details Modal */}
      {inspectingEmail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/70 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setInspectingEmail(null)}
        >
          <div
            className="bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 w-full max-w-2xl rounded-3xl shadow-2xl border border-stone-200 dark:border-stone-800 p-6 sm:p-7 relative max-h-[90vh] overflow-y-auto flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setInspectingEmail(null)}
              className="absolute top-4 right-4 p-2 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {isLoadingDetail ? (
              <div className="py-16 text-center text-stone-400">
                <RefreshCw className="w-8 h-8 mx-auto animate-spin text-amber-500 mb-3" />
                <p className="text-sm">Gegevens ophalen van {inspectingEmail}...</p>
              </div>
            ) : inspectingUser ? (() => {
              const distinctDays = extractDistinctPracticeDates(inspectingUser).length;
              const activeDaysCount = Math.max(
                distinctDays,
                inspectingUser.streakDays || 0,
                inspectingUser.maxStreakDays || 0,
                (inspectingUser.totalSessionsCompleted && inspectingUser.totalSessionsCompleted > 0) ? 1 : 0,
                inspectingUser.lastActiveAt ? 1 : 0
              );
              const totalLearnedWords = calculateTotalKnownWords(inspectingUser) || inspectingUser.wordsCount || inspectingUser.totalWordsLearned || 0;

              return (
                <div className="space-y-5">
                  {/* Header */}
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-300 text-stone-950 font-bold flex items-center justify-center text-xl shadow-md flex-shrink-0">
                      {inspectingUser.avatarUrl ? (
                        <img src={inspectingUser.avatarUrl} alt="Avatar" className="w-full h-full object-cover rounded-2xl" />
                      ) : (
                        <span>{(inspectingUser.name || inspectingUser.email).charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-stone-900 dark:text-white">
                        {inspectingUser.name || inspectingUser.email}
                      </h3>
                      <p className="text-xs text-stone-500 font-mono mt-0.5">
                        {inspectingUser.email} • @{inspectingUser.username || inspectingUser.email.split('@')[0]}
                      </p>
                    </div>
                  </div>

                  {/* Account */}
                  <div className="rounded-2xl bg-stone-50 dark:bg-stone-850/60 border border-stone-200 dark:border-stone-800 p-4">
                    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-stone-200/80 dark:border-stone-800/80">
                      <Users className="w-4 h-4 text-amber-500" />
                      <h4 className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300">
                        Account
                      </h4>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div>
                        <span className="text-stone-400 block text-[10px] uppercase font-bold">Datum registratie</span>
                        <span className="font-semibold text-stone-800 dark:text-stone-200 block mt-0.5">
                          {formatDate(inspectingUser.createdAt)}
                        </span>
                      </div>
                      <div>
                        <span className="text-stone-400 block text-[10px] uppercase font-bold">Recent actief</span>
                        <span className="font-semibold text-stone-800 dark:text-stone-200 block mt-0.5">
                          {inspectingUser.lastActiveAt ? new Date(inspectingUser.lastActiveAt).toLocaleString('nl-NL') : 'Nooit'}
                        </span>
                      </div>
                      <div>
                        <span className="text-stone-400 block text-[10px] uppercase font-bold">Actief sinds</span>
                        <span className="font-semibold text-stone-800 dark:text-stone-200 block mt-0.5">
                          {activeDaysCount} {activeDaysCount === 1 ? 'dag' : 'dagen'}
                        </span>
                      </div>
                      <div>
                        <span className="text-stone-400 block text-[10px] uppercase font-bold">Volgers / volgend</span>
                        <span className="font-semibold text-stone-800 dark:text-stone-200 block mt-0.5">
                          {(inspectingUser.followers || []).length} volgers / {(inspectingUser.following || []).length} volgend
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Progress */}
                  <div className="rounded-2xl bg-stone-50 dark:bg-stone-850/60 border border-stone-200 dark:border-stone-800 p-4">
                    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-stone-200/80 dark:border-stone-800/80">
                      <Sparkles className="w-4 h-4 text-amber-500" />
                      <h4 className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300">
                        Progress
                      </h4>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div>
                        <span className="text-stone-400 block text-[10px] uppercase font-bold">Taal</span>
                        <span className="font-semibold text-stone-800 dark:text-stone-200 flex items-center gap-1.5 mt-0.5">
                          <span>{getLanguageFlag(inspectingUser.targetLanguage)}</span>
                          <span>{getLanguageName(inspectingUser.targetLanguage)}</span>
                        </span>
                      </div>
                      <div>
                        <span className="text-stone-400 block text-[10px] uppercase font-bold">Niveau</span>
                        <span className="font-semibold text-stone-800 dark:text-stone-200 block mt-0.5">
                          {inspectingUser.level || 'A1'}{inspectingUser.numericLevel ? ` (L${inspectingUser.numericLevel})` : ''}
                        </span>
                      </div>
                      <div>
                        <span className="text-stone-400 block text-[10px] uppercase font-bold">Streak</span>
                        <span className="font-semibold text-stone-800 dark:text-stone-200 block mt-0.5">
                          🔥 {inspectingUser.streakDays || 0}d
                        </span>
                      </div>
                      <div>
                        <span className="text-stone-400 block text-[10px] uppercase font-bold">Geleerde woorden</span>
                        <span className="font-semibold text-stone-800 dark:text-stone-200 block mt-0.5">
                          {totalLearnedWords}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Words Breakdown */}
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300 mb-3">
                      <span>Geleerde woorden ({totalLearnedWords})</span>
                    </h4>

                    {Object.keys(inspectingUser.words || {}).length > 0 && (
                      <div className="max-h-60 overflow-y-auto space-y-2 pr-1 divide-y divide-stone-100 dark:divide-stone-800">
                        {Object.values(inspectingUser.words || {}).slice(0, 50).map((w: any) => (
                          <div key={w.wordId || w.id || w.targetWord} className="pt-2 flex items-center justify-between text-xs">
                            <div>
                              <span className="font-bold text-stone-900 dark:text-stone-100 mr-2 text-sm">
                                {w.targetWord}
                              </span>
                              <span className="text-stone-500 dark:text-stone-400">
                                {w.translation}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-[10px]">
                              <span className={`px-2 py-0.5 rounded-full font-bold uppercase ${
                                w.category === 'blue'
                                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                                  : w.category === 'green'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                  : w.category === 'yellow'
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                                  : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                              }`}>
                                {w.category || 'learning'}
                              </span>
                              <span className="text-stone-400 font-mono">
                                {w.intervalDays || 1}d interval
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })() : (
              <p className="text-sm text-stone-400">Gebruikersgegevens niet gevonden.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
