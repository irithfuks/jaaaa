import React, { useState, useEffect, useMemo } from 'react';
import { TranslationOverrideRecord, TranslationOverrideStats, UserProfile } from '../types';
import { 
  fetchTranslationOverridesFromFirestore, 
  resolveTranslationOverride, 
  recordTranslationOverride 
} from '../lib/firebase';
import { registerCustomApprovedTranslations } from '../utils/translationChecker';
import { matchesSearchText } from '../utils/textNormalization';
import {
  Sparkles,
  Search,
  Filter,
  RefreshCw,
  Plus,
  Check,
  CheckCircle2,
  X,
  Trash2,
  Clock,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Flame,
  Languages,
  BookOpen,
  Send,
  HelpCircle,
  Undo2,
  ExternalLink
} from 'lucide-react';

interface TranslationOverridesDashboardProps {
  currentProfile: UserProfile;
}

export const TranslationOverridesDashboard: React.FC<TranslationOverridesDashboardProps> = ({
  currentProfile,
}) => {
  const [overrides, setOverrides] = useState<TranslationOverrideRecord[]>([]);
  const [stats, setStats] = useState<TranslationOverrideStats>({
    totalOverrides: 0,
    uniqueWords: 0,
    pendingCount: 0,
    resolvedCount: 0,
    languageBreakdown: {},
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [languageFilter, setLanguageFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'resolved' | 'dismissed'>('all');
  const [sortBy, setSortBy] = useState<'count' | 'recent' | 'word'>('count');

  // Custom addition per card
  const [customInputMap, setCustomInputMap] = useState<Record<string, string>>({});
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  // Test Simulation Modal State
  const [showSimulateModal, setShowSimulateModal] = useState<boolean>(false);
  const [simulateTargetWord, setSimulateTargetWord] = useState<string>('חֶשְׁבּוֹן');
  const [simulateExpected, setSimulateExpected] = useState<string>('bill');
  const [simulateUserTyped, setSimulateUserTyped] = useState<string>('receipt');
  const [simulateLanguage, setSimulateLanguage] = useState<string>('he');

  const loadData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch overrides (Firestore with server fallback)
      const list = await fetchTranslationOverridesFromFirestore();
      setOverrides(list);

      // 2. Fetch server summary and approved custom translations
      const res = await fetch('/api/admin/translation-overrides');
      const data = await res.json();
      if (data.success && data.stats) {
        setStats(data.stats);
      } else {
        // Compute stats locally if API returned empty
        let total = 0;
        let pending = 0;
        let resolved = 0;
        const langs: Record<string, number> = {};
        list.forEach(item => {
          total += item.overrideCount || 1;
          const l = item.targetLanguage || 'he';
          langs[l] = (langs[l] || 0) + (item.overrideCount || 1);
          if (item.status === 'resolved') resolved++;
          else if (item.status === 'pending') pending++;
        });
        setStats({
          totalOverrides: total,
          uniqueWords: list.length,
          pendingCount: pending,
          resolvedCount: resolved,
          languageBreakdown: langs,
        });
      }

      // Also register approved custom translations into client checker
      const customRes = await fetch('/api/custom-translations');
      const customData = await customRes.json();
      if (customData.success && customData.translations) {
        registerCustomApprovedTranslations(customData.translations);
      }
    } catch (err) {
      console.error('Failed loading translation overrides:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAction = async (
    overrideId: string,
    action: 'add_translation' | 'mark_resolved' | 'dismiss' | 'reopen' | 'delete',
    addedTranslation?: string
  ) => {
    setProcessingId(overrideId);
    try {
      const ok = await resolveTranslationOverride({
        overrideId,
        action,
        addedTranslation,
        adminEmail: currentProfile.email,
      });

      if (ok) {
        if (action === 'delete') {
          setOverrides(prev => prev.filter(o => o.id !== overrideId));
          setActionNotice({ message: 'Melding succesvol verwijderd.', type: 'info' });
        } else {
          setOverrides(prev =>
            prev.map(o => {
              if (o.id !== overrideId) return o;
              const alts = [...o.currentAlternatives];
              if (action === 'add_translation' && addedTranslation) {
                if (!alts.some(a => a.toLowerCase() === addedTranslation.toLowerCase())) {
                  alts.push(addedTranslation);
                }
              }
              const newStatus =
                action === 'dismiss'
                  ? 'dismissed'
                  : action === 'reopen'
                  ? 'pending'
                  : 'resolved';
              return {
                ...o,
                status: newStatus,
                currentAlternatives: alts,
                resolvedTranslation: action === 'add_translation' ? addedTranslation : o.resolvedTranslation,
                resolvedAt: newStatus === 'resolved' ? Date.now() : undefined,
                resolvedBy: newStatus === 'resolved' ? currentProfile.email : undefined,
              };
            })
          );

          if (action === 'add_translation') {
            setActionNotice({
              message: `Vertaling "${addedTranslation}" is goedgekeurd en toegevoegd aan het woordenboek!`,
              type: 'success',
            });
            // Update local checker
            const currentItem = overrides.find(o => o.id === overrideId);
            if (currentItem && addedTranslation) {
              registerCustomApprovedTranslations({
                [currentItem.targetWord]: [addedTranslation],
                [currentItem.cleanTargetWord]: [addedTranslation],
              });
            }
          } else if (action === 'mark_resolved') {
            setActionNotice({ message: 'Gemarkeerd als opgelost.', type: 'success' });
          } else if (action === 'dismiss') {
            setActionNotice({ message: 'Melding genegeerd.', type: 'info' });
          } else if (action === 'reopen') {
            setActionNotice({ message: 'Melding heropend naar te beoordelen.', type: 'info' });
          }
        }
        // Refresh server stats in background
        loadData();
      } else {
        setActionNotice({ message: 'Fout bij verwerken van actie.', type: 'error' });
      }
    } catch (e) {
      console.error('Error applying action:', e);
      setActionNotice({ message: 'Onverwachte fout opgetreden.', type: 'error' });
    } finally {
      setProcessingId(null);
      setTimeout(() => setActionNotice(null), 4000);
    }
  };

  const handleAddCustomTranslation = (overrideId: string) => {
    const text = (customInputMap[overrideId] || '').trim();
    if (!text) return;
    handleAction(overrideId, 'add_translation', text);
    setCustomInputMap(prev => ({ ...prev, [overrideId]: '' }));
  };

  const handleSimulateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!simulateTargetWord.trim() || !simulateExpected.trim() || !simulateUserTyped.trim()) return;

    setIsLoading(true);
    try {
      await recordTranslationOverride({
        targetWord: simulateTargetWord.trim(),
        targetLanguage: simulateLanguage.toLowerCase().trim(),
        expectedTranslation: simulateExpected.trim(),
        userTyped: simulateUserTyped.trim(),
        sessionType: 'simulation_test',
        userEmail: currentProfile.email,
        level: 'A1',
      });
      setShowSimulateModal(false);
      setActionNotice({
        message: `Test overrule geregistreerd voor "${simulateTargetWord}" met invoer "${simulateUserTyped}".`,
        type: 'success',
      });
      await loadData();
    } catch (err) {
      console.error('Simulation error:', err);
      setActionNotice({ message: 'Kon testoverrule niet simuleren.', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  // Filter and sort items
  const filteredOverrides = useMemo(() => {
    return overrides.filter(item => {
      // Language filter
      if (languageFilter !== 'all' && item.targetLanguage !== languageFilter) {
        return false;
      }
      // Status filter
      if (statusFilter !== 'all' && item.status !== statusFilter) {
        return false;
      }
      // Search query (handles Hebrew nikud, Arabic harakat, Farsi vowels, phonetics, translations)
      if (searchQuery.trim()) {
        const q = searchQuery.trim();
        const matchesWord = matchesSearchText(item.targetWord, q) || matchesSearchText(item.cleanTargetWord, q);
        const matchesExpected = matchesSearchText(item.expectedTranslation, q);
        const matchesAlts = item.currentAlternatives.some(a => matchesSearchText(a, q));
        const matchesAnswers = item.typedAnswers.some(a => matchesSearchText(a.text, q));
        if (!matchesWord && !matchesExpected && !matchesAlts && !matchesAnswers) {
          return false;
        }
      }
      return true;
    }).sort((a, b) => {
      if (sortBy === 'count') {
        return (b.overrideCount || 0) - (a.overrideCount || 0);
      }
      if (sortBy === 'recent') {
        return (b.lastReportedAt || 0) - (a.lastReportedAt || 0);
      }
      if (sortBy === 'word') {
        return a.targetWord.localeCompare(b.targetWord);
      }
      return 0;
    });
  }, [overrides, languageFilter, statusFilter, searchQuery, sortBy]);

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

  const formatRelativeTime = (timestamp?: number) => {
    if (!timestamp) return 'Onbekend';
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

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Informative Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-stone-900 via-stone-850 to-stone-900 border border-stone-800 text-stone-100 p-6 sm:p-8 shadow-xl">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Woordenboek Feedback & Firebase
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              'I was correct' Overrules & Extra Vertalingen
            </h2>
            <p className="text-xs sm:text-sm text-stone-400 mt-2 leading-relaxed">
              Wanneer leerlingen tijdens een overhoring of niveautest op <strong className="text-stone-200">'I was correct'</strong> klikken, wordt hun ingetypt antwoord automatisch bijgehouden in Firebase. Hiermee ontdek je welke vertalingen ontbreken (zoals <em>"receipt"</em> voor <em>"חֶשְׁבּוֹן"</em>) en voeg je ze met één klik toe.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              id="btn-simulate-override"
              type="button"
              onClick={() => setShowSimulateModal(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs transition-all shadow-md shadow-amber-500/20 active:scale-95 cursor-pointer"
              title="Simuleer een overrule van een woord om het dashboard te testen"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Simuleer Melding</span>
            </button>
            <button
              id="btn-refresh-overrides"
              type="button"
              onClick={loadData}
              disabled={isLoading}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-stone-800 hover:bg-stone-750 text-stone-200 border border-stone-700 text-xs font-semibold transition-all cursor-pointer shadow-sm active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-amber-400' : ''}`} />
              <span>Vernieuwen</span>
            </button>
          </div>
        </div>

        {/* Action Notice Alert */}
        {actionNotice && (
          <div
            className={`mt-4 p-3.5 rounded-2xl text-xs font-semibold flex items-center justify-between transition-all ${
              actionNotice.type === 'success'
                ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
                : actionNotice.type === 'error'
                ? 'bg-rose-500/20 border border-rose-500/40 text-rose-300'
                : 'bg-amber-500/20 border border-amber-500/40 text-amber-300'
            }`}
          >
            <span>{actionNotice.message}</span>
            <button
              onClick={() => setActionNotice(null)}
              className="text-stone-400 hover:text-white cursor-pointer ml-3"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Aggregated Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-6 pt-6 border-t border-stone-800/80">
          <div className="p-3.5 sm:p-4 rounded-2xl bg-stone-850/80 border border-stone-800 flex flex-col justify-between">
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-2">
              <Flame className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <span className="text-xl sm:text-3xl font-black text-white block leading-none">
                {stats.totalOverrides}
              </span>
              <span className="text-[11px] sm:text-xs font-semibold text-stone-400 block mt-1.5 truncate">
                Totaal overrules
              </span>
            </div>
          </div>

          <div className="p-3.5 sm:p-4 rounded-2xl bg-stone-850/80 border border-stone-800 flex flex-col justify-between">
            <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-2">
              <BookOpen className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <span className="text-xl sm:text-3xl font-black text-white block leading-none">
                {stats.uniqueWords}
              </span>
              <span className="text-[11px] sm:text-xs font-semibold text-stone-400 block mt-1.5 truncate">
                Unieke woorden
              </span>
            </div>
          </div>

          <div className="p-3.5 sm:p-4 rounded-2xl bg-stone-850/80 border border-stone-800 flex flex-col justify-between">
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-2">
              <Clock className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <span className="text-xl sm:text-3xl font-black text-amber-400 block leading-none">
                {stats.pendingCount}
              </span>
              <span className="text-[11px] sm:text-xs font-semibold text-stone-400 block mt-1.5 truncate">
                Te beoordelen
              </span>
            </div>
          </div>

          <div className="p-3.5 sm:p-4 rounded-2xl bg-stone-850/80 border border-stone-800 flex flex-col justify-between">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <span className="text-xl sm:text-3xl font-black text-emerald-400 block leading-none">
                {stats.resolvedCount}
              </span>
              <span className="text-[11px] sm:text-xs font-semibold text-stone-400 block mt-1.5 truncate">
                Toegevoegd / Opgelost
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Control Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white dark:bg-stone-900 p-4 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            id="input-search-overrides"
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Zoek op doelwoord, ingetypt antwoord (bijv. 'receipt'), of vertaling..."
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-stone-50 dark:bg-stone-850 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Language selector */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            id="select-override-language"
            value={languageFilter}
            onChange={e => setLanguageFilter(e.target.value)}
            className="text-xs px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-850 border border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-200 font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="all">Alle talen</option>
            <option value="he">🇮🇱 Hebreeuws</option>
            <option value="es">🇪🇸 Spaans</option>
            <option value="fr">🇫🇷 Frans</option>
            <option value="de">🇩🇪 Duits</option>
            <option value="it">🇮🇹 Italiaans</option>
            <option value="nl">🇳🇱 Nederlands</option>
            <option value="ar">🇸🇦 Arabisch</option>
          </select>

          {/* Status selector */}
          <select
            id="select-override-status"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as any)}
            className="text-xs px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-850 border border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-200 font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="all">Alle statussen</option>
            <option value="pending">⏳ Te beoordelen (Open)</option>
            <option value="resolved">✅ Opgelost (Toegevoegd)</option>
            <option value="dismissed">⚪ Genegeerd</option>
          </select>

          {/* Sort selector */}
          <select
            id="select-override-sort"
            value={sortBy}
            onChange={e => setSortBy(e.target.value as any)}
            className="text-xs px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-850 border border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-200 font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="count">Meeste overrules eerst (Prioriteit)</option>
            <option value="recent">Meest recent gemeld</option>
            <option value="word">Alfabetisch op woord</option>
          </select>
        </div>
      </div>

      {/* Main List of Overrides */}
      {isLoading ? (
        <div className="py-20 text-center space-y-3 bg-white dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800">
          <RefreshCw className="w-8 h-8 text-amber-500 animate-spin mx-auto" />
          <p className="text-sm font-semibold text-stone-600 dark:text-stone-300">
            Woordvertalingen en feedback ophalen uit Firebase...
          </p>
        </div>
      ) : filteredOverrides.length === 0 ? (
        <div className="py-16 text-center space-y-3 bg-white dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800 p-8">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-stone-800 dark:text-stone-200">
            Geen overrules gevonden voor deze selectie
          </h3>
          <p className="text-xs text-stone-500 dark:text-stone-400 max-w-md mx-auto">
            Er zijn nog geen 'I was correct' overrules gemeld voor deze filters, of alle meldingen zijn reeds verwerkt.
          </p>
          <div className="pt-2">
            <button
              onClick={() => setShowSimulateModal(true)}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs shadow-sm cursor-pointer"
            >
              Simuleer Melding (bijv. 'חשבון' ➔ 'receipt')
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="text-xs text-stone-500 dark:text-stone-400 font-semibold px-1 flex items-center justify-between">
            <span>{filteredOverrides.length} woord(en) gevonden</span>
            <span>Gesorteerd op {sortBy === 'count' ? 'aantal overrules' : sortBy === 'recent' ? 'meest recent' : 'alfabet'}</span>
          </div>

          {filteredOverrides.map(item => {
            const isHebrew = item.targetLanguage === 'he';
            const isExpanded = expandedHistoryId === item.id;
            const isProcessing = processingId === item.id;
            const customVal = customInputMap[item.id] || '';

            return (
              <div
                key={item.id}
                className={`bg-white dark:bg-stone-900 rounded-2xl border transition-all shadow-xs overflow-hidden ${
                  item.status === 'resolved'
                    ? 'border-emerald-200/80 dark:border-emerald-900/40 bg-emerald-50/10'
                    : item.status === 'dismissed'
                    ? 'border-stone-200 dark:border-stone-800 opacity-70'
                    : item.overrideCount >= 3
                    ? 'border-amber-400/80 dark:border-amber-600/60 shadow-amber-500/5'
                    : 'border-stone-200 dark:border-stone-800'
                }`}
              >
                <div className="p-5 sm:p-6 space-y-4">
                  {/* Top Bar: Word, Flags, Count & Status */}
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-xs">
                          {getLanguageFlag(item.targetLanguage)} {getLanguageName(item.targetLanguage)}
                        </span>
                        {item.level && (
                          <span className="px-2 py-0.5 rounded-md bg-stone-100 dark:bg-stone-800 text-[10px] font-bold text-stone-600 dark:text-stone-300">
                            Niveau {item.level}
                          </span>
                        )}
                        <span className="text-[11px] text-stone-400">
                          Laatst gemeld: {formatRelativeTime(item.lastReportedAt)}
                        </span>
                      </div>

                      {/* Prominent Word Heading */}
                      <div className="flex items-baseline gap-3">
                        <h3
                          className={`text-2xl sm:text-3xl font-extrabold text-stone-900 dark:text-white ${
                            isHebrew ? 'font-hebrew' : ''
                          }`}
                          dir={isHebrew ? 'rtl' : 'ltr'}
                        >
                          {item.targetWord}
                        </h3>
                        {item.transliteration && (
                          <span className="text-xs font-mono text-stone-500 dark:text-stone-400">
                            /{item.transliteration}/
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Override Count Flame Badge */}
                      <div
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-black text-xs ${
                          item.overrideCount >= 3
                            ? 'bg-amber-500 text-stone-950 shadow-sm shadow-amber-500/30 animate-pulse'
                            : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300'
                        }`}
                        title="Aantal keren dat een cursist op 'I was correct' klikte voor dit woord"
                      >
                        <Flame className={`w-3.5 h-3.5 ${item.overrideCount >= 3 ? 'text-stone-950 fill-stone-950' : 'text-amber-500'}`} />
                        <span>{item.overrideCount}x 'I was correct'</span>
                      </div>

                      {/* Status Badge */}
                      {item.status === 'resolved' ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-xs font-bold border border-emerald-300/40">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Opgelost</span>
                        </span>
                      ) : item.status === 'dismissed' ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 text-xs font-bold">
                          <span>Genegeerd</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-xs font-bold border border-amber-300/40">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Te beoordelen</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Translations Section */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl bg-stone-50 dark:bg-stone-850/60 border border-stone-200/70 dark:border-stone-800">
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400 block mb-1">
                        Huidige Standaardvertaling
                      </span>
                      <p className="text-base font-bold text-stone-900 dark:text-stone-100">
                        "{item.expectedTranslation}"
                      </p>
                    </div>

                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400 block mb-1">
                        Goedgekeurde Alternatieven
                      </span>
                      {item.currentAlternatives && item.currentAlternatives.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {item.currentAlternatives.map((alt, idx) => (
                            <span
                              key={idx}
                              className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-semibold"
                            >
                              ✓ {alt}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-stone-400 italic">
                          Nog geen extra alternatieven ingesteld.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Learner Typed Answers Section: The Core Feature! */}
                  <div className="space-y-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      <span>Wat leerlingen hebben ingetypt bij 'I was correct':</span>
                    </span>

                    <div className="flex flex-wrap gap-2 pt-0.5">
                      {item.typedAnswers && item.typedAnswers.length > 0 ? (
                        item.typedAnswers.map((answer, aIdx) => {
                          const isAlreadyAdded = item.currentAlternatives.some(
                            alt => alt.toLowerCase() === answer.text.toLowerCase()
                          );

                          return (
                            <div
                              key={aIdx}
                              className={`p-2.5 rounded-xl border flex items-center gap-3 transition-all ${
                                isAlreadyAdded
                                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                                  : 'bg-white dark:bg-stone-850 border-stone-300 dark:border-stone-700 text-stone-900 dark:text-stone-100 shadow-2xs'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm tracking-tight">
                                  "{answer.text}"
                                </span>
                                <span className="px-1.5 py-0.5 rounded-md text-[10px] font-black bg-stone-100 dark:bg-stone-750 text-stone-600 dark:text-stone-300">
                                  {answer.count}x
                                </span>
                              </div>

                              {isAlreadyAdded ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                                  <Check className="w-3 h-3 stroke-[3]" />
                                  <span>Toegevoegd</span>
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  disabled={isProcessing}
                                  onClick={() => handleAction(item.id, 'add_translation', answer.text)}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1 shadow-2xs hover:scale-105 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                                  title={`Voeg "${answer.text}" toe als geaccepteerde vertaling voor ${item.targetWord}`}
                                >
                                  <Plus className="w-3.5 h-3.5 stroke-[3]" />
                                  <span>Accepteer als vertaling</span>
                                </button>
                              )}
                            </div>
                          );
                        })
                      ) : (
                        <p className="text-xs text-stone-400 italic">Geen specifieke tekst opgeslagen.</p>
                      )}
                    </div>
                  </div>

                  {/* Add Custom Translation Row */}
                  <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        value={customVal}
                        onChange={e =>
                          setCustomInputMap(prev => ({ ...prev, [item.id]: e.target.value }))
                        }
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddCustomTranslation(item.id);
                          }
                        }}
                        placeholder="Typ een andere alternatieve vertaling (bijv. synoniem of spreektaal)..."
                        className="w-full px-3.5 py-2 text-xs rounded-xl bg-stone-50 dark:bg-stone-850 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                    <button
                      type="button"
                      disabled={!customVal.trim() || isProcessing}
                      onClick={() => handleAddCustomTranslation(item.id)}
                      className="px-4 py-2 rounded-xl bg-stone-900 dark:bg-stone-100 hover:bg-stone-800 dark:hover:bg-white text-white dark:text-stone-950 font-bold text-xs disabled:opacity-40 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Voeg toe</span>
                    </button>
                  </div>

                  {/* Bottom Action Footer & History Toggle */}
                  <div className="pt-3 border-t border-stone-100 dark:border-stone-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2 flex-wrap">
                      {item.status !== 'resolved' && (
                        <button
                          type="button"
                          disabled={isProcessing}
                          onClick={() => handleAction(item.id, 'mark_resolved')}
                          className="px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-semibold hover:bg-emerald-100 transition-colors cursor-pointer"
                        >
                          Markeer als opgelost
                        </button>
                      )}
                      {item.status !== 'dismissed' && (
                        <button
                          type="button"
                          disabled={isProcessing}
                          onClick={() => handleAction(item.id, 'dismiss')}
                          className="px-3 py-1.5 rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 font-semibold hover:bg-stone-200 transition-colors cursor-pointer"
                        >
                          Negeer melding
                        </button>
                      )}
                      {item.status !== 'pending' && (
                        <button
                          type="button"
                          disabled={isProcessing}
                          onClick={() => handleAction(item.id, 'reopen')}
                          className="px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 font-semibold hover:bg-amber-100 transition-colors cursor-pointer"
                        >
                          Heropenen
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={isProcessing}
                        onClick={() => {
                          if (window.confirm(`Weet je zeker dat je het feedbackdossier voor "${item.targetWord}" wilt verwijderen?`)) {
                            handleAction(item.id, 'delete');
                          }
                        }}
                        className="px-2.5 py-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                        title="Verwijder dit record"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => setExpandedHistoryId(isExpanded ? null : item.id)}
                      className="inline-flex items-center gap-1.5 text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 font-semibold cursor-pointer"
                    >
                      <span>Meldingen geschiedenis ({item.recentLogs?.length || 0})</span>
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Expanded History Logs */}
                  {isExpanded && (
                    <div className="mt-3 p-4 rounded-xl bg-stone-100 dark:bg-stone-850/80 border border-stone-200 dark:border-stone-800 space-y-2 animate-in fade-in duration-150">
                      <h5 className="text-[11px] font-bold uppercase tracking-wider text-stone-400">
                        Recente overhoringen waarin overrule werd gebruikt:
                      </h5>
                      {item.recentLogs && item.recentLogs.length > 0 ? (
                        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                          {item.recentLogs.map((log, lIdx) => (
                            <div
                              key={lIdx}
                              className="text-xs p-2 rounded-lg bg-white dark:bg-stone-900 border border-stone-200/60 dark:border-stone-800 flex items-center justify-between"
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-stone-900 dark:text-stone-100">
                                  "{log.userTyped}"
                                </span>
                                <span className="text-stone-400 text-[11px]">
                                  via {log.sessionType === 'placement_test' ? 'Niveautest' : 'Overhoring'}
                                </span>
                                {log.userEmail && (
                                  <span className="text-[11px] text-stone-500 dark:text-stone-400 font-mono">
                                    ({log.userEmail})
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-stone-400">
                                {formatRelativeTime(log.timestamp)}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-stone-400 italic">Geen gedetailleerde logs.</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Simuleer 'I was correct' Melding (Test tool for Admin) */}
      {showSimulateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                  <Flame className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-stone-900 dark:text-white">
                    Simuleer 'I was correct' Melding
                  </h3>
                  <p className="text-[11px] text-stone-500 dark:text-stone-400">
                    Test direct hoe overrules in Firebase worden bijgehouden
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSimulateModal(false)}
                className="text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSimulateSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-stone-700 dark:text-stone-300 block mb-1">
                  Taal
                </label>
                <select
                  value={simulateLanguage}
                  onChange={e => setSimulateLanguage(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-stone-50 dark:bg-stone-850 border border-stone-200 dark:border-stone-700 font-semibold"
                >
                  <option value="he">🇮🇱 Hebreeuws</option>
                  <option value="es">🇪🇸 Spaans</option>
                  <option value="fr">🇫🇷 Frans</option>
                  <option value="de">🇩🇪 Duits</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-stone-700 dark:text-stone-300 block mb-1">
                  Doelwoord (Target word)
                </label>
                <input
                  type="text"
                  value={simulateTargetWord}
                  onChange={e => setSimulateTargetWord(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-stone-50 dark:bg-stone-850 border border-stone-200 dark:border-stone-700 font-bold text-sm"
                  placeholder="Bijv. חֶשְׁבּוֹן of תכנית"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-stone-700 dark:text-stone-300 block mb-1">
                  Verwachte Standaardvertaling
                </label>
                <input
                  type="text"
                  value={simulateExpected}
                  onChange={e => setSimulateExpected(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-stone-50 dark:bg-stone-850 border border-stone-200 dark:border-stone-700"
                  placeholder="Bijv. bill"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-stone-700 dark:text-stone-300 block mb-1">
                  Wat de leerling intypte (Candidate translation)
                </label>
                <input
                  type="text"
                  value={simulateUserTyped}
                  onChange={e => setSimulateUserTyped(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-stone-50 dark:bg-stone-850 border border-stone-200 dark:border-stone-700 font-semibold text-emerald-600 dark:text-emerald-400"
                  placeholder="Bijv. receipt"
                  required
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowSimulateModal(false)}
                  className="px-4 py-2 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 font-semibold cursor-pointer"
                >
                  Annuleren
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold cursor-pointer transition-all shadow-md shadow-amber-500/20"
                >
                  Registreer Melding
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
