import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import './app/theme.css';
import './app/config/i18n';
import { store } from './app/store/index.store';
import env from './app/config/env';
import Router from './app/router/router';

const RouterProvider = env.routerMode === 'hash' ? HashRouter : BrowserRouter;
const future = { v7_startTransition: true, v7_relativeSplatPath: true };

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Provider store={store}>
      <RouterProvider future={future}>
        <Router />
      </RouterProvider>
    </Provider>
  </React.StrictMode>,
);
