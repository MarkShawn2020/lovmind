import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import FloatWindow from './FloatWindow';
import SettingsWindow from './SettingsWindow';
import './index.css';

console.time('[Perf] Window load to React render');

// 根据 URL 参数决定渲染哪个组件
const params = new URLSearchParams(window.location.search);
const windowType = params.get('window') || 'main';

console.log('[Perf] Window type:', windowType);

const rootElement = document.getElementById('root');
if (rootElement) {
  let component;
  if (windowType === 'editor') {
    console.log('[Perf] Creating FloatWindow component');
    component = <FloatWindow />;
  } else if (windowType === 'settings') {
    component = <SettingsWindow />;
  } else {
    component = <App />;
  }

  console.time('[Perf] ReactDOM.createRoot');
  const root = ReactDOM.createRoot(rootElement);
  console.timeEnd('[Perf] ReactDOM.createRoot');

  console.time('[Perf] Initial render');
  // Disable StrictMode for editor windows to improve perceived performance
  // StrictMode causes double-rendering which delays content display
  const shouldUseStrictMode = windowType !== 'editor';

  root.render(
    shouldUseStrictMode ? (
      <React.StrictMode>
        {component}
      </React.StrictMode>
    ) : (
      component
    )
  );
  console.timeEnd('[Perf] Initial render');
  console.timeEnd('[Perf] Window load to React render');
}