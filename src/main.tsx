import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import "./i18n";
import { API_BASE_URL } from './lib/api';
import { handleGooglePopup } from './lib/googlePopup';

if (!handleGooglePopup(API_BASE_URL)) ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
