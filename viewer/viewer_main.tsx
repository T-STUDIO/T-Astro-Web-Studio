import React from 'react';
import ReactDOM from 'react-dom/client';
import ObservationViewer from './ObservationViewer';

const startViewer = () => {
  const rootElement = document.getElementById('root');
  if (!rootElement) return;

  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <ObservationViewer />
    </React.StrictMode>
  );
};

window.addEventListener('load', startViewer);
