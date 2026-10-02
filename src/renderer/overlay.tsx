import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Overlay } from './features/overlay/overlay';
import './styles/index.css';

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

// Deliberately thinner than the app window: no query client and no tooltip provider. The
// overlay renders one pushed message, fetches nothing, and caches nothing.
createRoot(root).render(
  <StrictMode>
    <Overlay />
  </StrictMode>,
);
