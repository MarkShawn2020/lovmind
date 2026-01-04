import React from 'react';
import ReactDOM from 'react-dom/client';
import MainWindow from './main-window.tsx';
import MainWindowIOS from './main-window-ios.tsx';
import FloatWindow from './float-window.tsx';
import SettingsWindow from './settings-window.tsx';
import { isIOS } from './utils/platform';
import './index.css';

const isDev = process.env.NODE_ENV === 'development';

if (isDev) {
  console.time('[Perf] Window load to React render');
}

// Platform detection
const platformIsIOS = isIOS();
if (isDev) {
  console.log('[Platform] User Agent:', navigator.userAgent);
  console.log('[Platform] Platform:', navigator.platform);
  console.log('[Platform] Is iOS:', platformIsIOS);
}

// 根据 URL 参数决定渲染哪个组件
const params = new URLSearchParams(window.location.search);
const windowType = params.get('window') || 'main';

if (isDev) {
  console.log('[Perf] Window type:', windowType);
}

const rootElement = document.getElementById('root');
if (rootElement) {
  let component;
  if (windowType === 'editor') {
    if (isDev) {
      console.log('[Perf] Creating FloatWindow component');
    }
    // On iOS, editor windows are handled by navigation stack, not separate windows
    if (platformIsIOS) {
      if (isDev) {
        console.warn('[iOS] Editor window requested, but iOS uses navigation stack. Rendering main window instead.');
      }
      component = <MainWindowIOS />;
    } else {
      component = <FloatWindow />;
    }
  } else if (windowType === 'settings') {
    if (isDev) {
      console.log('[Perf] Creating SettingsWindow component');
    }
    component = <SettingsWindow />;
  } else {
    if (isDev) {
      console.log('[Perf] Creating App component (main window)');
    }
    // Use iOS-specific component on iOS devices
    component = platformIsIOS ? <MainWindowIOS /> : <MainWindow />;
  }

  if (isDev) {
    console.time('[Perf] ReactDOM.createRoot');
  }
  const root = ReactDOM.createRoot(rootElement);
  if (isDev) {
    console.timeEnd('[Perf] ReactDOM.createRoot');
  }

  if (isDev) {
    console.time('[Perf] Initial render');
  }
  // StrictMode disabled for all windows to improve performance
  // StrictMode causes double-rendering which delays content display
  root.render(component);
  if (isDev) {
    console.timeEnd('[Perf] Initial render');
    console.timeEnd('[Perf] Window load to React render');
    console.log('[Init] React app rendered successfully');
  }
} else {
  console.error('[Init] ERROR: Root element not found!');
}