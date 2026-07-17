import { useRef } from 'react';

const OtpInput = ({ length = 6, value, onChange }) => {
  const inputsRef = useRef([]);

  const handleChange = (e, index) => {
    const val = e.target.value;
    if (val && !/^\d$/.test(val)) return; // only digits

    const newOtp = value.split('');
    newOtp[index] = val;
    onChange(newOtp.join(''));

    // Auto-focus next input
    if (val && index < length - 1) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (e, index) => {
    if (e.key === 'Backspace' && !value[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    onChange(pasted.padEnd(length, ''));
    const lastIndex = Math.min(pasted.length, length) - 1;
    inputsRef.current[lastIndex]?.focus();
  };

  return (
    <div className="otp-container">
      {Array.from({ length }, (_, i) => (
        <input
          key={i}
          ref={(el) => (inputsRef.current[i] = el)}
          type="text"
          inputMode="numeric"
          maxLength={1}
          className="otp-input"
          value={value[i] || ''}
          onChange={(e) => handleChange(e, i)}
          onKeyDown={(e) => handleKeyDown(e, i)}
          onPaste={i === 0 ? handlePaste : undefined}
          autoFocus={i === 0}
          id={`otp-input-${i}`}
        />
      ))}
    </div>
  );
};

export default OtpInput;
