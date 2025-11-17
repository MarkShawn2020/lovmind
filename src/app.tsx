import React from 'react';
import ReactDOM from 'react-dom/client';
import MainWindow from './main-window.tsx';
import MainWindowIOS from './main-window-ios.tsx';
import FloatWindow from './float-window.tsx';
import SettingsWindow from './settings-window.tsx';
import { isIOS } from './utils/platform';
import './index.css';

console.time('[Perf] Window load to React render');

// Platform detection
const platformIsIOS = isIOS();
console.log('[Platform] User Agent:', navigator.userAgent);
console.log('[Platform] Platform:', navigator.platform);
console.log('[Platform] Is iOS:', platformIsIOS);

// 根据 URL 参数决定渲染哪个组件
const params = new URLSearchParams(window.location.search);
const windowType = params.get('window') || 'main';

console.log('[Perf] Window type:', windowType);

const rootElement = document.getElementById('root');
if (rootElement) {
  let component;
  if (windowType === 'editor') {
    console.log('[Perf] Creating FloatWindow component');
    // On iOS, editor windows are handled by navigation stack, not separate windows
    if (platformIsIOS) {
      console.warn('[iOS] Editor window requested, but iOS uses navigation stack. Rendering main window instead.');
      component = <MainWindowIOS />;
    } else {
      component = <FloatWindow />;
    }
  } else if (windowType === 'settings') {
    console.log('[Perf] Creating SettingsWindow component');
    component = <SettingsWindow />;
  } else {
    console.log('[Perf] Creating App component (main window)');
    // Use iOS-specific component on iOS devices
    component = platformIsIOS ? <MainWindowIOS /> : <MainWindow />;
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