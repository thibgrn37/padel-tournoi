import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { FenetreDiffusion } from './ui/FenetreDiffusion';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {location.hash === '#diffusion' ? <FenetreDiffusion /> : <App />}
  </StrictMode>,
);
