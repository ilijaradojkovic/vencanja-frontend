import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import '@fontsource/eb-garamond/400.css';
import '@fontsource/eb-garamond/500.css';
import '@fontsource/eb-garamond/600.css';
import '@fontsource/eb-garamond/400-italic.css';
import '@fontsource/jost/300.css';
import '@fontsource/jost/400.css';
import '@fontsource/jost/500.css';
import '@fontsource/caveat/400.css';
import '@fontsource/caveat/600.css';
import './app/app.css';
import { store } from './app/store/index.store';
import env from './app/config/env';
import Router from './app/router/router';

// hash router za statički hosting bez podrške za SPA rute (VITE_ROUTER=hash)
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
