import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource/be-vietnam-pro/400.css';
import '@fontsource/be-vietnam-pro/500.css';
import '@fontsource/be-vietnam-pro/600.css';
import '@fontsource/be-vietnam-pro/700.css';
import '@fontsource/be-vietnam-pro/800.css';
import '@fontsource-variable/inter';
import '@fontsource-variable/work-sans';
import '@fontsource/fraunces/500.css';
import '@fontsource/fraunces/500-italic.css';
import '@fontsource/fraunces/600.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@fontsource/lora/400.css';
import '@fontsource/lora/400-italic.css';
import '@fontsource/lora/500.css';
import '@fontsource/lora/600.css';
import '@fontsource/lora/700.css';
import App from './App';
import './index.css';
import './styles/app.css';

// Điểm vào app React — xem docs/WEB-REACT.md + docs/DESIGN.md.
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
