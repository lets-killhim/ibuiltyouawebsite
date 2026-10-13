import React from 'react';
import { createRoot } from 'react-dom/client';
import App, { applyTheme } from './App.jsx';
try { applyTheme(localStorage.getItem('theme') || 'green'); } catch { /* ignore */ }
import './styles.css';
createRoot(document.getElementById('root')).render(<App />);
