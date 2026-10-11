import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  User,
  Search, 
  UserPlus, 
  UserCheck, 
  Flame, 
  Award, 
  Trophy, 
  Plus, 
  Globe, 
  Calendar, 
  ArrowLeft,
  Medal,
  CheckCircle2,
  Sparkles,
  RefreshCw,
  Zap,
  BookOpen,
  ChevronDown,
  ChevronRight,
  LogOut,
  Trash2,
  MoreVertical,
  Clock
} from 'lucide-react';
import { UserProfile, PublicUserProfile, FriendPool, FriendPoolMember } from '../types';
import { getLanguage } from '../data/languages';
import { UserProfileModal } from './UserProfileModal';
import { WeeklyWordsModal } from './WeeklyWordsModal';
import { 
  searchPublicProfilesFirestore, 
  followUserInFirestore, 
  normalizeIdentifierToEmail, 
  getCanonicalEmailKey,
  getPublicProfileFirestore
} from '../lib/firebase';
import { 
  calculateWeeklyNewWordsCount, 
  calculateCurrentStreak, 
  getEffectiveWeeklyNewWordsCount, 
  getWeeklyLearnedWordsList, 
  WeeklyLearnedWord 
} from '../utils/streak';
import { calculateTotalKnownWords } from '../utils/srs';

interface FriendsViewProps {
  profile: UserProfile;
  onBackToDashboard: () => void;
  onUpdateProfile: (updater: (prev: UserProfile) => UserProfile) => void;
  onOpenMyProfile?: () => void;
}

type FriendsTab = 'pools' | 'search';

export const FriendsView: React.FC<FriendsViewProps> = ({
  profile,
  onBackToDashboard,
  onUpdateProfile,
  onOpenMyProfile,
}) => {
  const [activeTab, setActiveTab] = useState<FriendsTab>('pools');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Data states
  const [followingUsers, setFollowingUsers] = useState<PublicUserProfile[]>([]);
  const [followersUsers, setFollowersUsers] = useState<PublicUserProfile[]>([]);
  const [searchResults, setSearchResults] = useState<PublicUserProfile[]>([]);
  const [pools, setPools] = useState<FriendPool[]>([]);
  const [selectedPoolId, setSelectedPoolId] = useState<string>('');
  
  // Loading & Modal states
  const [isLoading, setIsLoading] = useState(false);
  const [selectedUserProfile, setSelectedUserProfile] = useState<PublicUserProfile | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isUpdatingFollow, setIsUpdatingFollow] = useState(false);
  const [isCreatePoolOpen, setIsCreatePoolOpen] = useState(false);
  const [isPoolMenuOpen, setIsPoolMenuOpen] = useState(false);
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
  const [selectedFriendsToAdd, setSelectedFriendsToAdd] = useState<string[]>([]);
  const [isAddingMembers, setIsAddingMembers] = useState(false);

  // Weekly words list modal state
  const [isWeeklyWordsModalOpen, setIsWeeklyWordsModalOpen] = useState(false);
  const [selectedWeeklyWordsModalData, setSelectedWeeklyWordsModalData] = useState<{
    name: string;
    email: string;
    avatarUrl?: string;
    targetLanguage: string;
    count: number;
    words: WeeklyLearnedWord[];
    isCurrentUser: boolean;
    isLoading: boolean;
  } | null>(null);

  // New pool form state
  const [newPoolName, setNewPoolName] = useState('');
  const [selectedFriendsForPool, setSelectedFriendsForPool] = useState<string[]>([]);
  const [isCreatingPool, setIsCreatingPool] = useState(false);

  // Fold state for poules:
  // - 'all': unfolded (default: arrow points down)
  // - 'top3': only top 3 visible (arrow points right)
  // - 'none': completely folded (arrow points up)
  type PoolFoldMode = 'all' | 'top3' | 'none';
  const [poolFoldStates, setPoolFoldStates] = useState<Record<string, PoolFoldMode>>({});

  const getFoldMode = (poolId: string): PoolFoldMode => {
    return poolFoldStates[poolId] || (pouleTimeInfo.isSundayEvening ? 'top3' : 'all');
  };

  const handleToggleFold = (poolId: string) => {
    setPoolFoldStates(prev => {
      const current = prev[poolId] || (pouleTimeInfo.isSundayEvening ? 'top3' : 'all');
      let next: PoolFoldMode;
      if (pouleTimeInfo.isSundayEvening) {
        // Zondagavond (uitslagen):
        // punt naar rechts (alleen podium) -> punt naar beneden (ook gehele ranking)
        // punt naar beneden (gehele ranking) -> punt omhoog (alleen titel)
        // punt omhoog (alleen titel) -> punt naar rechts (alleen podium)
        if (current === 'top3') {
          next = 'all';
        } else if (current === 'all') {
          next = 'none';
        } else {
          next = 'top3';
        }
      } else {
        // Na zondag / doordeweeks: podium is weg, actieve strijd
        // Toggle tussen gehele ranking (punt naar beneden) en ingeklapt (punt omhoog)
        next = current === 'all' ? 'none' : 'all';
      }
      return { ...prev, [poolId]: next };
    });
  };

  // Calculate current user's weekly new words list & count (resets every Monday 00:00:00)
  // "in ranking horen alleen woorden te staan die ik via daily sessies heb geleerd, of die ik handmatig naar 'geleerd' heb verplaatst"
  const currentUserWeeklyWordsList = useMemo(() => {
    return getWeeklyLearnedWordsList(profile.words, new Date(), profile.targetLanguage);
  }, [profile.words, profile.targetLanguage]);

  const currentUserWeeklyWords = useMemo(() => {
    return currentUserWeeklyWordsList.length;
  }, [currentUserWeeklyWordsList]);

  // Open weekly words list modal for any member or current user
  const handleOpenWeeklyWords = async (member: FriendPoolMember, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    const cleanEmail = (member.email || '').toLowerCase().trim();
    const isCurrent = member.isCurrentUser || cleanEmail === (profile.email || '').toLowerCase().trim();

    if (isCurrent) {
      setSelectedWeeklyWordsModalData({
        name: profile.name || profile.email.split('@')[0],
        email: profile.email,
        avatarUrl: profile.avatarUrl,
        targetLanguage: profile.targetLanguage,
        count: currentUserWeeklyWordsList.length,
        words: currentUserWeeklyWordsList,
        isCurrentUser: true,
        isLoading: false,
      });
      setIsWeeklyWordsModalOpen(true);
      return;
    }

    // Other pool member: if weekly words are already available on member object
    if (Array.isArray(member.weeklyWords) && member.weeklyWords.length > 0) {
      setSelectedWeeklyWordsModalData({
        name: member.name,
        email: member.email,
        avatarUrl: member.avatarUrl,
        targetLanguage: member.targetLanguage,
        count: member.weeklyNewWordsCount,
        words: member.weeklyWords,
        isCurrentUser: false,
        isLoading: false,
      });
      setIsWeeklyWordsModalOpen(true);
      return;
    }

    // Set loading state and fetch from API / Firestore
    setSelectedWeeklyWordsModalData({
      name: member.name,
      email: member.email,
      avatarUrl: member.avatarUrl,
      targetLanguage: member.targetLanguage,
      count: member.weeklyNewWordsCount,
      words: [],
      isCurrentUser: false,
      isLoading: true,
    });
    setIsWeeklyWordsModalOpen(true);

    try {
      const langParam = encodeURIComponent(member.targetLanguage || profile.targetLanguage || 'he');
      const res = await fetch(`/api/social/user/${encodeURIComponent(cleanEmail)}/weekly-words?targetLanguage=${langParam}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedWeeklyWordsModalData(prev => prev && prev.email.toLowerCase() === cleanEmail ? {
          ...prev,
          words: data.words || [],
          count: data.count !== undefined ? data.count : (data.words?.length || prev.count),
          isLoading: false,
        } : prev);
        return;
      }

      // Fallback: check Firestore publicProfiles
      const fsUser = await getPublicProfileFirestore(cleanEmail);
      const fsWords = fsUser?.weeklyWords || [];
      setSelectedWeeklyWordsModalData(prev => prev && prev.email.toLowerCase() === cleanEmail ? {
        ...prev,
        words: fsWords,
        count: fsWords.length || prev.count,
        isLoading: false,
      } : prev);
    } catch (err) {
      console.error('Error fetching weekly words for pool member:', err);
      setSelectedWeeklyWordsModalData(prev => prev ? { ...prev, isLoading: false } : null);
    }
  };

  // Real-time ticking poule clock (updates every 30 seconds)
  const [currentPouleTime, setCurrentPouleTime] = useState<Date>(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentPouleTime(new Date());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  // Countdown & Sunday evening logic:
  // Week ends Sunday at 20:00.
  // Monday: '7 days left' / '7 dagen over'
  // Tuesday: '6 days left' / '6 dagen over'
  // Wednesday: '5 days left' / '5 dagen over'
  // Thursday: '4 days left' / '4 dagen over'
  // Friday: '3 days left' / '3 dagen over'
  // Saturday: '2 days left' / '2 dagen over'
  // Sunday (00:00 - 19:59): Count hours! (e.g. 08:00 -> '12 hours left', 10:00 -> '10 hours left', 13:00 -> '7 hours left')
  // Sunday evening (from 20:00): Week ended, top 3 podium displayed with 'Congrats [Winner]!'
  const pouleTimeInfo = useMemo(() => {
    const isNl = profile.knownLanguage === 'nl';
    const day = currentPouleTime.getDay(); // 0 = Sunday, 1 = Monday ... 6 = Saturday
    const hour = currentPouleTime.getHours();

    if (day === 0) {
      if (hour >= 20) {
        return {
          text: isNl ? 'Uitslag bekend! 🏆' : 'Results in! 🏆',
          isSundayEvening: true,
          hoursLeft: 0,
        };
      }
      const hoursLeft = Math.max(1, 20 - hour);
      const text = isNl
        ? `${hoursLeft} ${hoursLeft === 1 ? 'uur over' : 'uur over'}`
        : `${hoursLeft} ${hoursLeft === 1 ? 'hour left' : 'hours left'}`;
      return {
        text,
        isSundayEvening: false,
        hoursLeft,
      };
    }

    const daysMap: Record<number, number> = {
      1: 7,
      2: 6,
      3: 5,
      4: 4,
      5: 3,
      6: 2,
    };
    const daysLeft = daysMap[day] || 7;
    const text = isNl
      ? `${daysLeft} ${daysLeft === 1 ? 'dag over' : 'dagen over'}`
      : `${daysLeft} ${daysLeft === 1 ? 'day left' : 'days left'}`;

    return {
      text,
      isSundayEvening: false,
      daysLeft,
    };
  }, [currentPouleTime, profile.knownLanguage]);

  // Open modal for a poule member (handles self vs other learners)
  const handleOpenPoolMember = (member: FriendPoolMember) => {
    const isUser = member.isCurrentUser || (profile.email && member.email.toLowerCase() === profile.email.toLowerCase());
    if (!isUser) {
      handleOpenUserProfile({
        email: member.email,
        name: member.name,
        avatarUrl: member.avatarUrl,
        targetLanguage: member.targetLanguage,
        level: member.level,
        numericLevel: member.numericLevel,
        streakDays: member.streakDays,
        totalWordsLearned: member.weeklyNewWordsCount * 7,
        totalSessionsCompleted: 20,
        weeklyNewWordsCount: member.weeklyNewWordsCount,
        isFollowing: followingUsers.some(u => u.email.toLowerCase() === member.email.toLowerCase()),
        isFollower: followersUsers.some(u => u.email.toLowerCase() === member.email.toLowerCase()),
      });
    } else {
      handleOpenUserProfile({
        email: profile.email || 'jij@taal.nl',
        name: profile.name || 'Jij',
        avatarUrl: profile.avatarUrl,
        targetLanguage: profile.targetLanguage || 'he',
        knownLanguage: profile.knownLanguage || 'en',
        level: profile.level || 'A1',
        numericLevel: profile.numericLevel || 1,
        streakDays: calculateCurrentStreak(profile),
        totalWordsLearned: calculateTotalKnownWords(profile),
        totalSessionsCompleted: profile.totalSessionsCompleted || 0,
        weeklyNewWordsCount: currentUserWeeklyWords,
        isFollowing: false,
        isFollower: false,
      });
    }
  };

  // Load connections (Dual-Source: Server & Firestore live graph)
  const loadConnections = async () => {
    setIsLoading(true);
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

        const isFollowedByMe = (
          rawFollowers.includes(cleanMyEmail) ||
          (cleanMyKey ? (u.followers || []).includes(cleanMyKey) : false) ||
          (profile.following || []).map(normalizeIdentifierToEmail).includes(email)
        );

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
      console.error('Failed to load connections:', e);
    } finally {
      setIsLoading(false);
    }
  };

  // Load pools
  const loadPools = async () => {
    try {
      const res = await fetch(`/api/social/pools?email=${encodeURIComponent(profile.email || '')}`);
      if (res.ok) {
        const data = await res.json();
        const loadedPools: FriendPool[] = data.pools || [];
        
        // Query live Firestore public profiles to enrich members with actual real-time stats
        const firestoreMap = new Map<string, PublicUserProfile>();
        try {
          const publicDocs = await searchPublicProfilesFirestore('', profile.email);
          publicDocs.forEach(u => {
            if (u.email) firestoreMap.set(u.email.toLowerCase().trim(), u);
          });
        } catch (fErr) {
          // Fallback to server data
        }

        // Inject current user's latest stats into pools & enrich with live Firestore data
        const updatedPools = loadedPools.map(p => {
          const members = p.members.map(m => {
            const cleanEmail = (m.email || '').toLowerCase().trim();
            const isCurrent = m.isCurrentUser || cleanEmail === (profile.email || '').toLowerCase().trim();
            if (isCurrent) {
              return {
                ...m,
                name: profile.name || profile.email.split('@')[0],
                avatarUrl: profile.avatarUrl,
                level: profile.level,
                numericLevel: profile.numericLevel || 1,
                targetLanguage: profile.targetLanguage,
                streakDays: calculateCurrentStreak(profile),
                weeklyNewWordsCount: currentUserWeeklyWords,
                weeklyWords: currentUserWeeklyWordsList,
                isCurrentUser: true,
              };
            }

            const liveUser = firestoreMap.get(cleanEmail);
            if (liveUser) {
              const liveStreak = calculateCurrentStreak(liveUser);
              const liveWeekly = getEffectiveWeeklyNewWordsCount(liveUser, new Date(), m.targetLanguage);
              return {
                ...m,
                name: liveUser.name || m.name,
                avatarUrl: liveUser.avatarUrl || m.avatarUrl,
                level: liveUser.level || m.level,
                numericLevel: liveUser.numericLevel || m.numericLevel,
                targetLanguage: liveUser.targetLanguage || m.targetLanguage,
                streakDays: liveStreak,
                weeklyNewWordsCount: liveWeekly,
                weeklyWords: liveUser.weeklyWords || m.weeklyWords || [],
              };
            }

            return {
              ...m,
              streakDays: calculateCurrentStreak(m as any),
              weeklyNewWordsCount: getEffectiveWeeklyNewWordsCount(m as any, new Date(), m.targetLanguage),
              weeklyWords: (m as any).weeklyWords || [],
            };
          });

          // Re-sort members descending by weekly new words learned (+1 per new word)
          members.sort((a, b) => b.weeklyNewWordsCount - a.weeklyNewWordsCount);

          return { ...p, members };
        });

        setPools(updatedPools);
        if (updatedPools.length > 0 && !selectedPoolId) {
          setSelectedPoolId(updatedPools[0].id);
        }
      }
    } catch (e) {
      console.error('Failed to load pools:', e);
    }
  };

  // Search users (searches server catalog AND Cloud Firestore publicProfiles)
  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    try {
      const serverResPromise = fetch(
        `/api/social/search?q=${encodeURIComponent(query)}&currentEmail=${encodeURIComponent(profile.email || '')}`
      ).then(r => r.ok ? r.json() : { users: [] }).catch(() => ({ users: [] }));

      const firestorePromise = searchPublicProfilesFirestore(query, profile.email);

      const [serverData, firestoreUsers] = await Promise.all([serverResPromise, firestorePromise]);

      const userMap = new Map<string, PublicUserProfile>();
      const currentFollowing = new Set<string>((profile.following || []).map(e => e.toLowerCase()));
      const currentFollowers = new Set<string>((profile.followers || []).map(e => e.toLowerCase()));

      // 1. Add Firestore users
      firestoreUsers.forEach(u => {
        const cleanEmail = u.email.toLowerCase().trim();
        userMap.set(cleanEmail, {
          ...u,
          isFollowing: currentFollowing.has(cleanEmail),
          isFollower: currentFollowers.has(cleanEmail),
        });
      });

      // 2. Add / merge server users
      (serverData.users || []).forEach((u: PublicUserProfile) => {
        const cleanEmail = u.email.toLowerCase().trim();
        userMap.set(cleanEmail, {
          ...u,
          isFollowing: currentFollowing.has(cleanEmail) || u.isFollowing,
          isFollower: currentFollowers.has(cleanEmail) || u.isFollower,
        });
      });

      if (!query) {
        // "People you may know": The people that the people that I follow follow / are followed by
        const cleanMyEmail = (profile.email || '').toLowerCase().trim();
        const candidateScores = new Map<string, number>();
        const allKnown = Array.from(userMap.values());
        const userByEmail = new Map<string, PublicUserProfile>();
        allKnown.forEach(u => userByEmail.set(u.email.toLowerCase().trim(), u));

        currentFollowing.forEach(friendEmail => {
          const friend = userByEmail.get(friendEmail);
          if (friend) {
            // People my friend follows
            (friend.following || []).forEach((target: string) => {
              const cleanTarget = target.toLowerCase().trim();
              if (cleanTarget && cleanTarget !== cleanMyEmail) {
                candidateScores.set(cleanTarget, (candidateScores.get(cleanTarget) || 0) + 1);
              }
            });
            // People that follow my friend (are followed by)
            (friend.followers || []).forEach((follower: string) => {
              const cleanFollower = follower.toLowerCase().trim();
              if (cleanFollower && cleanFollower !== cleanMyEmail) {
                candidateScores.set(cleanFollower, (candidateScores.get(cleanFollower) || 0) + 1);
              }
            });
          }
        });

        const serverRankMap = new Map<string, number>();
        (serverData.users || []).forEach((u: PublicUserProfile, idx: number) => {
          serverRankMap.set(u.email.toLowerCase().trim(), idx);
        });

        const unfollowedCandidates: PublicUserProfile[] = [];
        const followedCandidates: PublicUserProfile[] = [];
        const remainingLearners: PublicUserProfile[] = [];

        allKnown.forEach(u => {
          const uEmail = u.email.toLowerCase().trim();
          if (uEmail === cleanMyEmail) return;
          const score = candidateScores.get(uEmail) || 0;
          if (score > 0) {
            if (!currentFollowing.has(uEmail)) {
              unfollowedCandidates.push(u);
            } else {
              followedCandidates.push(u);
            }
          } else {
            remainingLearners.push(u);
          }
        });

        unfollowedCandidates.sort((a, b) => {
          const scoreA = candidateScores.get(a.email.toLowerCase().trim()) || 0;
          const scoreB = candidateScores.get(b.email.toLowerCase().trim()) || 0;
          if (scoreB !== scoreA) return scoreB - scoreA;
          const rankA = serverRankMap.get(a.email.toLowerCase().trim()) ?? 999;
          const rankB = serverRankMap.get(b.email.toLowerCase().trim()) ?? 999;
          return rankA - rankB;
        });

        followedCandidates.sort((a, b) => {
          const scoreA = candidateScores.get(a.email.toLowerCase().trim()) || 0;
          const scoreB = candidateScores.get(b.email.toLowerCase().trim()) || 0;
          if (scoreB !== scoreA) return scoreB - scoreA;
          const rankA = serverRankMap.get(a.email.toLowerCase().trim()) ?? 999;
          const rankB = serverRankMap.get(b.email.toLowerCase().trim()) ?? 999;
          return rankA - rankB;
        });

        remainingLearners.sort((a, b) => {
          const rankA = serverRankMap.get(a.email.toLowerCase().trim()) ?? 999;
          const rankB = serverRankMap.get(b.email.toLowerCase().trim()) ?? 999;
          return rankA - rankB;
        });

        setSearchResults([...unfollowedCandidates, ...followedCandidates, ...remainingLearners]);
      } else {
        setSearchResults(Array.from(userMap.values()));
      }
    } catch (e) {
      console.error('Search failed:', e);
    }
  };

  // Initial load
  useEffect(() => {
    loadConnections();
    loadPools();
    handleSearch('');
  }, [profile.email]);

  // Handle follow / unfollow toggle
  const handleToggleFollow = async (targetUser: PublicUserProfile) => {
    setIsUpdatingFollow(true);
    const newFollowState = !targetUser.isFollowing;

    try {
      const res = await fetch('/api/social/follow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentEmail: profile.email,
          targetEmail: targetUser.email,
          follow: newFollowState,
        }),
      });

      // Also directly sync social graph in Firestore publicProfiles
      if (profile.email) {
        followUserInFirestore(profile.email, targetUser.email, newFollowState).catch((fErr) => {
          console.warn('Firestore direct follow sync note:', fErr);
        });
      }

      if (res.ok) {
        // Update local state in following/followers/search results
        const updateItem = (u: PublicUserProfile) =>
          u.email.toLowerCase() === targetUser.email.toLowerCase()
            ? { ...u, isFollowing: newFollowState }
            : u;

        setFollowingUsers(prev => {
          if (newFollowState) {
            const exists = prev.some(u => u.email.toLowerCase() === targetUser.email.toLowerCase());
            return exists ? prev.map(updateItem) : [...prev, { ...targetUser, isFollowing: true }];
          } else {
            return prev.filter(u => u.email.toLowerCase() !== targetUser.email.toLowerCase());
          }
        });

        setFollowersUsers(prev => prev.map(updateItem));
        setSearchResults(prev => prev.map(updateItem));

        if (selectedUserProfile && selectedUserProfile.email.toLowerCase() === targetUser.email.toLowerCase()) {
          setSelectedUserProfile({ ...selectedUserProfile, isFollowing: newFollowState });
        }

        // Update profile in parent
        onUpdateProfile(prev => {
          const currentFollowing = new Set<string>(prev.following || []);
          if (newFollowState) {
            currentFollowing.add(targetUser.email.toLowerCase());
          } else {
            currentFollowing.delete(targetUser.email.toLowerCase());
          }
          return {
            ...prev,
            following: Array.from(currentFollowing),
          };
        });

        // Re-sync connections in background
        loadConnections();
      }
    } catch (e) {
      console.error('Error toggling follow:', e);
    } finally {
      setIsUpdatingFollow(false);
    }
  };

  // Open user profile
  const handleOpenUserProfile = (user: PublicUserProfile) => {
    setSelectedUserProfile(user);
    setIsProfileModalOpen(true);
  };

  // Create new pool
  const handleCreatePool = async () => {
    if (!newPoolName.trim()) return;
    setIsCreatingPool(true);

    try {
      const res = await fetch('/api/social/pools/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: profile.email,
          name: newPoolName.trim(),
          memberEmails: selectedFriendsForPool,
        }),
      });

      if (res.ok) {
        const createData = await res.json();
        if (createData.pool?.id) {
          setSelectedPoolId(createData.pool.id);
        }
        await loadPools();
        setIsCreatePoolOpen(false);
        setNewPoolName('');
        setSelectedFriendsForPool([]);
        setActiveTab('pools');
      }
    } catch (e) {
      console.error('Failed to create pool:', e);
    } finally {
      setIsCreatingPool(false);
    }
  };

  // 1. Leave pool handler
  const handleLeavePool = async (poolId: string) => {
    if (!window.confirm('Weet je zeker dat je deze poule wilt verlaten?')) return;
    try {
      const res = await fetch('/api/social/pools/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ poolId, email: profile.email }),
      });
      if (res.ok) {
        setIsPoolMenuOpen(false);
        setSelectedPoolId('');
        await loadPools();
      }
    } catch (e) {
      console.error('Failed to leave pool:', e);
    }
  };

  // 2. Delete pool handler
  const handleDeletePool = async (poolId: string) => {
    if (!window.confirm('Weet je zeker dat je deze poule wilt verwijderen voor alle deelnemers? Dit kan niet ongedaan worden gemaakt.')) return;
    try {
      const res = await fetch('/api/social/pools/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ poolId, email: profile.email }),
      });
      if (res.ok) {
        setIsPoolMenuOpen(false);
        setSelectedPoolId('');
        await loadPools();
      }
    } catch (e) {
      console.error('Failed to delete pool:', e);
    }
  };

  // 3. Add members to pool handler
  const handleAddMembersToCurrentPool = async () => {
    if (!currentPool || selectedFriendsToAdd.length === 0) return;
    setIsAddingMembers(true);
    try {
      const res = await fetch('/api/social/pools/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          poolId: currentPool.id,
          inviteEmails: selectedFriendsToAdd,
          senderEmail: profile.email,
        }),
      });
      if (res.ok) {
        setIsAddMemberModalOpen(false);
        setSelectedFriendsToAdd([]);
        setIsPoolMenuOpen(false);
        await loadPools();
      }
    } catch (e) {
      console.error('Failed to add members to pool:', e);
    } finally {
      setIsAddingMembers(false);
    }
  };

  // Active pool selection
  const currentPool = pools.find(p => p.id === selectedPoolId) || pools[0];

  return (
    <div id="friends-view-container" className="max-w-5xl mx-auto px-4 py-6 sm:py-8 space-y-6">
      {/* Top Bar with Title & Social Navigation Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-200 dark:border-stone-800">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400">
            <Users className="w-5 h-5" />
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-stone-900 dark:text-stone-100">
            Social
          </h1>
        </div>

        {/* Social Navigation Tabs: Poules & Vrienden zoeken */}
        <div className="flex items-center gap-2">
          <div className="flex items-center p-1 rounded-2xl bg-stone-100 dark:bg-stone-850 border border-stone-200 dark:border-stone-800">
            <button
              id="social-tab-poules-btn"
              onClick={() => setActiveTab('pools')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'pools'
                  ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-white shadow-xs border border-stone-200 dark:border-stone-750'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white'
              }`}
            >
              <Trophy className="w-3.5 h-3.5 text-amber-500" />
              <span>Poules</span>
            </button>

            <button
              id="social-tab-find-friends-btn"
              onClick={() => setActiveTab('search')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'search'
                  ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-white shadow-xs border border-stone-200 dark:border-stone-750'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5 text-amber-500" />
              <span>{profile.knownLanguage === 'nl' ? 'Vrienden zoeken' : 'Find friends'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* --- TAB: VRIENDEN ZOEKEN & ONTDEKKEN --- */}
      {activeTab === 'search' && (
        <div id="friends-tab-search-content" className="space-y-4 animate-fade-in">
          {/* Prominent Search Bar Container */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <label htmlFor="friends-search-input" className="text-xs font-bold text-stone-700 dark:text-stone-300 flex items-center gap-1.5">
                <Search className="w-4 h-4 text-amber-500" />
              </label>
              {searchQuery && (
                <span className="text-[11px] text-stone-400">
                  {searchResults.length} {profile.knownLanguage === 'nl' ? 'resultaten' : 'results'}
                </span>
              )}
            </div>

            <div className="relative w-full">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" />
              <input
                id="friends-search-input"
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full pl-10 pr-16 py-2.5 rounded-xl bg-white dark:bg-white border border-stone-300 dark:border-stone-300 text-black dark:text-black text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 transition-all shadow-2xs font-medium"
                autoFocus
              />
              {searchQuery && (
                <button
                  onClick={() => handleSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 text-xs font-semibold px-2 py-0.5 rounded cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
              {searchQuery
                ? (profile.knownLanguage === 'nl'
                    ? `Zoekresultaten voor "${searchQuery}" (${searchResults.length})`
                    : `Search results for "${searchQuery}" (${searchResults.length})`)
                : 'People you may know'}
            </h2>
          </div>

          {searchResults.length === 0 ? (
            <div className="p-8 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-center space-y-2">
              <Search className="w-8 h-8 text-stone-400 mx-auto" />
              <p className="text-sm font-bold text-stone-900 dark:text-stone-100">
                Geen gebruikers gevonden
              </p>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Probeer een andere zoekterm of naam.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {searchResults.map((user) => (
                <div
                  key={user.email}
                  onClick={() => handleOpenUserProfile(user)}
                  className="group relative p-3.5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 hover:border-amber-500/50 dark:hover:border-amber-500/50 shadow-xs hover:shadow-md transition-all cursor-pointer flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-xl overflow-hidden bg-gradient-to-tr from-amber-500 to-amber-300 text-stone-950 font-bold flex items-center justify-center text-sm shadow-xs shrink-0">
                      {user.avatarUrl ? (
                        <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
                      ) : (
                        <span>{(user.name || user.email).charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100 truncate group-hover:text-amber-500 transition-colors">
                        {user.name}
                      </h3>
                      <p className="text-[11px] text-stone-400 dark:text-stone-500 truncate">
                        @{user.username || user.email.split('@')[0]}
                      </p>
                    </div>
                  </div>

                  <button
                    id={`search-follow-btn-${user.email.replace(/[^a-zA-Z0-9]/g, '-')}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleFollow(user);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                      user.isFollowing
                        ? 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700 hover:bg-stone-200 dark:hover:bg-stone-700'
                        : 'bg-amber-500 hover:bg-amber-400 text-stone-950 shadow-xs'
                    }`}
                  >
                    {user.isFollowing ? (
                      <>
                        <UserCheck className="w-3.5 h-3.5 text-emerald-500" />
                        <span>{profile.knownLanguage === 'nl' ? 'Volgend' : 'Following'}</span>
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>{profile.knownLanguage === 'nl' ? 'Volgen' : 'Follow'}</span>
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* --- TAB: POULES (Leaderboard) --- */}
      {activeTab === 'pools' && (
        <div id="friends-tab-pools-content" className="space-y-5">
          {/* Header directly above the leaderboard */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-3">
              <h2 className="text-lg sm:text-xl font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-500" />
                <span>Poules</span>
              </h2>

              {/* Dynamic countdown: '7 days left', '6 days left' ... and on Sunday hours left e.g. '12 hours left' */}
              <div 
                id="poule-countdown-badge"
                className={`flex items-center gap-1.5 px-3 py-1 rounded-xl border text-xs font-bold transition-all ${
                  pouleTimeInfo.isSundayEvening
                    ? 'bg-amber-500 text-stone-950 border-amber-400 font-black shadow-xs'
                    : pouleTimeInfo.hoursLeft !== undefined
                      ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 animate-pulse'
                      : 'bg-amber-500/10 dark:bg-amber-500/15 border-amber-500/20 text-amber-700 dark:text-amber-400'
                }`}
                title={
                  pouleTimeInfo.isSundayEvening
                    ? 'Zondagavond: Week is afgerond, uitslag bekend!'
                    : 'De weekpoule eindigt elke zondag om 20:00'
                }
              >
                {pouleTimeInfo.isSundayEvening ? (
                  <span>{pouleTimeInfo.text}</span>
                ) : (
                  <>
                    <Clock className="w-3.5 h-3.5" />
                    <span>{pouleTimeInfo.text}</span>
                  </>
                )}
              </div>
            </div>

            <button
              id="top-create-pool-btn"
              onClick={() => {
                setSelectedFriendsForPool(followingUsers.map(u => u.email));
                setIsCreatePoolOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-extrabold shadow-sm active:scale-98 transition-all cursor-pointer w-fit"
            >
              <Plus className="w-4 h-4" />
              <span>Nieuwe Poule Maken</span>
            </button>
          </div>

          {pools.length === 0 ? (
            <div className="text-center py-12 px-4 bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto">
                <Trophy className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-stone-900 dark:text-white">Nog geen poules</h3>
                <p className="text-xs text-stone-500 max-w-sm mx-auto">
                  Maak een vriendenpoule aan om samen wekelijks de strijd aan te gaan wie de meeste nieuwe woorden leert!
                </p>
              </div>
              <button
                onClick={() => {
                  setSelectedFriendsForPool(followingUsers.map(u => u.email));
                  setIsCreatePoolOpen(true);
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-extrabold shadow-sm cursor-pointer transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Nieuwe Poule Maken</span>
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {pools.map((pool) => {
                const foldMode = getFoldMode(pool.id);

                const topMembers = pool.members.slice(0, 3);
                const first = topMembers[0];
                const second = topMembers[1];
                const third = topMembers[2];
                const hasMembers = pool.members.length > 0;
                
                // Fold mode rules specified by user:
                // - 'none' (punt omhoog): ALLEEN de titel van de poule (geen podium, geen ranking)
                // - 'top3' (punt naar rechts): ALLEEN het podium
                // - 'all' (punt naar beneden): OOK de gehele ranking
                // Podium is UITSLUITEND zichtbaar op zondagavond tijdens de uitslag (na 20:00).
                // Na zondag (vanaf maandag 00:00 t/m zondag 19:59) is het podium weg en is de poule een actieve race.
                const isPodiumVisible = pouleTimeInfo.isSundayEvening && hasMembers && Boolean(first) && foldMode !== 'none';
                const isRankingVisible = foldMode === 'all';

                return (
                  <div 
                    key={pool.id} 
                    id={`pool-card-${pool.id}`}
                    className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800 overflow-hidden shadow-sm transition-all"
                  >
                    {/* Poule Header Banner */}
                    <div 
                      id={`active-pool-header-banner-${pool.id}`}
                      className={`px-5 py-4 bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-transparent flex items-center justify-between flex-wrap gap-3 ${
                        (isPodiumVisible || isRankingVisible) ? 'border-b border-stone-200 dark:border-stone-800' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-amber-500 text-stone-950 flex items-center justify-center font-bold shadow-xs shrink-0">
                          <Trophy className="w-5 h-5 text-stone-950" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-lg sm:text-xl font-black text-stone-900 dark:text-stone-100 leading-tight truncate">
                            {pool.name}
                          </h3>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Fold toggle button: 
                            - Zondagavond: 
                              - punt naar rechts (rotate-0): alleen het podium
                              - punt naar beneden (rotate-90): podium + gehele ranking
                              - punt omhoog (-rotate-90): alleen titel
                            - Doordeweeks (na zondag, podium weg):
                              - punt naar beneden (rotate-90): gehele ranking
                              - punt omhoog (-rotate-90): alleen titel
                        */}
                        <button
                          type="button"
                          id={`poule-fold-toggle-btn-${pool.id}`}
                          onClick={() => handleToggleFold(pool.id)}
                          className="p-2 rounded-xl text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 border border-stone-200 dark:border-stone-750 transition-colors cursor-pointer flex items-center justify-center"
                          title={
                            pouleTimeInfo.isSundayEvening
                              ? (foldMode === 'all'
                                  ? 'Gehele ranking (klik voor alleen titel)'
                                  : foldMode === 'top3'
                                    ? 'Alleen podium (klik voor gehele ranking)'
                                    : 'Alleen titel (klik voor alleen podium)')
                              : (foldMode === 'all'
                                  ? 'Ranking inklappen (alleen titel)'
                                  : 'Ranking uitklappen')
                          }
                          aria-label="Vouw poule in of uit"
                        >
                          <ChevronRight 
                            className={`w-4 h-4 text-stone-700 dark:text-stone-200 transition-transform duration-200 ${
                              foldMode === 'all'
                                ? 'rotate-90'        /* punt naar beneden: gehele ranking */
                                : (pouleTimeInfo.isSundayEvening && foldMode === 'top3')
                                  ? 'rotate-0'       /* punt naar rechts: alleen het podium (zondagavond) */
                                  : '-rotate-90'     /* punt omhoog: alleen de titel */
                            }`} 
                          />
                        </button>

                        {/* Three vertical dots button */}
                        <button
                          type="button"
                          id={`poule-quick-actions-btn-${pool.id}`}
                          onClick={() => {
                            setSelectedPoolId(pool.id);
                            setIsPoolMenuOpen(true);
                          }}
                          className="p-2 rounded-xl text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 border border-stone-200 dark:border-stone-750 transition-colors cursor-pointer"
                          title="Poule Opties"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* SUNDAY EVENING / PREVIEW: TYPICAL STAGE WITH TOP 3 (COMPACT PODIUM) */}
                    {isPodiumVisible && hasMembers && first && (
                      <div 
                        id={`pool-${pool.id}-sunday-podium`}
                        className="px-3 pt-4 pb-1 bg-gradient-to-b from-amber-500/10 via-amber-500/5 to-transparent border-b border-stone-200 dark:border-stone-800 animate-fade-in"
                      >
                        {/* Winner Congratulations Header */}
                        <div className="text-center space-y-0.5 mb-3">
                          <h3 className="text-base sm:text-lg font-black text-stone-900 dark:text-white tracking-tight">
                            {profile.knownLanguage === 'nl'
                              ? `Gefeliciteerd ${first.name}! 🎉`
                              : `Congrats ${first.name}! 🎉`}
                          </h3>
                          <p className="text-xs text-stone-500 dark:text-stone-400">
                            {profile.knownLanguage === 'nl'
                              ? 'Maandag begint de poule weer opnieuw'
                              : 'The pool starts again on Monday'}
                          </p>
                        </div>

                        {/* Stage with 1st in the middle on top, 2nd on left side and 3rd on right side one step lower */}
                        <div className="flex items-end justify-center gap-1.5 sm:gap-2.5 pt-2 pb-0 max-w-xs sm:max-w-sm mx-auto">
                          {/* 2nd place (Left side - one step lower) */}
                          {second ? (
                            <div 
                              onClick={() => handleOpenPoolMember(second)}
                              className="flex-1 flex flex-col items-center cursor-pointer group transition-all"
                            >
                              <div className="relative mb-1 flex flex-col items-center">
                                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl overflow-hidden ring-2 ring-slate-300 dark:ring-stone-600 bg-slate-100 text-stone-800 font-bold flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                                  {second.avatarUrl ? (
                                    <img src={second.avatarUrl} alt={second.name} className="w-full h-full object-cover" />
                                  ) : (
                                    <span className="text-xs sm:text-sm">{(second.name || '2').charAt(0).toUpperCase()}</span>
                                  )}
                                </div>
                                <span className="absolute -bottom-1.5 px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-stone-700 text-slate-700 dark:text-slate-200 font-black text-[9px] shadow-2xs border border-slate-300 dark:border-stone-600">
                                  🥈 2
                                </span>
                              </div>
                              <p className="text-[11px] sm:text-xs font-semibold text-stone-900 dark:text-white truncate max-w-[70px] sm:max-w-[85px] text-center mt-1">
                                {second.name}
                              </p>
                              <button
                                type="button"
                                onClick={(e) => handleOpenWeeklyWords(second, e)}
                                className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline px-1.5 py-0.5 rounded-md hover:bg-emerald-500/15 transition-all cursor-pointer"
                                title={profile.knownLanguage === 'nl' ? `Bekijk geleerde woorden van ${second.name}` : `View learned words of ${second.name}`}
                              >
                                +{second.weeklyNewWordsCount || 0} w.
                              </button>

                              {/* Pedestal 2 */}
                              <div className="w-full mt-1.5 h-12 sm:h-14 rounded-t-xl bg-gradient-to-t from-slate-300 via-slate-200 to-slate-100 dark:from-stone-855 dark:via-stone-800 dark:to-stone-700 border-t border-x border-slate-300 dark:border-stone-600 flex flex-col items-center justify-center shadow-inner">
                                <span className="text-xl sm:text-2xl font-black text-slate-500/50 dark:text-stone-500/50 select-none">
                                  2
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div className="flex-1" />
                          )}

                          {/* 1st place (Middle - On Top & Highest Step) */}
                          <div 
                            onClick={() => handleOpenPoolMember(first)}
                            className="flex-1 flex flex-col items-center cursor-pointer group z-10 -mt-3 transition-all"
                          >
                            <div className="relative mb-1 flex flex-col items-center">
                              {/* Animated Crown on Top */}
                              <span className="text-lg sm:text-xl -mb-0.5 animate-bounce duration-1000 select-none" role="img" aria-label="crown">
                                👑
                              </span>
                              <div className="w-13 h-13 sm:w-15 sm:h-15 rounded-xl overflow-hidden ring-2 ring-amber-400 bg-amber-100 text-amber-900 font-bold flex items-center justify-center shadow-md shadow-amber-500/20 group-hover:scale-105 transition-transform">
                                {first.avatarUrl ? (
                                  <img src={first.avatarUrl} alt={first.name} className="w-full h-full object-cover" />
                                ) : (
                                  <span className="text-sm sm:text-base">{(first.name || '1').charAt(0).toUpperCase()}</span>
                                )}
                              </div>
                              <span className="absolute -bottom-1.5 px-2 py-0.2 rounded-full bg-amber-500 text-stone-950 font-black text-[10px] shadow-xs border border-amber-300">
                                🥇 1
                              </span>
                            </div>
                            <p className="text-xs sm:text-sm font-black text-stone-900 dark:text-white truncate max-w-[85px] sm:max-w-[100px] text-center mt-1">
                              {first.name}
                            </p>
                            <button
                              type="button"
                              onClick={(e) => handleOpenWeeklyWords(first, e)}
                              className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 hover:underline px-2 py-0.5 rounded-md hover:bg-emerald-500/15 transition-all cursor-pointer"
                              title={profile.knownLanguage === 'nl' ? `Bekijk geleerde woorden van ${first.name}` : `View learned words of ${first.name}`}
                            >
                              +{first.weeklyNewWordsCount || 0} w.
                            </button>

                            {/* Pedestal 1 (Highest Step) */}
                            <div className="w-full mt-1.5 h-18 sm:h-22 rounded-t-xl bg-gradient-to-t from-amber-500 via-amber-400 to-amber-300 text-stone-950 border-t border-x border-amber-300 flex flex-col items-center justify-center shadow-md relative overflow-hidden">
                              <div className="absolute inset-0 bg-radial from-white/30 to-transparent pointer-events-none" />
                              <span className="text-2xl sm:text-3xl font-black text-amber-950/40 select-none relative z-10">
                                1
                              </span>
                            </div>
                          </div>

                          {/* 3rd place (Right side - one step lower) */}
                          {third ? (
                            <div 
                              onClick={() => handleOpenPoolMember(third)}
                              className="flex-1 flex flex-col items-center cursor-pointer group transition-all"
                            >
                              <div className="relative mb-1 flex flex-col items-center">
                                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl overflow-hidden ring-2 ring-amber-700/60 dark:ring-stone-600 bg-amber-50 text-stone-800 font-bold flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                                  {third.avatarUrl ? (
                                    <img src={third.avatarUrl} alt={third.name} className="w-full h-full object-cover" />
                                  ) : (
                                    <span className="text-xs sm:text-sm">{(third.name || '3').charAt(0).toUpperCase()}</span>
                                  )}
                                </div>
                                <span className="absolute -bottom-1.5 px-1.5 py-0.2 rounded-full bg-amber-700 text-amber-100 font-black text-[9px] shadow-2xs border border-amber-600">
                                  🥉 3
                                </span>
                              </div>
                              <p className="text-[11px] sm:text-xs font-semibold text-stone-900 dark:text-white truncate max-w-[70px] sm:max-w-[85px] text-center mt-1">
                                {third.name}
                              </p>
                              <button
                                type="button"
                                onClick={(e) => handleOpenWeeklyWords(third, e)}
                                className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline px-1.5 py-0.5 rounded-md hover:bg-emerald-500/15 transition-all cursor-pointer"
                                title={profile.knownLanguage === 'nl' ? `Bekijk geleerde woorden van ${third.name}` : `View learned words of ${third.name}`}
                              >
                                +{third.weeklyNewWordsCount || 0} w.
                              </button>

                              {/* Pedestal 3 */}
                              <div className="w-full mt-1.5 h-9 sm:h-11 rounded-t-xl bg-gradient-to-t from-amber-800/80 to-amber-700/80 dark:from-stone-850 dark:to-stone-750 border-t border-x border-amber-700/50 dark:border-stone-700 flex flex-col items-center justify-center shadow-inner">
                                <span className="text-xl sm:text-2xl font-black text-amber-950/40 dark:text-stone-500/50 select-none">
                                  3
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div className="flex-1" />
                          )}
                        </div>
                      </div>
                    )}

                    {/* Members List (only visible when foldMode === 'all') */}
                    {isRankingVisible && (
                      <div className="divide-y divide-stone-100 dark:divide-stone-800/60">
                        {pool.members.map((member, idx) => {
                            const rank = idx + 1;
                            const isUser = member.isCurrentUser;
                            const memberLang = getLanguage(member.targetLanguage || 'he');

                            return (
                              <div
                                key={member.email}
                                id={`pool-${pool.id}-member-row-${rank}`}
                                onClick={() => handleOpenPoolMember(member)}
                                className={`px-4 py-3.5 flex items-center justify-between transition-colors cursor-pointer ${
                                  isUser
                                    ? 'bg-stone-100/70 dark:bg-stone-800/45 hover:bg-stone-100 dark:hover:bg-stone-800 font-semibold'
                                    : 'hover:bg-stone-50 dark:hover:bg-stone-850/50'
                                }`}
                              >
                                {/* Left: Rank & User Info */}
                                <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                                  {/* Rank Icon / Number */}
                                  <div className="w-8 flex items-center justify-center font-black">
                                    {rank === 1 ? (
                                      <div className="w-7 h-7 rounded-full bg-amber-400/20 text-amber-500 flex items-center justify-center text-sm shadow-sm" title="1e Plaats">
                                        🥇
                                      </div>
                                    ) : rank === 2 ? (
                                      <div className="w-7 h-7 rounded-full bg-slate-400/20 text-slate-400 flex items-center justify-center text-sm" title="2e Plaats">
                                        🥈
                                      </div>
                                    ) : rank === 3 ? (
                                      <div className="w-7 h-7 rounded-full bg-amber-700/20 text-amber-700 flex items-center justify-center text-sm" title="3e Plaats">
                                        🥉
                                      </div>
                                    ) : (
                                      <span className="text-stone-400 text-sm font-bold">#{rank}</span>
                                    )}
                                  </div>

                                  {/* Avatar */}
                                  <div className="w-10 h-10 rounded-xl overflow-hidden bg-gradient-to-tr from-amber-500 to-amber-300 text-stone-950 font-bold flex items-center justify-center text-xs shadow-sm flex-shrink-0">
                                    {member.avatarUrl ? (
                                      <img src={member.avatarUrl} alt={member.name} className="w-full h-full object-cover" />
                                    ) : (
                                      <span>{(member.name || member.email).charAt(0).toUpperCase()}</span>
                                    )}
                                  </div>

                                  {/* Name, Level & Language */}
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-bold text-stone-900 dark:text-stone-100 truncate">
                                        {member.name}
                                      </span>
                                      {isUser && (
                                        <span className="px-1.5 py-0.2 rounded text-[10px] font-extrabold bg-amber-500 text-stone-950">
                                          JIJ
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-stone-400">
                                      <span>{memberLang.flag}</span>
                                      <span>•</span>
                                      <span className="text-amber-600 dark:text-amber-400 font-medium">
                                        {member.level} (L{member.numericLevel || 1})
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {/* Right: Streak & Weekly Words Learned */}
                                <div className="flex items-center gap-4 sm:gap-6 flex-shrink-0">
                                  {/* Streak badge */}
                                  <div 
                                    className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/25 text-amber-600 dark:text-amber-400 text-xs font-bold shrink-0 shadow-2xs"
                                    title={`Streak: ${member.streakDays || 0} dagen`}
                                  >
                                    <Flame className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                                    <span className="font-mono">{member.streakDays || 0}d</span>
                                  </div>

                                  {/* Weekly Words Badge */}
                                  <div className="text-right">
                                    <button
                                      type="button"
                                      onClick={(e) => handleOpenWeeklyWords(member, e)}
                                      className="inline-flex items-center px-3 py-1 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/20 hover:border-emerald-500/40 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs sm:text-sm font-black cursor-pointer hover:scale-105 active:scale-95 transition-all shadow-2xs group/btn"
                                      title={profile.knownLanguage === 'nl' ? `Bekijk ${member.weeklyNewWordsCount} geleerde woorden van ${member.name}` : `View ${member.weeklyNewWordsCount} learned words of ${member.name}`}
                                    >
                                      <span>+{member.weeklyNewWordsCount}</span>
                                      <span className="hidden sm:inline font-normal text-xs text-stone-400 ml-1 group-hover/btn:text-emerald-500 transition-colors">woorden</span>
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* --- MODAL: NIEUWE POOL MAKEN --- */}
      {isCreatePoolOpen && (
        <div 
          id="create-pool-modal-backdrop"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
          onClick={() => setIsCreatePoolOpen(false)}
        >
          <div
            id="create-pool-modal-card"
            className="w-full max-w-md bg-stone-900 border border-stone-800 text-stone-100 rounded-2xl shadow-2xl p-6 animate-scale-up space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-stone-800">
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-500" />
                <h3 className="text-base font-bold text-white">Nieuwe Poule</h3>
              </div>
              <button
                onClick={() => setIsCreatePoolOpen(false)}
                className="text-stone-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-300 mb-1">
                  Naam van de poule
                </label>
                <input
                  type="text"
                  value={newPoolName}
                  onChange={(e) => setNewPoolName(e.target.value)}
                  placeholder="Bijv. Poule 2, Woorden Race 🏆"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-stone-800 border border-stone-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-300 mb-2">
                  Kies vrienden om uit te nodigen ({selectedFriendsForPool.length} geselecteerd)
                </label>
                <div className="max-h-48 overflow-y-auto space-y-1.5 p-2 rounded-xl bg-stone-850 border border-stone-800">
                  {(() => {
                    const friendMap = new Map<string, PublicUserProfile>();
                    followingUsers.forEach(u => friendMap.set(u.email.toLowerCase(), u));
                    followersUsers.forEach(u => {
                      if (!friendMap.has(u.email.toLowerCase())) {
                        friendMap.set(u.email.toLowerCase(), u);
                      }
                    });
                    searchResults.forEach(u => {
                      if (!friendMap.has(u.email.toLowerCase())) {
                        friendMap.set(u.email.toLowerCase(), u);
                      }
                    });

                    const allCandidates = Array.from(friendMap.values()).filter(
                      u => u.email.toLowerCase() !== (profile.email || '').toLowerCase()
                    );

                    if (allCandidates.length === 0) {
                      return (
                        <p className="text-xs text-stone-400 p-3 text-center">
                          Geen vrienden gevonden. Volg eerst andere gebruikers via 'Vrienden zoeken' om ze toe te voegen!
                        </p>
                      );
                    }

                    return allCandidates.map((friend) => {
                      const isSelected = selectedFriendsForPool.includes(friend.email);
                      return (
                        <div
                          key={friend.email}
                          onClick={() => {
                            setSelectedFriendsForPool(prev =>
                              isSelected
                                ? prev.filter(e => e.toLowerCase() !== friend.email.toLowerCase())
                                : [...prev, friend.email]
                            );
                          }}
                          className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                            isSelected ? 'bg-amber-500/20 text-white' : 'hover:bg-stone-800 text-stone-300'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-6 h-6 rounded-md bg-stone-700 flex items-center justify-center text-[10px] font-bold shrink-0">
                              {(friend.name || friend.email).charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <span className="text-xs font-medium block truncate">{friend.name}</span>
                              <span className="text-[10px] text-stone-400 block truncate">@{friend.username || friend.email.split('@')[0]}</span>
                            </div>
                          </div>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            className="rounded text-amber-500 focus:ring-0 shrink-0"
                          />
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            </div>

            <div className="pt-2 flex items-center gap-3">
              <button
                onClick={() => setIsCreatePoolOpen(false)}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold text-stone-300 bg-stone-800 hover:bg-stone-700 transition-colors"
              >
                Annuleren
              </button>
              <button
                id="create-pool-submit-btn"
                onClick={handleCreatePool}
                disabled={!newPoolName.trim() || isCreatingPool}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold text-stone-950 bg-amber-500 hover:bg-amber-400 transition-colors shadow-sm ${
                  !newPoolName.trim() || isCreatingPool ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
                }`}
              >
                {isCreatingPool ? 'Aanmaken...' : 'Poule Starten'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL / MENU: POULE OPTIES (Verlaat poule, Voeg iemand toe, Verwijder deze poule) --- */}
      {isPoolMenuOpen && currentPool && (
        <div 
          id="pool-options-modal-backdrop"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
          onClick={() => setIsPoolMenuOpen(false)}
        >
          <div
            id="pool-options-modal-card"
            className="w-full max-w-sm bg-stone-900 border border-stone-800 text-stone-100 rounded-2xl shadow-2xl p-5 animate-scale-up space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-stone-800">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-amber-500 text-stone-950 flex items-center justify-center font-bold shrink-0">
                  <Trophy className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-white truncate">{currentPool.name}</h3>
                </div>
              </div>
              <button
                onClick={() => setIsPoolMenuOpen(false)}
                className="text-stone-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2">
              {/* Option 1: Toevoegen */}
              <button
                id="pool-action-add-member-btn"
                onClick={() => {
                  setIsPoolMenuOpen(false);
                  setIsAddMemberModalOpen(true);
                }}
                className="w-full flex items-center gap-3 p-3 rounded-xl bg-stone-800 hover:bg-stone-750 text-stone-100 hover:text-white transition-colors cursor-pointer text-left font-bold text-sm group"
              >
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <UserPlus className="w-4 h-4" />
                </div>
                <span>Toevoegen</span>
              </button>

              {/* Option 2: Poule verlaten */}
              <button
                id="pool-action-leave-btn"
                onClick={() => handleLeavePool(currentPool.id)}
                className="w-full flex items-center gap-3 p-3 rounded-xl bg-stone-800 hover:bg-stone-750 text-amber-300 hover:text-amber-200 transition-colors cursor-pointer text-left font-bold text-sm group"
              >
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <LogOut className="w-4 h-4" />
                </div>
                <span>Poule verlaten</span>
              </button>

              {/* Option 3: Poule verwijderen */}
              <button
                id="pool-action-delete-btn"
                onClick={() => handleDeletePool(currentPool.id)}
                className="w-full flex items-center gap-3 p-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 hover:text-rose-200 border border-rose-500/20 transition-colors cursor-pointer text-left font-bold text-sm group"
              >
                <div className="w-8 h-8 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <Trash2 className="w-4 h-4" />
                </div>
                <span>Poule verwijderen</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL: VOEG IEMAND TOE AAN HUIDIGE POULE --- */}
      {isAddMemberModalOpen && currentPool && (
        <div 
          id="add-member-to-pool-modal-backdrop"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
          onClick={() => setIsAddMemberModalOpen(false)}
        >
          <div
            id="add-member-to-pool-modal-card"
            className="w-full max-w-md bg-stone-900 border border-stone-800 text-stone-100 rounded-2xl shadow-2xl p-6 animate-scale-up space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-stone-800">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="text-base font-bold text-white">Voeg iemand toe</h3>
                  <span className="text-[11px] text-stone-400">Aan poule: {currentPool.name}</span>
                </div>
              </div>
              <button
                onClick={() => setIsAddMemberModalOpen(false)}
                className="text-stone-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-300 mb-2">
                  Selecteer vrienden ({selectedFriendsToAdd.length} geselecteerd)
                </label>
                <div className="max-h-56 overflow-y-auto space-y-1.5 p-2 rounded-xl bg-stone-850 border border-stone-800">
                  {(() => {
                    const currentMemberSet = new Set<string>((currentPool.members || []).map(m => m.email.toLowerCase()));
                    const friendMap = new Map<string, PublicUserProfile>();
                    followingUsers.forEach(u => friendMap.set(u.email.toLowerCase(), u));
                    followersUsers.forEach(u => {
                      if (!friendMap.has(u.email.toLowerCase())) {
                        friendMap.set(u.email.toLowerCase(), u);
                      }
                    });
                    searchResults.forEach(u => {
                      if (!friendMap.has(u.email.toLowerCase())) {
                        friendMap.set(u.email.toLowerCase(), u);
                      }
                    });

                    const nonMembers = Array.from(friendMap.values()).filter(
                      u => !currentMemberSet.has(u.email.toLowerCase()) && u.email.toLowerCase() !== (profile.email || '').toLowerCase()
                    );

                    if (nonMembers.length === 0) {
                      return (
                        <p className="text-xs text-stone-400 p-4 text-center">
                          Alle bekende vrienden zitten al in deze poule! Zoek eerst nieuwe vrienden via 'Vrienden zoeken'.
                        </p>
                      );
                    }

                    return nonMembers.map((friend) => {
                      const isSelected = selectedFriendsToAdd.includes(friend.email);
                      return (
                        <div
                          key={friend.email}
                          onClick={() => {
                            setSelectedFriendsToAdd(prev =>
                              isSelected
                                ? prev.filter(e => e.toLowerCase() !== friend.email.toLowerCase())
                                : [...prev, friend.email]
                            );
                          }}
                          className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                            isSelected ? 'bg-amber-500/20 text-white' : 'hover:bg-stone-800 text-stone-300'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-6 h-6 rounded-md bg-stone-700 flex items-center justify-center text-[10px] font-bold shrink-0">
                              {(friend.name || friend.email).charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <span className="text-xs font-medium block truncate">{friend.name}</span>
                              <span className="text-[10px] text-stone-400 block truncate">@{friend.username || friend.email.split('@')[0]}</span>
                            </div>
                          </div>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            className="rounded text-amber-500 focus:ring-0 shrink-0"
                          />
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            </div>

            <div className="pt-2 flex items-center gap-3">
              <button
                onClick={() => setIsAddMemberModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold text-stone-300 bg-stone-800 hover:bg-stone-700 transition-colors"
              >
                Annuleren
              </button>
              <button
                id="add-member-submit-btn"
                onClick={handleAddMembersToCurrentPool}
                disabled={selectedFriendsToAdd.length === 0 || isAddingMembers}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold text-stone-950 bg-amber-500 hover:bg-amber-400 transition-colors shadow-sm ${
                  selectedFriendsToAdd.length === 0 || isAddingMembers ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
                }`}
              >
                {isAddingMembers ? 'Toevoegen...' : 'Toevoegen aan poule'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Profile Modal */}
      <UserProfileModal
        user={selectedUserProfile}
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        onToggleFollow={handleToggleFollow}
        isUpdatingFollow={isUpdatingFollow}
        currentEmail={profile.email}
        onSelectUser={handleOpenUserProfile}
      />

      {/* Weekly Words List Modal */}
      {selectedWeeklyWordsModalData && (
        <WeeklyWordsModal
          isOpen={isWeeklyWordsModalOpen}
          onClose={() => setIsWeeklyWordsModalOpen(false)}
          userName={selectedWeeklyWordsModalData.name}
          userEmail={selectedWeeklyWordsModalData.email}
          avatarUrl={selectedWeeklyWordsModalData.avatarUrl}
          targetLanguage={selectedWeeklyWordsModalData.targetLanguage}
          knownLanguage={profile.knownLanguage}
          words={selectedWeeklyWordsModalData.words}
          count={selectedWeeklyWordsModalData.count}
          isCurrentUser={selectedWeeklyWordsModalData.isCurrentUser}
          isLoading={selectedWeeklyWordsModalData.isLoading}
        />
      )}
    </div>
  );
};
