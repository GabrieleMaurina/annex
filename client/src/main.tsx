import '@fontsource-variable/inter';
import '@fontsource/barlow-condensed/700.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import { initUiClickSounds, preloadSounds } from './lib/sounds';
import { initButtonEffects } from './ui/buttons/buttonEffects';
import './ui/styles';

preloadSounds();
initUiClickSounds();
initButtonEffects();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
