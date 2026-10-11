import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Flame, 
  Award, 
  BookOpen, 
  UserPlus, 
  UserCheck, 
  TrendingUp, 
  Users, 
  ArrowLeft,
  Search,
  ChevronRight
} from 'lucide-react';
import { PublicUserProfile, HistoryChartData } from '../types';
import { getLanguage } from '../data/languages';
import { getPublicProfileFirestore } from '../lib/firebase';
import { calculatePast7DaysWordStats, calculateCumulativeWordStats, calculateCurrentStreak, getEffectiveWeeklyNewWordsCount, getWeeklyLearnedWordsList } from '../utils/streak';
import { WeeklyWordsModal } from './WeeklyWordsModal';

interface UserProfileModalProps {
  user: PublicUserProfile | null;
  isOpen: boolean;
  onClose: () => void;
  onToggleFollow: (user: PublicUserProfile) => void;
  isUpdatingFollow?: boolean;
  currentEmail?: string;
  onSelectUser?: (user: PublicUserProfile) => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  user,
  isOpen,
  onClose,
  onToggleFollow,
  isUpdatingFollow = false,
  currentEmail = '',
  onSelectUser,
}) => {
  // Navigation stack to allow drilling into friend profiles and returning
  const [currentUser, setCurrentUser] = useState<PublicUserProfile | null>(user);
  const [historyStack, setHistoryStack] = useState<PublicUserProfile[]>([]);

  // Sub-view: null = main profile view; 'followers' | 'following' = connections view
  const [viewingConnections, setViewingConnections] = useState<'followers' | 'following' | null>(null);
  const [connectionsSearchQuery, setConnectionsSearchQuery] = useState<string>('');

  // Hover states for chart tooltips
  const [hoveredWeeklyIdx, setHoveredWeeklyIdx] = useState<number | null>(null);
  const [hoveredCumulativeIdx, setHoveredCumulativeIdx] = useState<number | null>(null);

  // Full detailed profile fetched from server & Firestore
  const [detailedProfile, setDetailedProfile] = useState<PublicUserProfile | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState<boolean>(false);
  const [isWeeklyWordsModalOpen, setIsWeeklyWordsModalOpen] = useState<boolean>(false);

  // Sync with prop user changes
  useEffect(() => {
    if (user) {
      setCurrentUser(user);
      setHistoryStack([]);
      setViewingConnections(null);
      setConnectionsSearchQuery('');
    }
  }, [user]);

  // Fetch complete profile whenever active currentUser changes
  useEffect(() => {
    if (!isOpen || !currentUser) return;

    let isMounted = true;
    setIsLoadingDetails(true);

    const serverPromise = fetch(`/api/social/profile/${encodeURIComponent(currentUser.email)}?currentEmail=${encodeURIComponent(currentEmail)}`)
      .then((res) => (res.ok ? res.json() : null))
      .catch(() => null);

    const firestorePromise = getPublicProfileFirestore(currentUser.email, currentEmail)
      .catch(() => null);

    Promise.all([serverPromise, firestorePromise])
      .then(([serverData, firestoreData]) => {
        if (!isMounted) return;
        const sProfile = serverData?.profile;
        if (sProfile || firestoreData) {
          const rawMerged = {
            ...(firestoreData || {}),
            ...(sProfile || {}),
          };
          const effectiveStreak = calculateCurrentStreak(rawMerged);
          const effectiveWeekly = getEffectiveWeeklyNewWordsCount(rawMerged);

          const merged: PublicUserProfile = {
            ...rawMerged,
            currentStreak: effectiveStreak,
            streakDays: effectiveStreak,
            totalWordsLearned: sProfile?.totalWordsLearned !== undefined
              ? sProfile.totalWordsLearned
              : (firestoreData?.totalWordsLearned || 0),
            weeklyNewWordsCount: effectiveWeekly,
            followingUsers: (sProfile?.followingUsers && sProfile.followingUsers.length > 0)
              ? sProfile.followingUsers
              : (firestoreData?.followingUsers || []),
            followersUsers: (sProfile?.followersUsers && sProfile.followersUsers.length > 0)
              ? sProfile.followersUsers
              : (firestoreData?.followersUsers || []),
            past7DaysHistory: sProfile?.past7DaysHistory || firestoreData?.past7DaysHistory || undefined,
            weeklyHistory: sProfile?.past7DaysHistory || firestoreData?.past7DaysHistory || sProfile?.weeklyHistory || undefined,
            cumulativeHistory: sProfile?.cumulativeHistory || firestoreData?.cumulativeHistory || undefined,
            createdAt: sProfile?.createdAt || firestoreData?.createdAt || undefined,
            words: sProfile?.words || firestoreData?.words || undefined,
            weeklyWords: sProfile?.weeklyWords || firestoreData?.weeklyWords || (sProfile?.words ? getWeeklyLearnedWordsList(sProfile.words, new Date(), sProfile.targetLanguage || rawMerged.targetLanguage) : undefined),
          } as PublicUserProfile;
          setDetailedProfile(merged);
        }
      })
      .catch((err) => {
        console.error('Error fetching full user profile:', err);
      })
      .finally(() => {
        if (isMounted) setIsLoadingDetails(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, currentUser?.email, currentEmail]);

  // Effective profile combines currentUser prop with detailedProfile
  const activeUser = useMemo(() => {
    if (!currentUser) return null;
    return {
      ...currentUser,
      ...(detailedProfile?.email.toLowerCase() === currentUser.email.toLowerCase() ? detailedProfile : {}),
    };
  }, [currentUser, detailedProfile]);

  // Drill down into another user's profile
  const handleDrillUser = (nextUser: PublicUserProfile) => {
    if (activeUser) {
      setHistoryStack((prev) => [...prev, activeUser]);
    }
    setCurrentUser(nextUser);
    setDetailedProfile(null);
    setViewingConnections(null);
    setConnectionsSearchQuery('');
    if (onSelectUser) onSelectUser(nextUser);
  };

  // Step back in drill stack
  const handlePopHistory = () => {
    if (historyStack.length === 0) return;
    const previous = historyStack[historyStack.length - 1];
    setHistoryStack((prev) => prev.slice(0, -1));
    setCurrentUser(previous);
    setDetailedProfile(null);
    setViewingConnections(null);
    setConnectionsSearchQuery('');
    if (onSelectUser) onSelectUser(previous);
  };

  // Following & followers counts and lists
  const followingUsers = useMemo(() => activeUser?.followingUsers || [], [activeUser?.followingUsers]);
  const followersUsers = useMemo(() => activeUser?.followersUsers || [], [activeUser?.followersUsers]);

  const followingCount = useMemo(() => {
    const listCount = followingUsers.length;
    const rawCount = activeUser?.following?.length || 0;
    return Math.max(listCount, rawCount);
  }, [followingUsers.length, activeUser?.following]);

  const followersCount = useMemo(() => {
    const listCount = followersUsers.length;
    const rawCount = activeUser?.followers?.length || 0;
    return Math.max(listCount, rawCount);
  }, [followersUsers.length, activeUser?.followers]);

  // Filtered connections list for search inside connections view
  const activeConnectionsList = useMemo(() => {
    const baseList = viewingConnections === 'followers' ? followersUsers : followingUsers;
    const query = connectionsSearchQuery.toLowerCase().trim();
    if (!query) return baseList;
    return baseList.filter((u) => {
      const name = (u.name || '').toLowerCase();
      const username = (u.username || '').toLowerCase();
      return name.includes(query) || username.includes(query);
    });
  }, [viewingConnections, followersUsers, followingUsers, connectionsSearchQuery]);

  // 1. PAST 7 DAYS DATA (Non-cumulative words learned each day: Ma, Di, Wo, Do, Vr, Za, Zo)
  const past7DaysData = useMemo(() => {
    if (activeUser?.words && Object.keys(activeUser.words).length > 0) {
      return calculatePast7DaysWordStats(activeUser.words);
    }
    if (activeUser?.past7DaysHistory && Array.isArray(activeUser.past7DaysHistory.values) && activeUser.past7DaysHistory.values.length === 7) {
      return activeUser.past7DaysHistory;
    }
    if (activeUser?.weeklyHistory && Array.isArray(activeUser.weeklyHistory.values) && activeUser.weeklyHistory.values.length === 7) {
      return activeUser.weeklyHistory;
    }
    // Strict zero baseline for new/inactive accounts
    return calculatePast7DaysWordStats({});
  }, [activeUser]);

  // 2. CUMULATIVE VOCABULARY HISTORY (Since start until now)
  const cumulativeHistoryData = useMemo(() => {
    if (activeUser?.words && Object.keys(activeUser.words).length > 0) {
      return calculateCumulativeWordStats(activeUser.words, activeUser.createdAt);
    }
    if (activeUser?.cumulativeHistory && Array.isArray(activeUser.cumulativeHistory.values)) {
      return activeUser.cumulativeHistory;
    }
    // Strict zero baseline for new/inactive accounts
    return calculateCumulativeWordStats({}, activeUser?.createdAt);
  }, [activeUser]);

  if (!isOpen || !activeUser) return null;

  const targetLang = getLanguage(activeUser.targetLanguage || 'he');
  const isMe = Boolean(currentEmail && activeUser.email.toLowerCase() === currentEmail.toLowerCase());
  const effectiveStreak = calculateCurrentStreak(activeUser);

  // Helper to render interactive SVG Line Chart with accurate Y-axis numbers and smooth bezier curves
  const renderInteractiveChart = (
    data: HistoryChartData,
    color: 'emerald' | 'amber',
    hoveredIdx: number | null,
    setHoveredIdx: (idx: number | null) => void,
    unit: string
  ) => {
    const width = 560;
    const height = 180;
    const paddingLeft = 40;
    const paddingRight = 18;
    const paddingTop = 20;
    const paddingBottom = 26;

    const values = data.values && data.values.length > 0 ? data.values : [0];
    const dataMax = Math.max(...values, 0);

    // Determine clean top value and Y-axis ticks (not too many numbers: clean 2-3 ticks)
    const getChartYScale = (max: number) => {
      if (max <= 0) return { topVal: 4, ticks: [0, 2, 4] };
      if (max <= 4) return { topVal: 4, ticks: [0, 2, 4] };
      if (max <= 6) return { topVal: 6, ticks: [0, 3, 6] };
      if (max <= 10) return { topVal: 10, ticks: [0, 5, 10] };
      if (max <= 16) return { topVal: 16, ticks: [0, 8, 16] };
      if (max <= 20) return { topVal: 20, ticks: [0, 10, 20] };
      if (max <= 30) return { topVal: 30, ticks: [0, 15, 30] };
      if (max <= 50) return { topVal: 50, ticks: [0, 25, 50] };
      if (max <= 80) return { topVal: 80, ticks: [0, 40, 80] };
      if (max <= 100) return { topVal: 100, ticks: [0, 50, 100] };
      const step = Math.ceil(max / 2 / 10) * 10;
      return { topVal: step * 2, ticks: [0, step, step * 2] };
    };

    const { topVal, ticks } = getChartYScale(dataMax);
    const chartHeight = height - paddingTop - paddingBottom;
    const chartWidth = width - paddingLeft - paddingRight;

    // Calculate (x, y) coordinates for data points
    const points = values.map((val, idx) => {
      const x = paddingLeft + (idx * chartWidth) / Math.max(1, values.length - 1);
      const y = height - paddingBottom - (val / topVal) * chartHeight;
      return { 
        x, 
        y, 
        val, 
        label: data.labels[idx] || '', 
        fullLabel: data.fullLabels?.[idx] || data.labels[idx] || '' 
      };
    });

    // Build smooth cubic bezier path
    const pathD = points.reduce((acc, pt, idx) => {
      if (idx === 0) return `M ${pt.x},${pt.y}`;
      const prev = points[idx - 1];
      const cx1 = prev.x + (pt.x - prev.x) / 2;
      const cy1 = prev.y;
      const cx2 = prev.x + (pt.x - prev.x) / 2;
      const cy2 = pt.y;
      return `${acc} C ${cx1},${cy1} ${cx2},${cy2} ${pt.x},${pt.y}`;
    }, '');

    // Bottom fill area
    const areaD = `${pathD} L ${points[points.length - 1].x},${height - paddingBottom} L ${points[0].x},${height - paddingBottom} Z`;

    const strokeColor = color === 'emerald' ? '#10b981' : '#f59e0b';
    const gradientId = `profile-chart-grad-${color}-${(activeUser.username || activeUser.name || 'user').replace(/[^a-zA-Z0-9]/g, '')}`;

    return (
      <div className="relative w-full overflow-hidden select-none">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-44 overflow-visible">
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={strokeColor} stopOpacity="0.32" />
              <stop offset="100%" stopColor={strokeColor} stopOpacity="0.01" />
            </linearGradient>
          </defs>

          {/* Vertical axis ticks and horizontal reference grid lines */}
          {ticks.map((tick) => {
            const y = height - paddingBottom - (tick / topVal) * chartHeight;
            const isBase = tick === 0;
            return (
              <g key={tick}>
                {/* Horizontal gridline */}
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={width - paddingRight}
                  y2={y}
                  stroke="currentColor"
                  className={isBase ? 'text-stone-300 dark:text-stone-700' : 'text-stone-200 dark:text-stone-800'}
                  strokeDasharray={isBase ? undefined : '3 3'}
                  strokeWidth={isBase ? '1.5' : '1'}
                />
                {/* Vertical axis number label */}
                <text
                  x={paddingLeft - 8}
                  y={y + 3.5}
                  textAnchor="end"
                  className="text-[10px] font-mono font-semibold fill-stone-400 dark:fill-stone-400 select-none"
                >
                  {tick}
                </text>
              </g>
            );
          })}

          {/* Area gradient fill */}
          <path d={areaD} fill={`url(#${gradientId})`} />

          {/* Line stroke */}
          <path
            d={pathD}
            fill="none"
            stroke={strokeColor}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Data Points */}
          {points.map((pt, idx) => {
            const isHovered = hoveredIdx === idx;
            return (
              <g key={idx} className="cursor-pointer">
                {isHovered && (
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r="9"
                    fill={strokeColor}
                    fillOpacity="0.25"
                    className="animate-ping"
                  />
                )}
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={isHovered ? '6' : '4'}
                  fill={strokeColor}
                  className="transition-all duration-150"
                />
                <circle cx={pt.x} cy={pt.y} r="2.5" fill="#ffffff" />

                {/* X-axis label (shown when non-empty, e.g. Ma, Di, Wo or month name) */}
                {pt.label ? (
                  <text
                    x={pt.x}
                    y={height - 8}
                    textAnchor="middle"
                    className={`text-[10px] font-semibold transition-colors ${
                      isHovered
                        ? 'fill-stone-900 dark:fill-stone-100 font-bold'
                        : 'fill-stone-400 dark:fill-stone-400'
                    }`}
                  >
                    {pt.label}
                  </text>
                ) : null}

                <rect
                  x={pt.x - 18}
                  y={paddingTop}
                  width="36"
                  height={chartHeight}
                  fill="transparent"
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                />
              </g>
            );
          })}
        </svg>

        {hoveredIdx !== null && points[hoveredIdx] && (
          <div
            className="absolute pointer-events-none px-3 py-1.5 rounded-xl bg-stone-900/95 dark:bg-stone-800/95 border border-stone-700 text-white text-xs font-bold shadow-xl -translate-x-1/2 -translate-y-full transition-all duration-75 z-20 flex items-center gap-1.5 whitespace-nowrap"
            style={{
              left: `${(points[hoveredIdx].x / width) * 100}%`,
              top: `${Math.max(22, (points[hoveredIdx].y / height) * 100 - 8)}%`,
            }}
          >
            <span className="text-amber-400">{points[hoveredIdx].fullLabel}:</span>
            <span>{points[hoveredIdx].val} {unit}</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      id="user-profile-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/65 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        id="user-profile-modal-card"
        className="relative w-full max-w-2xl max-h-[92vh] flex flex-col bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-stone-900 dark:text-stone-100 rounded-3xl shadow-2xl overflow-hidden animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Decorative Ambient Bar */}
        <div className="h-2 w-full bg-gradient-to-r from-amber-500 via-amber-400 to-amber-600 shrink-0" />

        {/* Modal Top Controls */}
        <div className="flex items-center justify-between px-5 pt-4 pb-2 shrink-0">
          <div>
            {viewingConnections !== null ? (
              <button
                id="user-profile-modal-back-from-connections-btn"
                onClick={() => {
                  setViewingConnections(null);
                  setConnectionsSearchQuery('');
                }}
                className="p-2 rounded-xl text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-white bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-750 cursor-pointer transition-all"
                title="Terug naar profiel"
                aria-label="Terug naar profiel"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            ) : historyStack.length > 0 ? (
              <button
                id="user-profile-modal-history-back-btn"
                onClick={handlePopHistory}
                className="p-2 rounded-xl text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-white bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-750 cursor-pointer transition-all"
                title={`Terug naar ${historyStack[historyStack.length - 1].name}`}
                aria-label={`Terug naar ${historyStack[historyStack.length - 1].name}`}
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            ) : (
              <div className="w-4 h-4" />
            )}
          </div>

          <button
            id="user-profile-modal-close-btn"
            onClick={onClose}
            className="p-2 rounded-xl text-stone-400 hover:text-stone-800 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
            title="Sluiten"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body Container */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-7 py-2 space-y-5">

          {/* VIEW A: CONNECTIONS LIST VIEW (Shown when clicking Volgers of Volgend) */}
          {viewingConnections !== null ? (
            <div className="space-y-4 pb-4 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-200 dark:border-stone-800">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-black text-stone-900 dark:text-white">
                      {viewingConnections === 'followers' ? 'Volgers' : 'Volgend'}
                    </h3>
                  </div>
                </div>

                {/* Subtab toggle inside connections view */}
                <div className="flex items-center gap-1 p-1 bg-stone-100 dark:bg-stone-800 rounded-xl border border-stone-200 dark:border-stone-700 shrink-0">
                  <button
                    onClick={() => {
                      setViewingConnections('followers');
                      setConnectionsSearchQuery('');
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      viewingConnections === 'followers'
                        ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-white shadow-xs'
                        : 'text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white'
                    }`}
                  >
                    Volgers ({followersCount})
                  </button>
                  <button
                    onClick={() => {
                      setViewingConnections('following');
                      setConnectionsSearchQuery('');
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      viewingConnections === 'following'
                        ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-white shadow-xs'
                        : 'text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white'
                    }`}
                  >
                    Volgend ({followingCount})
                  </button>
                </div>
              </div>

              {/* Search bar without placeholder text */}
              <div className="relative">
                <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={connectionsSearchQuery}
                  onChange={(e) => setConnectionsSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-stone-50 dark:bg-stone-850 border border-stone-200 dark:border-stone-800 rounded-xl text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                />
              </div>

              {/* Connections Cards Grid */}
              <div className="min-h-[160px]">
                {isLoadingDetails && activeConnectionsList.length === 0 ? (
                  <div className="py-12 text-center text-xs text-stone-400 animate-pulse">
                    Connecties laden via Firebase...
                  </div>
                ) : activeConnectionsList.length === 0 ? (
                  <div className="py-12 text-center text-xs text-stone-400 space-y-1 bg-stone-50 dark:bg-stone-850/50 rounded-2xl border border-stone-200 dark:border-stone-800">
                    <p className="font-semibold text-stone-500 dark:text-stone-400">
                      {connectionsSearchQuery
                        ? 'Geen gebruikers gevonden met deze zoekterm.'
                        : viewingConnections === 'followers'
                        ? `${activeUser.name} heeft op dit moment nog geen volgers.`
                        : `${activeUser.name} volgt op dit moment nog geen andere gebruikers.`}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {activeConnectionsList.map((u) => (
                      <div
                        key={u.email}
                        onClick={() => handleDrillUser(u)}
                        className="p-3 rounded-2xl bg-stone-50 dark:bg-stone-850/80 border border-stone-200 dark:border-stone-800 hover:border-amber-500/50 hover:bg-amber-500/5 hover:shadow-xs transition-all cursor-pointer flex items-center gap-3 group"
                      >
                        <div className="w-10 h-10 rounded-xl overflow-hidden bg-amber-500/20 text-amber-500 font-bold flex items-center justify-center text-sm shrink-0">
                          {u.avatarUrl ? (
                            <img src={u.avatarUrl} alt={u.name} className="w-full h-full object-cover" />
                          ) : (
                            <span>{(u.name || 'U').charAt(0).toUpperCase()}</span>
                          )}
                        </div>
                        <p className="text-sm font-bold text-stone-900 dark:text-white truncate group-hover:text-amber-500 transition-colors">
                          {u.name}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* VIEW B: MAIN PROFILE VIEW */
            <>
              {/* USER HEADER CARD */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-200 dark:border-stone-800">
                <div className="flex items-center gap-4">
                  <div className="relative shrink-0">
                    <div className="w-20 h-20 rounded-2xl overflow-hidden bg-gradient-to-tr from-amber-500 to-amber-300 text-stone-950 font-black flex items-center justify-center text-2xl shadow-lg border-2 border-amber-400/30">
                      {activeUser.avatarUrl ? (
                        <img src={activeUser.avatarUrl} alt={activeUser.name} className="w-full h-full object-cover" />
                      ) : (
                        <span>{(activeUser.name || 'U').charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    <div
                      className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-white dark:border-stone-900 flex items-center justify-center text-[10px] text-white font-bold"
                      title="Actieve leersessie"
                    >
                      ✓
                    </div>
                  </div>

                  <div className="space-y-1">
                    <h3 className="text-xl sm:text-2xl font-black text-stone-900 dark:text-white leading-tight">
                      {activeUser.name}
                    </h3>
                    <p className="text-xs text-stone-500 dark:text-stone-400">
                      <span className="font-semibold text-stone-700 dark:text-stone-300">
                        @{activeUser.username || (activeUser.name || 'gebruiker').toLowerCase().replace(/\s+/g, '')}
                      </span>
                    </p>

                    {/* Followers & Following counts (Clickable) */}
                    <div className="flex items-center gap-3 pt-1 text-xs">
                      <button
                        type="button"
                        id="user-profile-modal-followers-btn"
                        onClick={() => setViewingConnections('followers')}
                        className="inline-flex items-center gap-1.5 hover:text-amber-600 dark:hover:text-amber-400 transition-colors cursor-pointer group"
                        title="Bekijk wie deze gebruiker volgt"
                      >
                        <span className="font-extrabold text-stone-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400">
                          {followersCount}
                        </span>
                        <span className="text-stone-500 dark:text-stone-400 hover:underline">
                          {followersCount === 1 ? 'volger' : 'volgers'}
                        </span>
                      </button>
                      <span className="text-stone-300 dark:text-stone-700">·</span>
                      <button
                        type="button"
                        id="user-profile-modal-following-btn"
                        onClick={() => setViewingConnections('following')}
                        className="inline-flex items-center gap-1.5 hover:text-amber-600 dark:hover:text-amber-400 transition-colors cursor-pointer group"
                        title="Bekijk wie deze gebruiker volgt"
                      >
                        <span className="font-extrabold text-stone-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400">
                          {followingCount}
                        </span>
                        <span className="text-stone-500 dark:text-stone-400 hover:underline">
                          volgend
                        </span>
                      </button>
                      {isMe && (
                        <>
                          <span className="text-stone-300 dark:text-stone-700">·</span>
                          <span className="text-[11px] font-semibold text-purple-600 dark:text-purple-400">
                            Jouw profiel
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Follow / Unfollow Action Button (stays on right) */}
                {!isMe && (
                  <button
                    id="user-profile-modal-follow-btn"
                    onClick={() => onToggleFollow(activeUser)}
                    disabled={isUpdatingFollow}
                    className={`self-start sm:self-center flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer shadow-md ${
                      activeUser.isFollowing
                        ? 'bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-750 text-stone-800 dark:text-stone-200 border border-stone-300 dark:border-stone-700'
                        : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 shadow-amber-500/20'
                    } ${isUpdatingFollow ? 'opacity-70 cursor-not-allowed' : ''}`}
                  >
                    {activeUser.isFollowing ? (
                      <>
                        <UserCheck className="w-4 h-4 text-emerald-500" />
                        <span>Volgend</span>
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4" />
                        <span>Volgen</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* VLAG VAN DE TAAL DIE ZE LEREN + STREAK SYMBOOLTJE & CIJFER + NIVEAU / LEVEL */}
              <div className="flex flex-wrap items-center gap-2.5 pt-0.5">
                {/* 1. Vlag van de taal die ze leren */}
                <div 
                  id="user-profile-stat-language"
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-stone-100 dark:bg-stone-800/80 border border-stone-200 dark:border-stone-700/60 text-xs font-bold text-stone-800 dark:text-stone-200"
                >
                  <span className="text-lg leading-none">{targetLang.flag}</span>
                  <span>{targetLang.name}</span>
                </div>

                {/* 2. Streak symbooltje + cijfer van de streak */}
                <div 
                  id="user-profile-stat-streak"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 text-xs font-bold text-rose-700 dark:text-rose-400"
                  title={`${effectiveStreak} dagen streak`}
                >
                  <Flame className="w-4 h-4 text-rose-500 fill-rose-500" />
                  <span>{effectiveStreak}</span>
                </div>

                {/* 3. Niveau / level */}
                <div 
                  id="user-profile-stat-level"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 text-xs font-bold text-amber-700 dark:text-amber-400"
                >
                  <Award className="w-4 h-4 text-amber-500" />
                  <span>{activeUser.level || 'A1'} Level {activeUser.numericLevel || 1}</span>
                </div>
              </div>

              {/* DEZE WEEK & TOTAAL WOORDEN SUMMARY */}
              <div 
                id="user-profile-words-summary"
                className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-850/80 border border-stone-200 dark:border-stone-800 space-y-3"
              >
                <div 
                  onClick={() => setIsWeeklyWordsModalOpen(true)}
                  className="flex items-center justify-between p-1.5 -mx-1.5 rounded-xl hover:bg-stone-150 dark:hover:bg-stone-800 transition-all cursor-pointer group"
                  title="Bekijk de geleerde woorden van deze week"
                >
                  <span className="text-sm font-semibold text-stone-600 dark:text-stone-300 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-500" />
                    <span>Deze week</span>
                  </span>
                  <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 group-hover:underline">
                    {(activeUser.weeklyNewWordsCount || 0) > 0 ? `+${activeUser.weeklyNewWordsCount}` : '0'} woorden
                    <ChevronRight className="w-3.5 h-3.5 opacity-60 group-hover:translate-x-0.5 transition-transform" />
                  </span>
                </div>
                <div className="h-px bg-stone-200 dark:bg-stone-800" />
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-stone-600 dark:text-stone-300 flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-amber-500" />
                    <span>Totaal</span>
                  </span>
                  <span className="text-sm font-medium text-stone-700 dark:text-stone-300">
                    {activeUser.totalWordsLearned || 0} woorden
                  </span>
                </div>
              </div>

              {/* 2 GRAFIEKEN SECTION */}
              <div className="pt-1 pb-2">
                <div className="flex flex-col gap-4">
                  {/* GRAFIEK 1: HOEVEEL WOORDEN DE AFGELOPEN 7 DAGEN (NIET CUMULATIEF) */}
                  <div 
                    id="profile-chart-past-7-days"
                    className="p-4 sm:p-5 rounded-3xl bg-stone-50/80 dark:bg-stone-850/60 border border-stone-200 dark:border-stone-800 space-y-3 shadow-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                        <TrendingUp className="w-3.5 h-3.5" />
                        <span>Nieuwe woorden</span>
                      </span>
                    </div>

                    {renderInteractiveChart(
                      past7DaysData,
                      'emerald',
                      hoveredWeeklyIdx,
                      setHoveredWeeklyIdx,
                      'nieuwe woorden'
                    )}
                  </div>

                  {/* GRAFIEK 2: CUMULATIEF AANTAL WOORDEN SINDS START */}
                  <div 
                    id="profile-chart-cumulative"
                    className="p-4 sm:p-5 rounded-3xl bg-stone-50/80 dark:bg-stone-850/60 border border-stone-200 dark:border-stone-800 space-y-3 shadow-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                          <BookOpen className="w-3.5 h-3.5" />
                          <span>Cumulatieve woordenschat</span>
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                          <span>{cumulativeHistoryData.total || 0} woorden totaal</span>
                        </span>
                      </div>
                    </div>

                    {renderInteractiveChart(
                      cumulativeHistoryData,
                      'amber',
                      hoveredCumulativeIdx,
                      setHoveredCumulativeIdx,
                      'woorden cumulatief'
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

        </div>
      </div>

      {/* Weekly Words List Modal for active user */}
      {activeUser && (
        <WeeklyWordsModal
          isOpen={isWeeklyWordsModalOpen}
          onClose={() => setIsWeeklyWordsModalOpen(false)}
          userName={activeUser.name || activeUser.email.split('@')[0]}
          userEmail={activeUser.email}
          avatarUrl={activeUser.avatarUrl}
          targetLanguage={activeUser.targetLanguage || 'he'}
          knownLanguage={activeUser.knownLanguage || 'nl'}
          words={activeUser.weeklyWords || (activeUser.words ? getWeeklyLearnedWordsList(activeUser.words) : [])}
          count={activeUser.weeklyNewWordsCount || 0}
          isCurrentUser={currentEmail ? activeUser.email.toLowerCase() === currentEmail.toLowerCase() : false}
          isLoading={isLoadingDetails && !activeUser.weeklyWords}
        />
      )}
    </div>
  );
};
