import { useEffect, useRef, useState, useCallback } from 'react';

const BrowserSpeechRecognition =
  typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);

// Wraps the browser's native Web Speech API. Transcription happens entirely
// client-side (no audio leaves the browser); `onResult` fires with each
// finalized chunk of speech as it's recognized.
export function useSpeechToText(onResult) {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);
  const onResultRef = useRef(onResult);

  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);

  useEffect(() => {
    if (!BrowserSpeechRecognition) return;

    const recognition = new BrowserSpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .slice(event.resultIndex)
        .map((result) => result[0].transcript)
        .join(' ')
        .trim();
      if (transcript) onResultRef.current?.(transcript);
    };
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);

    recognitionRef.current = recognition;
    return () => recognition.stop();
  }, []);

  const toggle = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    if (isListening) {
      recognition.stop();
      setIsListening(false);
    } else {
      recognition.start();
      setIsListening(true);
    }
  }, [isListening]);

  return { isSupported: !!BrowserSpeechRecognition, isListening, toggle };
}
