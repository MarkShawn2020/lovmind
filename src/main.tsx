import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import EditorWindow from './EditorWindow';
import SettingsWindow from './SettingsWindow';
import './index.css';

// 根据 URL 参数决定渲染哪个组件
const params = new URLSearchParams(window.location.search);
const windowType = params.get('window') || 'main';

const rootElement = document.getElementById('root');
if (rootElement) {
  let component;
  if (windowType === 'editor') {
    component = <EditorWindow />;
  } else if (windowType === 'settings') {
    component = <SettingsWindow />;
  } else {
    component = <App />;
  }

  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      {component}
    </React.StrictMode>
  );
}