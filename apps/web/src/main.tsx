import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Điểm vào app React (GĐ 0: khung trống — các màn hình sẽ được port dần từ app
// legacy, xem docs/WEB-REACT.md).
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
