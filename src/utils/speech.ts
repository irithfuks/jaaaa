export function speakWord(text: string, langCode: string = 'en') {
  if (!('speechSynthesis' in window)) {
    console.warn('Speech synthesis not supported in this browser.');
    return;
  }

  window.speechSynthesis.cancel(); // Stop any active speech

  // Strip vowels/nikud or symbols if needed for raw speech synthesis fallback
  const utterance = new SpeechSynthesisUtterance(text);
  
  // Normalize language tags
  const langMap: Record<string, string> = {
    he: 'he-IL',
    es: 'es-ES',
    fr: 'fr-FR',
    de: 'de-DE',
    it: 'it-IT',
    ja: 'ja-JP',
    ar: 'ar-SA',
    ru: 'ru-RU',
    pt: 'pt-PT',
    nl: 'nl-NL',
    zh: 'zh-CN',
    ko: 'ko-KR',
    el: 'el-GR',
    en: 'en-US',
  };

  const targetLang = langMap[langCode] || langCode;
  utterance.lang = targetLang;
  utterance.rate = 0.85; // Slightly slower for clear vocabulary learning
  utterance.pitch = 1.0;

  // Try to find matching voice
  const voices = window.speechSynthesis.getVoices();
  const matchedVoice = voices.find(v => v.lang === targetLang || v.lang.startsWith(langCode));
  if (matchedVoice) {
    utterance.voice = matchedVoice;
  }

  window.speechSynthesis.speak(utterance);
}
