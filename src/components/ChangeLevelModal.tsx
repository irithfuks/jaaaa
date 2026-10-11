import React, { useState } from 'react';
import { CEFRLevel } from '../types';
import { CEFR_LEVELS, getCefrForNumericLevel } from '../data/languages';
import { X, ArrowRight, Lock, ShieldAlert } from 'lucide-react';

interface ChangeLevelModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLevel: CEFRLevel;
  currentNumericLevel?: number;
  maxUnlockedNumericLevel?: number;
  onSelectLevel: (newCefr: CEFRLevel, newNumericLevel: number) => void;
}

export const ChangeLevelModal: React.FC<ChangeLevelModalProps> = ({
  isOpen,
  onClose,
  currentLevel,
  currentNumericLevel = 1,
  maxUnlockedNumericLevel,
  onSelectLevel,
}) => {
  const maxUnlocked = Math.max(1, maxUnlockedNumericLevel ?? currentNumericLevel ?? 1);
  const [selectedNumeric, setSelectedNumeric] = useState<number>(Math.min(currentNumericLevel, maxUnlocked));
  const activeCefr = getCefrForNumericLevel(selectedNumeric);

  if (!isOpen) return null;

  const handleConfirm = () => {
    onSelectLevel(activeCefr, selectedNumeric);
    onClose();
  };

  return (
    <div
      id="change-level-modal-overlay"
      className="fixed inset-0 z-50 bg-stone-950/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        id="change-level-modal"
        className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 border border-stone-200 shadow-2xl space-y-5 relative overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-4 shrink-0 pb-1 border-b border-stone-100">
          <div>
            <h3 className="font-serif text-2xl font-bold text-stone-900">
              Select Your Level
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Huidig niveau: <strong className="text-stone-800 font-mono">Level {currentNumericLevel} ({currentLevel})</strong>
            </p>
          </div>
          <button
            id="close-change-level-modal"
            onClick={onClose}
            className="p-1.5 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* CEFR Bands & Sub-levels */}
        <div className="space-y-3.5 overflow-y-auto pr-1 flex-1 py-1">
          {CEFR_LEVELS.map((lvl) => {
            const isBandActive = activeCefr === lvl.level;
            const { min: minLvl, max: maxLvl } = lvl.numericRange;
            const subLevels = Array.from({ length: maxLvl - minLvl + 1 }, (_, i) => minLvl + i);

            return (
              <div
                key={lvl.level}
                className={`p-4 rounded-2xl border transition-all ${
                  isBandActive
                    ? 'border-amber-400 bg-amber-50/50 shadow-sm ring-1 ring-amber-400/40'
                    : 'border-stone-200 bg-white hover:border-stone-300'
                }`}
              >
                <div className="flex items-center gap-2 mb-2.5">
                  <span className="font-serif text-lg font-bold text-stone-900">
                    {lvl.level}
                  </span>
                  <span className="text-xs font-semibold text-stone-700">
                    • {lvl.title}
                  </span>
                </div>

                {/* Sub-level Buttons (10 numbers per CEFR) */}
                <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5">
                  {subLevels.map((num) => {
                    const isSelectedNum = selectedNumeric === num;
                    const isUnlocked = num <= maxUnlocked;

                    return (
                      <button
                        key={num}
                        id={`level-btn-${num}`}
                        type="button"
                        disabled={!isUnlocked}
                        onClick={() => isUnlocked && setSelectedNumeric(num)}
                        title={
                          isUnlocked
                            ? `Selecteer Level ${num}`
                            : `Voltooi eerst Level ${maxUnlocked} om dit niveau te ontgrendelen, of doe de niveautest.`
                        }
                        className={`h-9 rounded-xl font-mono text-xs font-bold transition-all flex items-center justify-center relative ${
                          !isUnlocked
                            ? 'bg-stone-100/60 text-stone-400 border border-stone-200/50 cursor-not-allowed opacity-60'
                            : isSelectedNum
                              ? 'bg-amber-500 text-stone-950 shadow-md scale-105 ring-2 ring-stone-900 cursor-pointer'
                              : 'bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-200 cursor-pointer'
                        }`}
                      >
                        <span>{num}</span>
                        {!isUnlocked && (
                          <Lock className="w-2.5 h-2.5 absolute top-1 right-1 text-stone-400" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Lock note info */}
        <div className="flex items-center gap-2 text-xs text-stone-500 bg-stone-50 p-2.5 rounded-xl border border-stone-200 shrink-0">
          <ShieldAlert className="w-4 h-4 text-stone-400 shrink-0" />
          <span>
            Binnen een niveau kun je pas door naar het volgende level als je het huidige level hebt voltooid, of via de niveautest.
          </span>
        </div>

        {/* Footer & Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-stone-200 shrink-0">
          <button
            id="cancel-change-level-btn"
            type="button"
            onClick={onClose}
            className="h-10 px-4 rounded-xl text-xs font-semibold text-stone-600 hover:text-stone-900 hover:bg-stone-100 transition-colors cursor-pointer inline-flex items-center justify-center"
          >
            Cancel
          </button>
          <button
            id="apply-change-level-btn"
            type="button"
            onClick={handleConfirm}
            className="h-10 px-6 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs shadow-md shadow-amber-500/20 transition-all inline-flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
          >
            <span>Switch to Level {selectedNumeric}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
