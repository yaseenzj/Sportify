import React, { useRef, useState, useEffect } from 'react';

export default function PinInput({ onComplete, autoFocus = true, resetOnComplete = false }) {
  const [pin, setPin] = useState(['', '', '', '']);
  const [activeIndex, setActiveIndex] = useState(0);
  const [visibleDigits, setVisibleDigits] = useState({});
  const inputRefs = [useRef(), useRef(), useRef(), useRef()];
  const timeoutsRef = useRef({});

  useEffect(() => {
    if (autoFocus && inputRefs[0].current) {
      inputRefs[0].current.focus();
    }
    return () => {
      Object.values(timeoutsRef.current).forEach(clearTimeout);
    };
  }, [autoFocus]);

  const handleChange = (e, index) => {
    const value = e.target.value.replace(/\D/g, ''); // only digits
    if (!value) return;

    const newPin = [...pin];
    newPin[index] = value.substring(value.length - 1); // get last typed char
    setPin(newPin);

    // Show digit briefly
    setVisibleDigits(prev => ({ ...prev, [index]: true }));
    if (timeoutsRef.current[index]) clearTimeout(timeoutsRef.current[index]);
    timeoutsRef.current[index] = setTimeout(() => {
      setVisibleDigits(prev => ({ ...prev, [index]: false }));
    }, 500);

    // Move to next input
    if (index < 3) {
      setActiveIndex(index + 1);
      inputRefs[index + 1].current.focus();
    } else {
      // Completed 4 digits
      const fullPin = newPin.join('');
      if (fullPin.length === 4) {
        onComplete(fullPin);
        if (resetOnComplete) {
          setPin(['', '', '', '']);
          setActiveIndex(0);
          inputRefs[0].current.focus();
        }
      }
    }
  };

  const handleKeyDown = (e, index) => {
    if (e.key === 'Backspace') {
      if (pin[index] === '') {
        // If empty, go back to previous
        if (index > 0) {
          setActiveIndex(index - 1);
          inputRefs[index - 1].current.focus();
        }
      } else {
        // Just clear current
        const newPin = [...pin];
        newPin[index] = '';
        setPin(newPin);
        setVisibleDigits(prev => ({ ...prev, [index]: false }));
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      setActiveIndex(index - 1);
      inputRefs[index - 1].current.focus();
    } else if (e.key === 'ArrowRight' && index < 3) {
      setActiveIndex(index + 1);
      inputRefs[index + 1].current.focus();
    }
  };

  return (
    <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
      {pin.map((digit, index) => (
        <input
          key={index}
          ref={inputRefs[index]}
          type="text" 
          inputMode="numeric"
          maxLength="2"
          value={visibleDigits[index] ? digit : (digit ? '•' : '')} 
          onChange={(e) => handleChange(e, index)}
          onKeyDown={(e) => handleKeyDown(e, index)}
          onFocus={() => setActiveIndex(index)}
          className="auth-input pin-box"
          style={{
            width: '70px',
            height: '80px',
            textAlign: 'center',
            fontSize: '40px',
            padding: '0',
            borderRadius: '16px',
            caretColor: 'transparent',
            backgroundColor: activeIndex === index ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.2)',
            border: activeIndex === index ? '2px solid #9d4edd' : '2px solid rgba(255,255,255,0.05)',
            transition: 'all 0.2s',
            boxShadow: activeIndex === index ? '0 0 20px rgba(157, 78, 221, 0.4)' : 'none'
          }}
        />
      ))}
    </div>
  );
}
