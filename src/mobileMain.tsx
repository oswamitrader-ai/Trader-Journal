import React from 'react';
import ReactDOM from 'react-dom/client';
import TradeLockMobileApp from '../mobile/src/App';
import './index.css';

const rootElement = document.getElementById('mobile-root');

if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <TradeLockMobileApp />
    </React.StrictMode>
  );
}
