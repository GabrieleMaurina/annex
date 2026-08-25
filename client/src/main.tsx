import 'bootstrap/dist/css/bootstrap.min.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { initUiClickSounds, preloadSounds } from './lib/sounds';
import './scrollbar.css';
import './tooltip.css';

preloadSounds();
initUiClickSounds();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
