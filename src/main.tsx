import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import FloatWindow from './FloatWindow';
import SettingsWindow from './SettingsWindow';
import './index.css';

console.time('[Perf] Window load to React render');

// iOS debugging: log platform and user agent
console.log('[Platform] User Agent:', navigator.userAgent);
console.log('[Platform] Platform:', navigator.platform);
console.log('[Platform] Is iOS:', /iPad|iPhone|iPod/.test(navigator.userAgent));

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
    console.log('[Perf] Creating SettingsWindow component');
    component = <SettingsWindow />;
  } else {
    console.log('[Perf] Creating App component (main window)');
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
  console.log('[Init] React app rendered successfully');
} else {
  console.error('[Init] ERROR: Root element not found!');
}