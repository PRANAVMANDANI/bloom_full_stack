import { useRef } from 'react';

/**
 * Six single-digit boxes that behave like one field: typing advances,
 * backspace retreats, and pasting a full code fills every box at once.
 *
 * Controlled: `value` is a string of 0-6 digits; `onChange` gets the new one.
 * Calls `onComplete(code)` the moment the sixth digit lands.
 */
export default function OtpInput({ value, onChange, onComplete, disabled = false, error = false }) {
  const refs = useRef([]);
  const digits = Array.from({ length: 6 }, (_, i) => value[i] || '');

  const commit = (next) => {
    onChange(next);
    if (next.length === 6) onComplete?.(next);
  };

  const handleChange = (i, raw) => {
    const clean = raw.replace(/\D/g, '');
    if (!clean) return;
    // Support pasting/autofill of several digits into any box.
    const next = (value.slice(0, i) + clean).slice(0, 6);
    commit(next);
    const focusIdx = Math.min(next.length, 5);
    refs.current[focusIdx]?.focus();
  };

  const handleKeyDown = (i, e) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      if (digits[i]) {
        commit(value.slice(0, i) + value.slice(i + 1));
      } else if (i > 0) {
        commit(value.slice(0, i - 1));
        refs.current[i - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && i > 0) {
      refs.current[i - 1]?.focus();
    } else if (e.key === 'ArrowRight' && i < 5) {
      refs.current[i + 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    commit(pasted);
    refs.current[Math.min(pasted.length, 5)]?.focus();
  };

  return (
    <div className={`otp-input ${error ? 'otp-error' : ''}`} onPaste={handlePaste}>
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          className={`otp-box ${digit ? 'filled' : ''}`}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={6}
          value={digit}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onFocus={(e) => e.target.select()}
          disabled={disabled}
          aria-label={`Digit ${i + 1} of 6`}
          autoFocus={i === 0}
        />
      ))}
    </div>
  );
}
