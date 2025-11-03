'use client';

import { useEffect } from 'react';

export function PWARegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      return;
    }

    let controllerChangeHandler;
    let refreshing = false;

    const registerServiceWorker = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');

        const requestUpdate = () => {
          if (registration.waiting) {
            registration.waiting.postMessage({ type: 'SKIP_WAITING' });
          }
        };

        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            if (
              newWorker.state === 'installed' &&
              navigator.serviceWorker.controller
            ) {
              requestUpdate();
            }
          });
        });

        if (registration.waiting) {
          requestUpdate();
        }

        controllerChangeHandler = () => {
          if (refreshing) return;
          refreshing = true;
          window.location.reload();
        };

        navigator.serviceWorker.addEventListener(
          'controllerchange',
          controllerChangeHandler
        );

        registration.update();
      } catch (error) {
        console.log('SW registration failed: ', error);
      }
    };

    const onLoad = () => {
      registerServiceWorker();
    };

    window.addEventListener('load', onLoad);

    return () => {
      window.removeEventListener('load', onLoad);
      if (controllerChangeHandler) {
        navigator.serviceWorker.removeEventListener(
          'controllerchange',
          controllerChangeHandler
        );
      }
    };
  }, []);

  return null;
}
