import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { setupFetchInterceptor } from './utils/fetchInterceptor';

setupFetchInterceptor();

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  (window as Window & { __silangInstallPrompt?: Event }).__silangInstallPrompt = event;
  window.dispatchEvent(new Event('pwa:installprompt'));
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error: unknown) => {
      console.error('[PWA] Service worker registration failed:', error);
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
