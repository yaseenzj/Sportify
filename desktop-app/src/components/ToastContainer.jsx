import React, { useEffect, useState } from 'react';

export default function ToastContainer({ message }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (message) {
      setTimeout(() => setShow(true), 10);
    }
  }, [message]);

  return (
    <div className="toast-container">
      <div className={`toast ${show ? 'show' : ''}`}>
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <span>{message}</span>
      </div>
    </div>
  );
}
