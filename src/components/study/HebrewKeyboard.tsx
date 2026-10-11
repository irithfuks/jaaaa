import React from 'react';

export const HEBREW_LETTERS = [
  'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט', 'י',
  'כ', 'ך', 'ל', 'מ', 'ם', 'נ', 'ן', 'ס', 'ע', 'פ',
  'ף', 'צ', 'ץ', 'ק', 'ר', 'ש', 'ת'
];

interface HebrewKeyboardProps {
  onInsertLetter: (letter: string) => void;
}

export const HebrewKeyboard: React.FC<HebrewKeyboardProps> = ({ onInsertLetter }) => {
  return (
    <div className="p-2.5 rounded-xl bg-stone-100/90 border border-stone-200 text-left animate-in fade-in duration-150">
      <div className="flex flex-wrap justify-center gap-1 max-h-24 overflow-y-auto">
        {HEBREW_LETTERS.map((letter) => (
          <button
            key={letter}
            type="button"
            onClick={() => onInsertLetter(letter)}
            className="w-7 h-7 rounded-lg bg-white hover:bg-amber-100 border border-stone-300 text-stone-900 font-bold text-sm flex items-center justify-center transition-colors cursor-pointer"
          >
            {letter}
          </button>
        ))}
      </div>
    </div>
  );
};
