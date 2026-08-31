import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import {applyManifest, registerServiceWorker} from './lib/pwa.ts';

// Before first paint: the manifest has to match the route, so that installing
// from /admin gives the dashboard app rather than the public one.
applyManifest();
registerServiceWorker();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
