import React from 'react';
import ReactDOM from 'react-dom/client';
import EditorWindow from './EditorWindow';
import './index.css';

const rootElement = document.getElementById('editor-root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <EditorWindow />
    </React.StrictMode>
  );
}