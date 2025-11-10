import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import EditorWindow from './EditorWindow';
import './index.css';

// 根据 URL 参数决定渲染哪个组件
const params = new URLSearchParams(window.location.search);
const windowType = params.get('window') || 'main';

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      {windowType === 'editor' ? <EditorWindow /> : <App />}
    </React.StrictMode>
  );
}