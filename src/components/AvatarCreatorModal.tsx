import React, { useState } from 'react';
import { CharacterAvatarConfig } from '../types';
import {
  CHARACTER_PRESETS,
  HAIR_STYLES,
  HAIR_COLORS,
  EYE_STYLES,
  EYE_COLORS,
  EYEBROW_STYLES,
  NOSE_STYLES,
  MOUTH_STYLES,
  GLASSES_STYLES,
  GLASSES_COLORS,
  HAT_STYLES,
  HAT_COLORS,
  SKIN_TONES,
  BACKGROUND_COLORS,
  getDefaultAvatarConfig,
  getCharacterAvatarDataUri,
  renderCharacterSvgString,
  renderEyeSampleSvg,
  renderEyebrowSampleSvg,
  renderNoseSampleSvg,
  renderMouthSampleSvg,
  renderHairSampleSvg,
  renderGlassesSampleSvg,
  renderHatSampleSvg,
} from '../utils/characterAvatar';
import { Check, X } from 'lucide-react';

interface AvatarCreatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveAvatar: (avatarUrl: string, config: CharacterAvatarConfig) => void;
  currentConfig?: CharacterAvatarConfig;
  knownLanguage?: string;
}

type TabType = 'character' | 'hair' | 'eyes' | 'nose' | 'mouth' | 'attributes' | 'background';

export const AvatarCreatorModal: React.FC<AvatarCreatorModalProps> = ({
  isOpen,
  onClose,
  onSaveAvatar,
  currentConfig,
  knownLanguage = 'en',
}) => {
  const isNl = knownLanguage === 'nl';

  const [config, setConfig] = useState<CharacterAvatarConfig>(() => {
    return currentConfig || getDefaultAvatarConfig('bear');
  });

  const [activeTab, setActiveTab] = useState<TabType>('character');

  if (!isOpen) return null;

  const handleSelectCharacter = (characterId: string) => {
    const preset = CHARACTER_PRESETS.find(p => p.id === characterId);
    if (!preset) return;
    setConfig(prev => ({
      ...prev,
      characterId,
      skinTone: preset.defaultConfig.skinTone,
    }));
  };

  const handleSave = () => {
    const dataUri = getCharacterAvatarDataUri(config);
    onSaveAvatar(dataUri, config);
    onClose();
  };

  const svgPreview = renderCharacterSvgString(config, 220);

  const tabs: { id: TabType; label: string }[] = [
    { id: 'character', label: 'Character' },
    { id: 'hair', label: 'Hair' },
    { id: 'eyes', label: 'Eyes' },
    { id: 'nose', label: 'Nose' },
    { id: 'mouth', label: 'Mouth' },
    { id: 'attributes', label: 'Attributes' },
    { id: 'background', label: 'Background' },
  ];

  return (
    <div
      id="avatar-creator-backdrop"
      className="fixed inset-0 z-50 bg-stone-950/75 backdrop-blur-sm p-3 sm:p-4 flex items-center justify-center animate-fade-in"
      onClick={onClose}
    >
      <div
        id="avatar-creator-modal"
        className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-stone-900 dark:text-stone-100 animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header: Strictly 'Character development', no subtitle */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200 dark:border-stone-800 shrink-0">
          <h2 className="text-lg font-bold">
            Character development
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Main Body */}
        <div className="flex-1 overflow-y-auto p-5 flex flex-col sm:flex-row gap-6">
          {/* Left Column: Clean Centered Avatar */}
          <div className="sm:w-60 shrink-0 flex flex-col items-center justify-center p-6 rounded-2xl bg-stone-50 dark:bg-stone-850/80 border border-stone-200 dark:border-stone-800">
            <div className="flex items-center justify-center w-full">
              <div
                className="w-40 h-40 sm:w-48 sm:h-48 rounded-full overflow-hidden shadow-xl border-4 border-white dark:border-stone-800 bg-amber-50 dark:bg-stone-900 transition-transform hover:scale-105 flex items-center justify-center"
                dangerouslySetInnerHTML={{ __html: svgPreview }}
              />
            </div>
          </div>

          {/* Right Column: Customization Controls */}
          <div className="flex-1 min-w-0 flex flex-col space-y-4">
            {/* Category Tabs: No icons, no numbers */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-stone-200 dark:border-stone-800 scrollbar-none">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                      isActive
                        ? 'bg-amber-500 text-stone-950 shadow-sm font-bold'
                        : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Tab Contents */}
            <div className="space-y-4 pr-1">
              {/* TAB 1: 6 ANIMAL CHARACTERS + FUR TONE (Sample previews only, no names, no text) */}
              {activeTab === 'character' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    {CHARACTER_PRESETS.map((preset) => {
                      const isSelected = config.characterId === preset.id;
                      const thumbSvg = renderCharacterSvgString(
                        {
                          ...preset.defaultConfig,
                          bgColor: config.bgColor,
                        },
                        80
                      );
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => handleSelectCharacter(preset.id)}
                          className={`p-2.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-center ${
                            isSelected
                              ? 'border-amber-500 bg-amber-500/10 ring-2 ring-amber-500'
                              : 'border-stone-200 dark:border-stone-800 hover:border-stone-300 dark:hover:border-stone-700 bg-stone-50 dark:bg-stone-850 hover:scale-[1.02]'
                          }`}
                        >
                          <div
                            className="w-16 h-16 rounded-full overflow-hidden shadow-sm flex items-center justify-center"
                            dangerouslySetInnerHTML={{ __html: thumbSvg }}
                          />
                        </button>
                      );
                    })}
                  </div>

                  {/* Fur / Skin Tone dots under character */}
                  <div className="pt-2 border-t border-stone-200 dark:border-stone-800">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      {SKIN_TONES.map((t) => {
                        const isSelected = config.skinTone === t.color;
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => setConfig(prev => ({ ...prev, skinTone: t.color }))}
                            className={`w-7 h-7 rounded-full cursor-pointer transition-all flex items-center justify-center border-2 ${
                              isSelected ? 'border-amber-500 scale-110 shadow-sm' : 'border-transparent hover:scale-105'
                            }`}
                            style={{ backgroundColor: t.color }}
                          >
                            {isSelected && <Check className="w-3.5 h-3.5 text-stone-900" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: HAIR (Visual samples, no text) */}
              {activeTab === 'hair' && (
                <div className="space-y-4">
                  <div>
                    <div className="grid grid-cols-4 gap-2.5">
                      {HAIR_STYLES.map((style) => {
                        const isSelected = (config.hairStyle || 'bald') === style.id;
                        const sampleSvg = renderHairSampleSvg(style.id, config.hairColor || '#451a03');
                        return (
                          <button
                            key={style.id}
                            type="button"
                            onClick={() => setConfig(prev => ({ ...prev, hairStyle: style.id }))}
                            className={`p-2 rounded-2xl border flex items-center justify-center transition-all cursor-pointer h-16 ${
                              isSelected
                                ? 'border-amber-500 bg-amber-500/10 ring-2 ring-amber-500'
                                : 'border-stone-200 dark:border-stone-800 hover:border-stone-300 dark:hover:border-stone-700 bg-stone-50 dark:bg-stone-850'
                            }`}
                          >
                            <div
                              className="w-12 h-12 flex items-center justify-center"
                              dangerouslySetInnerHTML={{ __html: sampleSvg }}
                            />
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Hair Color Dots: purely visual dots */}
                  {config.hairStyle !== 'bald' && (
                    <div className="pt-2 border-t border-stone-200 dark:border-stone-800">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        {HAIR_COLORS.map((c) => {
                          const isSelected = config.hairColor === c.color;
                          return (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => setConfig(prev => ({ ...prev, hairColor: c.color }))}
                              className={`w-8 h-8 rounded-full cursor-pointer transition-all flex items-center justify-center border-2 ${
                                isSelected ? 'border-amber-500 scale-110 shadow-sm' : 'border-transparent hover:scale-105'
                              }`}
                              style={{ backgroundColor: c.color }}
                            >
                              {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: EYES (Visual samples & color dots, no text) */}
              {activeTab === 'eyes' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-2.5">
                    {EYE_STYLES.map((style) => {
                      const isSelected = (config.eyeStyle || 'sparkle') === style.id;
                      const sampleSvg = renderEyeSampleSvg(style.id, config.eyeColor || '#0284c7');
                      return (
                        <button
                          key={style.id}
                          type="button"
                          onClick={() => setConfig(prev => ({ ...prev, eyeStyle: style.id }))}
                          className={`p-2 rounded-2xl border flex items-center justify-center transition-all cursor-pointer h-14 ${
                            isSelected
                              ? 'border-amber-500 bg-amber-500/10 ring-2 ring-amber-500'
                              : 'border-stone-200 dark:border-stone-800 hover:border-stone-300 dark:hover:border-stone-700 bg-stone-50 dark:bg-stone-850'
                          }`}
                        >
                          <div
                            className="w-12 h-8 flex items-center justify-center"
                            dangerouslySetInnerHTML={{ __html: sampleSvg }}
                          />
                        </button>
                      );
                    })}
                  </div>

                  {/* Eye color dots */}
                  <div className="pt-2 border-t border-stone-200 dark:border-stone-800">
                    <div className="flex items-center gap-2 pt-1 flex-wrap">
                      {EYE_COLORS.map((c) => {
                        const isSelected = config.eyeColor === c.color;
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => setConfig(prev => ({ ...prev, eyeColor: c.color }))}
                            className={`w-6 h-6 rounded-full cursor-pointer transition-all flex items-center justify-center border-2 ${
                              isSelected ? 'border-amber-500 scale-110 shadow-sm' : 'border-transparent hover:scale-105'
                            }`}
                            style={{ backgroundColor: c.color }}
                          >
                            {isSelected && <Check className="w-3 h-3 text-white" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Second option: Eyebrows (visual samples, no text) */}
                  <div className="pt-2 border-t border-stone-200 dark:border-stone-800">
                    <div className="grid grid-cols-3 gap-2.5 pt-1">
                      {EYEBROW_STYLES.map((style) => {
                        const isSelected = (config.eyebrowStyle || 'none') === style.id;
                        const sampleSvg = renderEyebrowSampleSvg(style.id);
                        return (
                          <button
                            key={style.id}
                            type="button"
                            onClick={() => setConfig(prev => ({ ...prev, eyebrowStyle: style.id }))}
                            className={`p-2 rounded-2xl border flex items-center justify-center transition-all cursor-pointer h-12 ${
                              isSelected
                                ? 'border-amber-500 bg-amber-500/10 ring-2 ring-amber-500'
                                : 'border-stone-200 dark:border-stone-800 hover:border-stone-300 dark:hover:border-stone-700 bg-stone-50 dark:bg-stone-850'
                            }`}
                          >
                            <div
                              className="w-12 h-6 flex items-center justify-center"
                              dangerouslySetInnerHTML={{ __html: sampleSvg }}
                            />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: NOSE (Visual samples, no text) */}
              {activeTab === 'nose' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-2.5">
                    {NOSE_STYLES.map((style) => {
                      const isSelected = (config.noseStyle || 'button') === style.id;
                      const sampleSvg = renderNoseSampleSvg(style.id);
                      return (
                        <button
                          key={style.id}
                          type="button"
                          onClick={() => setConfig(prev => ({ ...prev, noseStyle: style.id }))}
                          className={`p-2 rounded-2xl border flex items-center justify-center transition-all cursor-pointer h-14 ${
                            isSelected
                              ? 'border-amber-500 bg-amber-500/10 ring-2 ring-amber-500'
                              : 'border-stone-200 dark:border-stone-800 hover:border-stone-300 dark:hover:border-stone-700 bg-stone-50 dark:bg-stone-850'
                          }`}
                        >
                          <div
                            className="w-10 h-8 flex items-center justify-center"
                            dangerouslySetInnerHTML={{ __html: sampleSvg }}
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB 5: MOUTH (Visual samples, no text) */}
              {activeTab === 'mouth' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-2.5">
                    {MOUTH_STYLES.map((style) => {
                      const isSelected = (config.mouthStyle || 'broad_smile') === style.id;
                      const sampleSvg = renderMouthSampleSvg(style.id);
                      return (
                        <button
                          key={style.id}
                          type="button"
                          onClick={() => setConfig(prev => ({ ...prev, mouthStyle: style.id }))}
                          className={`p-2 rounded-2xl border flex items-center justify-center transition-all cursor-pointer h-14 ${
                            isSelected
                              ? 'border-amber-500 bg-amber-500/10 ring-2 ring-amber-500'
                              : 'border-stone-200 dark:border-stone-800 hover:border-stone-300 dark:hover:border-stone-700 bg-stone-50 dark:bg-stone-850'
                          }`}
                        >
                          <div
                            className="w-11 h-8 flex items-center justify-center"
                            dangerouslySetInnerHTML={{ __html: sampleSvg }}
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB 4: ATTRIBUTES (Hats & Glasses - all visual samples, no text) */}
              {activeTab === 'attributes' && (
                <div className="space-y-4">
                  {/* Hats */}
                  <div className="space-y-2">
                    <div className="grid grid-cols-4 gap-2.5">
                      {HAT_STYLES.map((style) => {
                        const isSelected = (config.hatStyle || 'none') === style.id;
                        const sampleSvg = renderHatSampleSvg(style.id, config.hatColor || '#881337');
                        return (
                          <button
                            key={style.id}
                            type="button"
                            onClick={() => setConfig(prev => ({ ...prev, hatStyle: style.id }))}
                            className={`p-2 rounded-2xl border flex items-center justify-center transition-all cursor-pointer h-14 ${
                              isSelected
                                ? 'border-amber-500 bg-amber-500/10 ring-2 ring-amber-500'
                                : 'border-stone-200 dark:border-stone-800 hover:border-stone-300 dark:hover:border-stone-700 bg-stone-50 dark:bg-stone-850'
                            }`}
                          >
                            <div
                              className="w-12 h-10 flex items-center justify-center"
                              dangerouslySetInnerHTML={{ __html: sampleSvg }}
                            />
                          </button>
                        );
                      })}
                    </div>

                    {/* Hat color dots */}
                    {config.hatStyle && config.hatStyle !== 'none' && (
                      <div className="flex items-center gap-2 pt-1 flex-wrap">
                        {HAT_COLORS.map((c) => {
                          const isSelected = config.hatColor === c.color;
                          return (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => setConfig(prev => ({ ...prev, hatColor: c.color }))}
                              className={`w-6 h-6 rounded-full cursor-pointer transition-all flex items-center justify-center border-2 ${
                                isSelected ? 'border-amber-500 scale-110 shadow-sm' : 'border-transparent hover:scale-105'
                              }`}
                              style={{ backgroundColor: c.color }}
                            >
                              {isSelected && <Check className="w-3 h-3 text-white" />}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Glasses */}
                  <div className="space-y-2 pt-2 border-t border-stone-200 dark:border-stone-800">
                    <div className="grid grid-cols-3 gap-2.5">
                      {GLASSES_STYLES.map((style) => {
                        const isSelected = (config.glassesStyle || 'none') === style.id;
                        const sampleSvg = renderGlassesSampleSvg(style.id, config.glassesColor || '#18181b');
                        return (
                          <button
                            key={style.id}
                            type="button"
                            onClick={() => setConfig(prev => ({ ...prev, glassesStyle: style.id }))}
                            className={`p-2 rounded-2xl border flex items-center justify-center transition-all cursor-pointer h-12 ${
                              isSelected
                                ? 'border-amber-500 bg-amber-500/10 ring-2 ring-amber-500'
                                : 'border-stone-200 dark:border-stone-800 hover:border-stone-300 dark:hover:border-stone-700 bg-stone-50 dark:bg-stone-850'
                            }`}
                          >
                            <div
                              className="w-12 h-8 flex items-center justify-center"
                              dangerouslySetInnerHTML={{ __html: sampleSvg }}
                            />
                          </button>
                        );
                      })}
                    </div>

                    {/* Glasses frame color dots */}
                    {config.glassesStyle && config.glassesStyle !== 'none' && (
                      <div className="flex items-center gap-2 pt-1 flex-wrap">
                        {GLASSES_COLORS.map((c) => {
                          const isSelected = config.glassesColor === c.color;
                          return (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => setConfig(prev => ({ ...prev, glassesColor: c.color }))}
                              className={`w-6 h-6 rounded-full cursor-pointer transition-all flex items-center justify-center border-2 ${
                                isSelected ? 'border-amber-500 scale-110 shadow-sm' : 'border-transparent hover:scale-105'
                              }`}
                              style={{ backgroundColor: c.color }}
                            >
                              {isSelected && <Check className="w-3 h-3 text-white" />}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 5: BACKGROUND (Last tab - purely 6 dots, no text, no color names) */}
              {activeTab === 'background' && (
                <div className="py-6 flex items-center justify-center">
                  <div className="flex items-center gap-4 flex-wrap justify-center">
                    {BACKGROUND_COLORS.map((c) => {
                      const isSelected = config.bgColor === c.color;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setConfig(prev => ({ ...prev, bgColor: c.color }))}
                          className={`w-12 h-12 rounded-full cursor-pointer transition-transform hover:scale-110 flex items-center justify-center shadow-md ${
                            isSelected
                              ? 'ring-4 ring-amber-500 scale-110'
                              : 'hover:ring-2 hover:ring-stone-300'
                          }`}
                          style={{ backgroundColor: c.color }}
                        >
                          {isSelected && <Check className="w-5 h-5 text-white drop-shadow-sm" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-stone-200 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-850/50 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-xl text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-800 transition-colors cursor-pointer"
          >
            {isNl ? 'Annuleren' : 'Cancel'}
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2 text-xs font-bold rounded-xl bg-amber-500 text-stone-950 hover:bg-amber-400 transition-colors cursor-pointer shadow-sm"
          >
            {isNl ? 'Opslaan' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};
