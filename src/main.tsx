import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MaxUI } from '@maxhub/max-ui';
import '@maxhub/max-ui/dist/styles.css';
import App from './App';
import { initPlatform } from './lib/platform';
import './styles.css';

initPlatform();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MaxUI platform="ios" colorScheme="light">
      <App />
    </MaxUI>
  </StrictMode>,
);
