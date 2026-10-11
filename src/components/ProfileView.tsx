import React, { useState, useMemo, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { 
  Flame, 
  Award, 
  Globe, 
  BookOpen, 
  Calendar, 
  Users, 
  UserCheck, 
  UserPlus, 
  Search, 
  Camera, 
  Check, 
  Edit2, 
  Pencil,
  ArrowLeft,
  TrendingUp,
  X,
  ExternalLink,
  QrCode,
  Copy,
  Download,
  Share2,
  RefreshCw,
  Sparkles,
  ChevronRight,
  Cloud,
  Database
} from 'lucide-react';
import { UserProfile, PublicUserProfile, CharacterAvatarConfig } from '../types';
import { getLanguage } from '../data/languages';
import { calculateCurrentStreak, isDailyPracticeCompletedToday, calculatePast7DaysWordStats, calculateCumulativeWordStats, getEffectiveWeeklyNewWordsCount, calculateWeeklyNewWordsCount } from '../utils/streak';
import { calculateTotalKnownWords } from '../utils/srs';
import { UserProfileModal } from './UserProfileModal';
import { AvatarCreatorModal } from './AvatarCreatorModal';
import { getCharacterAvatarDataUri, getDefaultAvatarConfig } from '../utils/characterAvatar';
import { 
  checkFirebaseStatus, 
  FirestoreStatusReport, 
  followUserInFirestore,
  searchPublicProfilesFirestore,
  normalizeIdentifierToEmail,
  getCanonicalEmailKey
} from '../lib/firebase';

interface ProfileViewProps {
  profile: UserProfile;
  onBackToDashboard: () => void;
  onUpdateProfile: (updated: Partial<UserProfile> | ((prev: UserProfile) => UserProfile)) => void;
  onNavigateToFriends?: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  profile,
  onBackToDashboard,
  onUpdateProfile,
  onNavigateToFriends,
}) => {
  // Social categories under profile: 'none' | 'followers' | 'following'
  const [activeSocialSection, setActiveSocialSection] = useState<'none' | 'followers' | 'following'>('none');

  // Animated Character Avatar Creator modal
  const [isAvatarCreatorOpen, setIsAvatarCreatorOpen] = useState(false);

  // Name editing
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(profile.name || 'Irith Fuks');

  // Unique QR Code Modal & Shareable Link
  const [isMyQrModalOpen, setIsMyQrModalOpen] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState(false);

  // Connections
  const [followingUsers, setFollowingUsers] = useState<PublicUserProfile[]>([]);
  const [followersUsers, setFollowersUsers] = useState<PublicUserProfile[]>([]);
  const [isLoadingConnections, setIsLoadingConnections] = useState(false);

  // Other user modal
  const [selectedOtherUser, setSelectedOtherUser] = useState<PublicUserProfile | null>(null);
  const [isOtherUserModalOpen, setIsOtherUserModalOpen] = useState(false);

  // Hovered chart points for tooltips
  const [hoveredWeeklyPoint, setHoveredWeeklyPoint] = useState<number | null>(null);
  const [hoveredCumulativePoint, setHoveredCumulativePoint] = useState<number | null>(null);

  // Dynamic effective streak calculation
  const currentStreak = useMemo(() => calculateCurrentStreak(profile), [profile]);
  const isStreakDoneToday = useMemo(() => isDailyPracticeCompletedToday(profile), [profile]);

  // Firebase Cloud Status
  const [cloudStatus, setCloudStatus] = useState<FirestoreStatusReport | null>(null);
  const [isCheckingCloud, setIsCheckingCloud] = useState(false);

  useEffect(() => {
    checkFirebaseStatus().then(report => setCloudStatus(report)).catch(() => {});
  }, []);

  const isNl = profile.knownLanguage === 'nl';
  const targetLang = getLanguage(profile.targetLanguage || 'he', profile.knownLanguage);
  const totalWordsLearned = calculateTotalKnownWords(profile);
  const totalBankWords = 6000;
  const wordsLearnedPercentage = Math.round((totalWordsLearned / totalBankWords) * 100);

  // Build unique shareable profile link
  const profileLink = useMemo(() => {
    if (typeof window !== 'undefined') {
      const origin = window.location.origin;
      const path = window.location.pathname;
      return `${origin}${path}?friendEmail=${encodeURIComponent(profile.email || '')}`;
    }
    return `https://vocabpulse.app/?friendEmail=${encodeURIComponent(profile.email || '')}`;
  }, [profile.email]);

  // Generate unique profile QR code using qrcode library
  useEffect(() => {
    if (profile.email) {
      QRCode.toDataURL(profileLink, {
        width: 320,
        margin: 2,
        color: {
          dark: '#1c1917',
          light: '#ffffff',
        },
      })
        .then((url: string) => setQrCodeDataUrl(url))
        .catch((err: unknown) => console.error('Error generating profile QR code:', err));
    }
  }, [profileLink, profile.email]);

  // Keyboard shortcut listener for Cmd+C / Ctrl+C when QR modal is active
  useEffect(() => {
    if (!isMyQrModalOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMyQrModalOpen(false);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'c') {
        handleCopyLink();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMyQrModalOpen, profileLink]);

  // Handle copying link to clipboard (with fallback & visual confirmation)
  const handleCopyLink = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(profileLink);
      } else {
        const ta = document.createElement('textarea');
        ta.value = profileLink;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch (e) {
      console.error('Failed to copy profile link:', e);
    }
  };

  // Download QR code image
  const handleDownloadQr = () => {
    if (!qrCodeDataUrl) return;
    const a = document.createElement('a');
    a.href = qrCodeDataUrl;
    a.download = `vocabpulse-qr-${(profile.name || 'profile').toLowerCase().replace(/\s+/g, '-')}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };



  // Load connections (Dual-Source: Server API & Cloud Firestore Live Graph)
  const loadConnections = async () => {
    setIsLoadingConnections(true);
    try {
      const cleanMyEmail = (profile.email || '').toLowerCase().trim();
      const cleanMyKey = cleanMyEmail ? getCanonicalEmailKey(cleanMyEmail) : '';

      // 1. Fetch server connections
      const serverPromise = fetch(`/api/social/connections?email=${encodeURIComponent(profile.email || '')}`)
        .then(r => r.ok ? r.json() : { following: [], followers: [] })
        .catch(() => ({ following: [], followers: [] }));

      // 2. Fetch live Firestore public profiles
      const firestorePromise = searchPublicProfilesFirestore('', cleanMyEmail)
        .catch(() => [] as PublicUserProfile[]);

      const [serverData, firestoreUsers] = await Promise.all([serverPromise, firestorePromise]);

      const followingMap = new Map<string, PublicUserProfile>();
      const followersMap = new Map<string, PublicUserProfile>();

      // Seed with server data
      (serverData.following || []).forEach((u: PublicUserProfile) => {
        const email = normalizeIdentifierToEmail(u.email);
        if (email && email !== cleanMyEmail) {
          followingMap.set(email, { ...u, email, isFollowing: true });
        }
      });
      (serverData.followers || []).forEach((u: PublicUserProfile) => {
        const email = normalizeIdentifierToEmail(u.email);
        if (email && email !== cleanMyEmail) {
          followersMap.set(email, { ...u, email, isFollower: true });
        }
      });

      // Enrich & merge with Firestore public profiles
      firestoreUsers.forEach((u: PublicUserProfile) => {
        const email = normalizeIdentifierToEmail(u.email);
        if (!email || email === cleanMyEmail) return;

        const rawFollowers = (u.followers || []).map(normalizeIdentifierToEmail);
        const rawFollowing = (u.following || []).map(normalizeIdentifierToEmail);

        // Am I in target user's followers list? Or target in current user's profile.following?
        const isFollowedByMe = (
          rawFollowers.includes(cleanMyEmail) ||
          (cleanMyKey ? (u.followers || []).includes(cleanMyKey) : false) ||
          (profile.following || []).map(normalizeIdentifierToEmail).includes(email)
        );

        // Is target in current user's followers list, or am I in target's following list?
        const isFollowingMe = (
          rawFollowing.includes(cleanMyEmail) ||
          (cleanMyKey ? (u.following || []).includes(cleanMyKey) : false) ||
          (profile.followers || []).map(normalizeIdentifierToEmail).includes(email)
        );

        if (isFollowedByMe) {
          const existing = followingMap.get(email);
          followingMap.set(email, {
            ...(existing || u),
            ...u,
            email,
            isFollowing: true,
            isFollower: isFollowingMe || existing?.isFollower,
          });
        }

        if (isFollowingMe) {
          const existing = followersMap.get(email);
          followersMap.set(email, {
            ...(existing || u),
            ...u,
            email,
            isFollower: true,
            isFollowing: isFollowedByMe || existing?.isFollowing,
          });
        }
      });

      // Also ensure any email currently in profile.following has a card
      (profile.following || []).forEach((rawE: string) => {
        const email = normalizeIdentifierToEmail(rawE);
        if (email && email !== cleanMyEmail && !followingMap.has(email)) {
          followingMap.set(email, {
            email,
            name: email.split('@')[0],
            username: email.split('@')[0],
            targetLanguage: 'he',
            knownLanguage: 'en',
            level: 'A1',
            numericLevel: 1,
            currentStreak: 0,
            streakDays: 0,
            maxStreakDays: 0,
            lastActiveDateStr: '',
            totalWordsLearned: 0,
            totalSessionsCompleted: 0,
            weeklyNewWordsCount: 0,
            isFollowing: true,
            isFollower: false,
          });
        }
      });

      const finalFollowing = Array.from(followingMap.values()).map(u => ({
        ...u,
        streakDays: calculateCurrentStreak(u),
        currentStreak: calculateCurrentStreak(u),
        weeklyNewWordsCount: getEffectiveWeeklyNewWordsCount(u),
      }));
      const finalFollowers = Array.from(followersMap.values()).map(u => ({
        ...u,
        streakDays: calculateCurrentStreak(u),
        currentStreak: calculateCurrentStreak(u),
        weeklyNewWordsCount: getEffectiveWeeklyNewWordsCount(u),
      }));

      setFollowingUsers(finalFollowing);
      setFollowersUsers(finalFollowers);

      // If we discovered followers or following from Firestore that weren't in profile, update profile
      const newFollowingEmails = finalFollowing.map(u => u.email);
      const existingFollowingSet = new Set((profile.following || []).map(normalizeIdentifierToEmail));
      const hasNewFollowing = newFollowingEmails.some(e => !existingFollowingSet.has(e));

      if (hasNewFollowing) {
        onUpdateProfile(prev => ({
          ...prev,
          following: Array.from(new Set([...(prev.following || []).map(normalizeIdentifierToEmail), ...newFollowingEmails])),
        }));
      }
    } catch (e) {
      console.error('Error loading connections:', e);
    } finally {
      setIsLoadingConnections(false);
    }
  };

  useEffect(() => {
    loadConnections();

    // Check for friendEmail in URL query parameters on mount (from shared link or scanned QR)
    try {
      const params = new URLSearchParams(window.location.search);
      const urlFriendEmail = params.get('friendEmail') || params.get('friend');
      if (urlFriendEmail && urlFriendEmail.toLowerCase() !== (profile.email || '').toLowerCase()) {
        fetch(`/api/social/profile/${encodeURIComponent(urlFriendEmail)}?currentEmail=${encodeURIComponent(profile.email || '')}`)
          .then((r) => r.json())
          .then((data) => {
            if (data.profile) {
              setSelectedOtherUser(data.profile);
              setIsOtherUserModalOpen(true);
            }
          })
          .catch((err) => console.error('Error opening friend profile from URL:', err));
      }
    } catch (e) {
      console.error('Error parsing URL params:', e);
    }
  }, [profile.email]);

  // Name save
  const handleSaveName = () => {
    if (editedName.trim()) {
      onUpdateProfile({ 
        name: editedName.trim()
      });
    }
    setIsEditingName(false);
  };

  // Synchronize edited values when profile changes
  useEffect(() => {
    if (profile.name) setEditedName(profile.name);
  }, [profile.name]);

  // Follow/unfollow toggle
  const handleToggleFollow = async (targetUser: PublicUserProfile) => {
    const newFollowState = !targetUser.isFollowing;
    const targetEmail = normalizeIdentifierToEmail(targetUser.email);
    try {
      const res = await fetch('/api/social/follow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentEmail: profile.email,
          targetEmail: targetEmail,
          follow: newFollowState,
        }),
      });

      // Also sync to Cloud Firestore
      if (profile.email) {
        followUserInFirestore(profile.email, targetEmail, newFollowState).catch((fErr) => {
          console.warn('Firestore follow sync note:', fErr);
        });
      }

      if (res.ok) {
        setFollowingUsers(prev => {
          if (newFollowState) {
            const exists = prev.some(u => normalizeIdentifierToEmail(u.email) === targetEmail);
            return exists ? prev.map(u => normalizeIdentifierToEmail(u.email) === targetEmail ? { ...u, isFollowing: true } : u) : [...prev, { ...targetUser, email: targetEmail, isFollowing: true }];
          } else {
            return prev.filter(u => normalizeIdentifierToEmail(u.email) !== targetEmail);
          }
        });

        onUpdateProfile(prev => {
          const currentFollowing = new Set<string>((prev.following || []).map(normalizeIdentifierToEmail));
          if (newFollowState) {
            currentFollowing.add(targetEmail);
          } else {
            currentFollowing.delete(targetEmail);
          }
          return {
            ...prev,
            following: Array.from(currentFollowing),
          };
        });

        // Reload connections to ensure mutual followers/following counts are updated
        loadConnections();
      }
    } catch (e) {
      console.error('Error toggling follow:', e);
    }
  };

  // Calculate weekly new words count for this week (only new words learned via daily sessions)
  const weeklyNewWordsCount = useMemo(() => {
    return calculateWeeklyNewWordsCount(profile.words);
  }, [profile.words]);

  // PAST 7 DAYS NEW WORDS DATA (Non-cumulative: Ma, Di, Wo, Do, Vr, Za, Zo)
  const past7DaysData = useMemo(() => {
    return calculatePast7DaysWordStats(profile.words);
  }, [profile.words]);

  // CUMULATIVE VOCABULARY GROWTH DATA (Since start until now)
  const cumulativeHistoryData = useMemo(() => {
    return calculateCumulativeWordStats(profile.words, profile.createdAt);
  }, [profile.words, profile.createdAt]);

  const displayName = profile.name || 'Irith Fuks';
  const defaultAvatarUrl = useMemo(() => {
    return getCharacterAvatarDataUri(profile.avatarConfig || getDefaultAvatarConfig('bear'));
  }, [profile.avatarConfig]);
  const currentAvatarUrl = profile.avatarUrl || defaultAvatarUrl;

  // Helper to render responsive SVG line chart with clear Y-axis numbers & grid
  const renderLineChart = (
    data: { labels: string[]; values: number[] },
    color: 'emerald' | 'amber',
    hoveredIndex: number | null,
    setHoveredIndex: (idx: number | null) => void,
    unit: string = 'words'
  ) => {
    const width = 520;
    const height = 170;
    const paddingLeft = 48;
    const paddingRight = 20;
    const paddingY = 26;

    const rawMax = Math.max(...data.values, 10);
    // Round upper boundary to a neat multiple for clear, readable Y-axis numbers
    const topVal = rawMax > 100 
      ? Math.ceil(rawMax / 25) * 25 
      : rawMax > 40 
        ? Math.ceil(rawMax / 10) * 10 
        : Math.ceil(rawMax / 5) * 5;
    const midVal = Math.round(topVal / 2);
    const minVal = 0;
    const range = topVal - minVal || 1;

    // Calculate (x, y) coordinates for points
    const points = data.values.map((val, idx) => {
      const x = paddingLeft + (idx * (width - paddingLeft - paddingRight)) / (data.values.length - 1);
      const y = height - paddingY - ((val - minVal) / range) * (height - 2 * paddingY);
      return { x, y, val, label: data.labels[idx] };
    });

    // Build SVG Path
    const pathD = points.reduce((acc, pt, idx) => {
      if (idx === 0) return `M ${pt.x},${pt.y}`;
      const prev = points[idx - 1];
      const cx1 = prev.x + (pt.x - prev.x) / 2;
      const cy1 = prev.y;
      const cx2 = prev.x + (pt.x - prev.x) / 2;
      const cy2 = pt.y;
      return `${acc} C ${cx1},${cy1} ${cx2},${cy2} ${pt.x},${pt.y}`;
    }, '');

    // Area path for gradient fill underneath
    const areaD = `${pathD} L ${points[points.length - 1].x},${height - paddingY} L ${points[0].x},${height - paddingY} Z`;

    const strokeColor = color === 'emerald' ? '#10b981' : '#f59e0b';
    const gradientId = `chart-gradient-${color}`;
    const midY = (height - 2 * paddingY) / 2 + paddingY;

    return (
      <div className="relative w-full select-none">
        <svg viewBox={`-8 0 ${width + 8} ${height}`} className="w-full h-44 overflow-visible">
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={strokeColor} stopOpacity="0.25" />
              <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Horizontal grid lines & Y-axis numbers */}
          {/* Top line */}
          <line 
            x1={paddingLeft} 
            y1={paddingY} 
            x2={width - paddingRight} 
            y2={paddingY} 
            stroke="currentColor" 
            className="text-stone-200 dark:text-stone-800" 
            strokeDasharray="3 3" 
            strokeWidth="1" 
          />
          <text
            x={paddingLeft - 8}
            y={paddingY + 3.5}
            textAnchor="end"
            fill="currentColor"
            className="text-[11px] font-mono font-semibold text-stone-500 dark:text-stone-400 select-none"
          >
            {topVal}
          </text>

          {/* Mid line */}
          <line 
            x1={paddingLeft} 
            y1={midY} 
            x2={width - paddingRight} 
            y2={midY} 
            stroke="currentColor" 
            className="text-stone-200 dark:text-stone-800" 
            strokeDasharray="3 3" 
            strokeWidth="1" 
          />
          <text
            x={paddingLeft - 8}
            y={midY + 3.5}
            textAnchor="end"
            fill="currentColor"
            className="text-[11px] font-mono font-semibold text-stone-500 dark:text-stone-400 select-none"
          >
            {midVal}
          </text>

          {/* Bottom baseline */}
          <line 
            x1={paddingLeft} 
            y1={height - paddingY} 
            x2={width - paddingRight} 
            y2={height - paddingY} 
            stroke="currentColor" 
            className="text-stone-300 dark:text-stone-700" 
            strokeWidth="1.5" 
          />
          <text
            x={paddingLeft - 8}
            y={height - paddingY + 3.5}
            textAnchor="end"
            fill="currentColor"
            className="text-[11px] font-mono font-semibold text-stone-500 dark:text-stone-400 select-none"
          >
            0
          </text>

          {/* Gradient Area Fill */}
          <path d={areaD} fill={`url(#${gradientId})`} />

          {/* Smooth Line Stroke */}
          <path 
            d={pathD} 
            fill="none" 
            stroke={strokeColor} 
            strokeWidth="3" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
          />

          {/* Data Points and Hover Target circles */}
          {points.map((pt, idx) => {
            const isHovered = hoveredIndex === idx;
            return (
              <g key={idx} className="cursor-pointer">
                {/* Invisible large hit area */}
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r="16"
                  fill="transparent"
                  onMouseEnter={() => setHoveredIndex(idx)}
                  onMouseLeave={() => setHoveredIndex(null)}
                />
                
                {/* Visible dot */}
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={isHovered ? '6' : '4.5'}
                  fill={isHovered ? '#ffffff' : strokeColor}
                  stroke={strokeColor}
                  strokeWidth="2.5"
                  className="transition-all duration-150 pointer-events-none shadow-sm"
                />

                {/* X-axis label */}
                {pt.label ? (
                  <text
                    x={pt.x}
                    y={height - paddingY + 18}
                    textAnchor="middle"
                    className="text-[10px] fill-stone-400 dark:fill-stone-500 font-medium pointer-events-none"
                  >
                    {pt.label}
                  </text>
                ) : null}

                {/* Value tooltip above point */}
                {isHovered && (
                  <g className="pointer-events-none animate-fade-in">
                    <rect
                      x={pt.x - 36}
                      y={pt.y - 28}
                      width="72"
                      height="20"
                      rx="6"
                      className="fill-stone-900 stroke-stone-700 dark:fill-stone-950"
                      strokeWidth="1"
                    />
                    <text
                      x={pt.x}
                      y={pt.y - 15}
                      textAnchor="middle"
                      className="text-[10px] fill-white font-bold"
                    >
                      {pt.val} {unit}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    );
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-6 space-y-7 animate-fade-in text-stone-900 dark:text-stone-100">

      {/* Main Profile Header Card (Instagram-style layout) */}
      <div 
        id="profile-header-card"
        className="p-6 sm:p-7 rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-sm relative overflow-hidden"
      >
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 text-center sm:text-left">
          
          {/* Avatar with Choose Avatar action */}
          <div className="relative group flex-shrink-0">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden bg-gradient-to-tr from-amber-500 to-amber-300 text-stone-950 font-bold flex items-center justify-center text-3xl shadow-md border-3 border-amber-400/40">
              <img 
                src={currentAvatarUrl} 
                alt={displayName} 
                className="w-full h-full object-cover" 
              />
            </div>
            
            <button
              id="profile-change-avatar-btn"
              onClick={() => setIsAvatarCreatorOpen(true)}
              className="absolute bottom-0 right-0 p-2 rounded-full bg-amber-500 text-stone-950 hover:bg-amber-400 transition-all shadow-md cursor-pointer border-2 border-white dark:border-stone-900"
              title={isNl ? 'Karakter aanpassen' : 'Customize character'}
            >
              <Pencil className="w-4 h-4" />
            </button>
          </div>

          {/* Name & Badges */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-center sm:justify-start">
              {isEditingName ? (
                <div className="flex flex-col gap-2.5 max-w-sm w-full bg-stone-50 dark:bg-stone-850 p-3 rounded-2xl border border-stone-200 dark:border-stone-700 text-left">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400 block mb-1">
                      {isNl ? 'Weergavenaam' : 'Display name'}
                    </label>
                    <input
                      id="profile-edit-name-input"
                      type="text"
                      value={editedName}
                      onChange={(e) => setEditedName(e.target.value)}
                      placeholder={isNl ? 'Jouw naam' : 'Your name'}
                      className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 text-stone-900 dark:text-white text-sm font-bold focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={handleSaveName}
                      className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-bold text-xs flex items-center gap-1 cursor-pointer shadow-sm"
                      title={isNl ? 'Opslaan' : 'Save'}
                    >
                      <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>{isNl ? 'Opslaan' : 'Save'}</span>
                    </button>
                    <button
                      onClick={() => setIsEditingName(false)}
                      className="px-3 py-1.5 rounded-xl bg-stone-200 dark:bg-stone-700 hover:bg-stone-300 dark:hover:bg-stone-600 text-stone-700 dark:text-stone-300 text-xs font-semibold cursor-pointer"
                    >
                      {isNl ? 'Annuleren' : 'Cancel'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center sm:items-start text-center sm:text-left">
                  <div className="flex items-center gap-2 justify-center sm:justify-start">
                    <h2 className="text-2xl sm:text-3xl font-black text-stone-900 dark:text-white tracking-tight">
                      {displayName}
                    </h2>
                    <button
                      id="profile-edit-name-btn"
                      onClick={() => setIsEditingName(true)}
                      className="p-1.5 text-stone-400 hover:text-stone-700 dark:hover:text-white rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
                      title={isNl ? 'Naam bewerken' : 'Edit name'}
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </div>
                  <span className="text-xs font-semibold text-stone-500 dark:text-stone-400 block text-center sm:text-left">
                    @{profile.username || profile.email.split('@')[0]}
                  </span>
                </div>
              )}
            </div>

            {/* Badges directly by the name: Flag badge, Level & Streak (single clean row) */}
            <div className="flex flex-nowrap items-center gap-2 justify-center sm:justify-start mt-2.5 overflow-x-auto">
              <span className="inline-flex items-center px-2.5 py-1 rounded-xl text-xs font-bold bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 whitespace-nowrap" title={targetLang.name}>
                <span className="text-sm leading-none">{targetLang.flag}</span>
              </span>

              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 whitespace-nowrap">
                <Award className="w-3.5 h-3.5 text-amber-500" />
                <span>{profile.level} · L{profile.numericLevel || 1}</span>
              </span>

              <span
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold border whitespace-nowrap transition-all ${
                  isStreakDoneToday
                    ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/60'
                    : 'bg-stone-100 dark:bg-stone-850 text-stone-500 dark:text-stone-400 border-stone-200 dark:border-stone-800'
                }`}
                title={
                  isStreakDoneToday
                    ? `${currentStreak}d streak (${isNl ? 'vandaag al gehaald!' : 'completed today!'})`
                    : `${currentStreak}d streak (${isNl ? 'vandaag nog te halen' : 'not completed yet today'})`
                }
              >
                <Flame className={`w-3.5 h-3.5 shrink-0 transition-colors ${isStreakDoneToday ? 'text-amber-500 fill-amber-500' : 'text-stone-400 fill-none'}`} />
                <span>{currentStreak}d</span>
              </span>
            </div>

            {/* INSTAGRAM-STYLE SOCIAL CATEGORIES: Followers, Following & QR Code */}
            <div className="mt-5 pt-4 border-t border-stone-100 dark:border-stone-800 flex flex-wrap items-center justify-center sm:justify-start gap-4 sm:gap-6">
              
              {/* Followers Button */}
              <button
                id="profile-followers-tab-btn"
                onClick={() => setActiveSocialSection(activeSocialSection === 'followers' ? 'none' : 'followers')}
                className={`flex items-baseline gap-1.5 transition-all cursor-pointer group ${
                  activeSocialSection === 'followers' ? 'text-amber-600 dark:text-amber-400 font-black' : 'text-stone-700 dark:text-stone-300'
                }`}
              >
                <span className="text-base sm:text-lg font-black text-stone-900 dark:text-white group-hover:text-amber-500 transition-colors">
                  {Math.max(followersUsers.length, (profile.followers || []).length)}
                </span>
                <span className="text-xs font-semibold text-stone-500 dark:text-stone-400 group-hover:text-stone-700 dark:group-hover:text-stone-200">
                  {isNl ? 'Volgers' : 'Followers'}
                </span>
              </button>

              {/* Following Button */}
              <button
                id="profile-following-tab-btn"
                onClick={() => setActiveSocialSection(activeSocialSection === 'following' ? 'none' : 'following')}
                className={`flex items-baseline gap-1.5 transition-all cursor-pointer group ${
                  activeSocialSection === 'following' ? 'text-amber-600 dark:text-amber-400 font-black' : 'text-stone-700 dark:text-stone-300'
                }`}
              >
                <span className="text-base sm:text-lg font-black text-stone-900 dark:text-white group-hover:text-amber-500 transition-colors">
                  {Math.max(followingUsers.length, (profile.following || []).length)}
                </span>
                <span className="text-xs font-semibold text-stone-500 dark:text-stone-400 group-hover:text-stone-700 dark:group-hover:text-stone-200">
                  {isNl ? 'Volgend' : 'Following'}
                </span>
              </button>

              {/* QR Code button directly next to Followers & Following */}
              <button
                id="profile-my-qr-btn"
                onClick={() => setIsMyQrModalOpen(true)}
                className="w-7 h-7 inline-flex items-center justify-center rounded-lg bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 border border-stone-200 dark:border-stone-700 cursor-pointer transition-all shadow-xs hover:border-amber-500/50"
                title={isNl ? 'Mijn unieke QR-code & deelbare profiellink' : 'My unique QR code & shareable profile link'}
                aria-label="QR-code"
              >
                <QrCode className="w-3.5 h-3.5 text-amber-500" />
              </button>
            </div>

          </div>
        </div>

        {/* EXPANDABLE INSTAGRAM-STYLE SOCIAL DRAWER (Followers / Following) */}
        {activeSocialSection !== 'none' && (
          <div className="mt-6 pt-5 border-t border-stone-200 dark:border-stone-800 animate-fade-in">
            
            {/* Top drawer header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-stone-900 dark:text-white capitalize">
                  {activeSocialSection === 'followers' && `${isNl ? 'Volgers' : 'Followers'} (${Math.max(followersUsers.length, (profile.followers || []).length)})`}
                  {activeSocialSection === 'following' && `${isNl ? 'Volgend' : 'Following'} (${Math.max(followingUsers.length, (profile.following || []).length)})`}
                </span>
              </div>
              <button
                onClick={() => setActiveSocialSection('none')}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 cursor-pointer"
                title={isNl ? 'Sluiten' : 'Close'}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* SECTION: FOLLOWERS */}
            {activeSocialSection === 'followers' && (
              <div className="space-y-3">
                {followersUsers.length === 0 ? (
                  <p className="text-xs text-stone-400 py-3 text-center">
                    Nog geen volgers. Vrienden die jou volgen verschijnen hier automatisch!
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {followersUsers.map((user) => {
                      const uLang = getLanguage(user.targetLanguage || 'he');
                      const isFollowingBack = followingUsers.some(u => u.email.toLowerCase() === user.email.toLowerCase());

                      return (
                        <div
                          key={user.email}
                          onClick={() => {
                            setSelectedOtherUser(user);
                            setIsOtherUserModalOpen(true);
                          }}
                          className="p-3.5 rounded-2xl bg-white dark:bg-white border border-stone-200 dark:border-stone-300 hover:border-amber-500/50 transition-all cursor-pointer flex items-center justify-between shadow-2xs"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-xl overflow-hidden bg-stone-900 dark:bg-stone-900 flex-shrink-0 flex items-center justify-center">
                              {user.avatarUrl ? (
                                <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center font-bold text-white text-sm">
                                  {user.name.charAt(0).toUpperCase()}
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <h4 className="text-xs font-bold text-black dark:text-black truncate">{user.name}</h4>
                              <div className="flex items-center gap-2 mt-0.5 text-[11px] text-stone-700 dark:text-stone-700 font-medium">
                                <span>{uLang.flag} {uLang.name}</span>
                                <span>•</span>
                                <span className="text-amber-600 font-bold">{user.level}</span>
                                <span>•</span>
                                <span className="text-rose-600 font-bold flex items-center gap-0.5">
                                  <Flame className="w-3 h-3" />
                                  {user.streakDays}d
                                </span>
                              </div>
                            </div>
                          </div>

                          {isFollowingBack ? (
                            <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-700 flex items-center gap-1">
                              <Check className="w-3.5 h-3.5" />
                              <span>Volg je al</span>
                            </span>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleFollow(user);
                              }}
                              className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-[11px] cursor-pointer transition-colors shadow-2xs"
                            >
                              Terugvolgen
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* SECTION: FOLLOWING */}
            {activeSocialSection === 'following' && (
              <div className="space-y-3">
                {followingUsers.length === 0 ? (
                  <div className="text-center py-4 space-y-2">
                    <p className="text-xs text-stone-400">
                      {isNl ? 'Je volgt momenteel nog niemand.' : 'You are not following anyone yet.'}
                    </p>
                    {onNavigateToFriends && (
                      <button
                        onClick={onNavigateToFriends}
                        className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-bold cursor-pointer inline-flex items-center gap-1.5 shadow-xs transition-colors"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>{isNl ? 'Vrienden zoeken in Social' : 'Find friends in Social'}</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {followingUsers.map((user) => {
                      const uLang = getLanguage(user.targetLanguage || 'he');
                      return (
                        <div
                          key={user.email}
                          onClick={() => {
                            setSelectedOtherUser(user);
                            setIsOtherUserModalOpen(true);
                          }}
                          className="p-3.5 rounded-2xl bg-white dark:bg-white border border-stone-200 dark:border-stone-300 hover:border-amber-500/50 transition-all cursor-pointer flex items-center justify-between shadow-2xs"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-xl overflow-hidden bg-stone-900 dark:bg-stone-900 flex-shrink-0 flex items-center justify-center">
                              {user.avatarUrl ? (
                                <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center font-bold text-white text-sm">
                                  {user.name.charAt(0).toUpperCase()}
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <h4 className="text-xs font-bold text-black dark:text-black truncate">{user.name}</h4>
                              <div className="flex items-center gap-2 mt-0.5 text-[11px] text-stone-700 dark:text-stone-700 font-medium">
                                <span>{uLang.flag} {uLang.name}</span>
                                <span>•</span>
                                <span className="text-amber-600 font-bold">{user.level}</span>
                                <span>•</span>
                                <span className="text-rose-600 font-bold flex items-center gap-0.5">
                                  <Flame className="w-3 h-3" />
                                  {user.streakDays}d
                                </span>
                              </div>
                            </div>
                          </div>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleFollow(user);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-stone-900 hover:bg-rose-600 text-white text-[11px] font-bold cursor-pointer transition-colors shadow-2xs"
                          >
                            Ontvolgen
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

          </div>
        )}

      </div>

      {/* TWO CORE VISUAL PROGRESSION CARDS (WITH REQUESTED LINE CHARTS) */}
      <div className="flex flex-col gap-6">

        {/* 1. AANTAL NIEUWE WOORDEN + 6-WEKEN LIJNGRAFIEK */}
        <div 
          id="profile-weekly-words-card"
          className="p-6 rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-sm space-y-4"
        >
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                <span>{isNl ? 'Nieuwe woorden' : 'New words'}</span>
              </span>
              <div className="flex items-baseline gap-2">
                <h3 className="text-2xl font-black text-stone-900 dark:text-white">
                  +{weeklyNewWordsCount}
                </h3>
                <span className="text-xs font-semibold text-stone-500 dark:text-stone-400">
                  {isNl ? 'deze week geleerd' : 'learned this week'}
                </span>
              </div>
            </div>
          </div>

          {/* 7-Days Line Graph */}
          {renderLineChart(
            past7DaysData,
            'emerald',
            hoveredWeeklyPoint,
            setHoveredWeeklyPoint,
            isNl ? 'nieuwe woorden' : 'new words'
          )}
        </div>

        {/* 2. TOTAAL AANTAL WOORDEN + CUMULATIEVE LIJNGRAFIEK */}
        <div 
          id="profile-total-words-card"
          className="p-6 rounded-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-sm space-y-4"
        >
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5" />
                <span>{isNl ? 'Totaal aantal woorden' : 'Total words'}</span>
              </span>
              <div className="flex items-baseline gap-2">
                <h3 className="text-2xl font-black text-stone-900 dark:text-white">
                  {totalWordsLearned}
                </h3>
                <span className="text-xs font-semibold text-stone-500 dark:text-stone-400 whitespace-nowrap">
                  {isNl ? 'woorden geleerd' : 'words learned'}
                </span>
              </div>
            </div>

            {/* Percentage of total words done indicator (sleek 1-line badge) */}
            <div className="text-right">
              <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 whitespace-nowrap">
                <span>{wordsLearnedPercentage}% {isNl ? 'voltooid' : 'completed'}</span>
              </span>
            </div>
          </div>

          <p className="text-xs text-stone-500 dark:text-stone-400">
            {isNl ? 'Cumulatieve groei:' : 'Cumulative growth:'}
          </p>

          {/* Cumulative Line Graph */}
          {renderLineChart(
            cumulativeHistoryData,
            'amber',
            hoveredCumulativePoint,
            setHoveredCumulativePoint,
            isNl ? 'totaal woorden' : 'total words'
          )}
        </div>

      </div>

      {/* --- ANIMATED CHARACTER AVATAR CREATOR MODAL --- */}
      <AvatarCreatorModal
        isOpen={isAvatarCreatorOpen}
        onClose={() => setIsAvatarCreatorOpen(false)}
        currentConfig={profile.avatarConfig || getDefaultAvatarConfig('bear')}
        knownLanguage={profile.knownLanguage || 'en'}
        onSaveAvatar={(url, newConfig) => {
          onUpdateProfile({
            avatarUrl: url,
            avatarConfig: newConfig,
          });
        }}
      />

      {/* Embedded modal if user clicks on another learner in following/followers */}
      {selectedOtherUser && (
        <UserProfileModal
          user={selectedOtherUser}
          isOpen={isOtherUserModalOpen}
          onClose={() => setIsOtherUserModalOpen(false)}
          onToggleFollow={(u) => handleToggleFollow(u)}
          currentEmail={profile.email}
          onSelectUser={(u) => setSelectedOtherUser(u)}
        />
      )}

      {/* UNIQUE PROFILE QR CODE & COPY LINK MODAL */}
      {isMyQrModalOpen && (
        <div 
          id="profile-qr-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in"
          onClick={() => setIsMyQrModalOpen(false)}
        >
          <div 
            className="w-full max-w-md bg-white dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-2xl p-6 sm:p-7 space-y-5 animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400">
                  <QrCode className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-stone-900 dark:text-white">
                    {isNl ? 'Jouw unieke QR-code' : 'Your unique QR code'}
                  </h3>
                  <p className="text-xs text-stone-500 dark:text-stone-400">
                    {isNl ? 'Laat vrienden je profiel direct vinden & volgen' : 'Let friends find & follow your profile instantly'}
                  </p>
                </div>
              </div>

              <button
                id="profile-qr-modal-close-btn"
                onClick={() => setIsMyQrModalOpen(false)}
                className="p-1.5 rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer transition-colors"
                title={isNl ? 'Sluiten' : 'Close'}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* User Mini Preview */}
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-stone-50 dark:bg-stone-850 border border-stone-200/80 dark:border-stone-800">
              <div className="w-12 h-12 rounded-full overflow-hidden bg-gradient-to-tr from-amber-500 to-amber-300 flex-shrink-0 border-2 border-amber-400/50">
                <img src={currentAvatarUrl} alt={displayName} className="w-full h-full object-cover" />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-sm font-bold text-stone-900 dark:text-white truncate">
                  {displayName}
                </h4>
                <div className="flex items-center gap-2 mt-0.5 text-xs text-stone-500 dark:text-stone-400">
                  <span className="font-semibold text-stone-700 dark:text-stone-300">
                    @{profile.email.split('@')[0]}
                  </span>
                  <span>•</span>
                  <span>{targetLang.flag} {profile.level}</span>
                </div>
              </div>
            </div>

            {/* QR Code Display Frame */}
            <div className="flex flex-col items-center justify-center p-5 bg-stone-50 dark:bg-stone-850 rounded-2xl border border-stone-200 dark:border-stone-800">
              <div className="bg-white p-3 rounded-2xl shadow-md border border-stone-200/70">
                {qrCodeDataUrl ? (
                  <img
                    id="profile-generated-qr-image"
                    src={qrCodeDataUrl}
                    alt="Profiellink QR code"
                    className="w-52 h-52 sm:w-56 sm:h-56 object-contain select-none"
                  />
                ) : (
                  <div className="w-52 h-52 flex items-center justify-center text-stone-400 text-xs">
                    {isNl ? 'QR-code genereren...' : 'Generating QR code...'}
                  </div>
                )}
              </div>

              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={handleDownloadQr}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-stone-800 hover:bg-stone-100 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 text-xs font-semibold border border-stone-200 dark:border-stone-700 cursor-pointer shadow-xs transition-colors"
                >
                  <Download className="w-3.5 h-3.5 text-amber-500" />
                  <span>{isNl ? 'Download afbeelding' : 'Download image'}</span>
                </button>
              </div>
            </div>

            {/* Shareable Link & Copy Functionality (Command C / Ctrl C) */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-stone-700 dark:text-stone-300 flex items-center justify-between">
                <span>{isNl ? 'Deelbare link naar jouw profiel' : 'Shareable link to your profile'}</span>
                <span className="text-[10px] text-stone-400 font-normal">
                  (⌘C / Ctrl+C)
                </span>
              </label>

              <div className="flex items-center gap-2">
                <input
                  id="profile-share-link-input"
                  type="text"
                  readOnly
                  value={profileLink}
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                  className="flex-1 px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-xs text-stone-900 dark:text-white font-mono select-all focus:outline-none focus:ring-2 focus:ring-amber-500"
                />

                <button
                  id="profile-copy-link-btn"
                  onClick={handleCopyLink}
                  className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all shadow-sm flex-shrink-0 ${
                    copiedLink
                      ? 'bg-emerald-500 text-stone-950'
                      : 'bg-amber-500 hover:bg-amber-400 text-stone-950'
                  }`}
                  title={isNl ? 'Kopieer link naar klembord' : 'Copy link to clipboard'}
                >
                  {copiedLink ? (
                    <>
                      <Check className="w-4 h-4 stroke-[2.5]" />
                      <span>{isNl ? 'Gekopieerd!' : 'Copied!'}</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>{isNl ? 'Kopieer link' : 'Copy link'}</span>
                    </>
                  )}
                </button>
              </div>

              {copiedLink && (
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1 animate-fade-in pt-0.5">
                  <Check className="w-3.5 h-3.5" />
                  <span>{isNl ? 'Link succesvol gekopieerd naar klembord!' : 'Link copied to clipboard!'}</span>
                </p>
              )}

              <p className="text-[11px] text-stone-400 pt-1 leading-relaxed">
                Als je vriend op deze link klikt of je QR scant, wordt jouw profiel meteen voor hen geopend en kunnen ze je met één klik volgen.
              </p>
            </div>

            {/* Bottom close button */}
            <div className="pt-2 border-t border-stone-100 dark:border-stone-800 flex justify-end">
              <button
                onClick={() => setIsMyQrModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-750 text-stone-800 dark:text-stone-200 text-xs font-bold cursor-pointer transition-colors"
              >
                Sluiten
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
