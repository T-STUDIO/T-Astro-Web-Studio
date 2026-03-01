
// A unique name for the cache
const CACHE_NAME = 't-astro-web-studio-cache-v5'; // Bump version for changes

// A list of all the files and resources the app needs to function offline
const URLS_TO_CACHE = [
  // App Shell
  '/',
  '/index.html',
  '/index.tsx',
  '/metadata.json',
  '/App.tsx',
  '/types.ts',
  '/constants.ts',
  '/app-definition.json',
  
  // Components
  '/components/Header.tsx',
  '/components/ControlPanel.tsx',
  '/components/MainView.tsx',
  '/components/Planetarium.tsx',
  '/components/ImagingView.tsx',
  '/components/StatusBar.tsx',
  '/components/GeminiInfoModal.tsx',
  '/components/Button.tsx',
  '/components/LanguageSwitcher.tsx',
  
  // Icons
  '/components/icons/CameraIcon.tsx',
  '/components/icons/ChevronDownIcon.tsx',
  '/components/icons/ChevronUpIcon.tsx',
  '/components/icons/CloseIcon.tsx',
  '/components/icons/ConnectIcon.tsx',
  '/components/icons/CrosshairIcon.tsx',
  '/components/icons/DisconnectIcon.tsx',
  '/components/icons/GeminiIcon.tsx',
  '/components/icons/StopIcon.tsx',
  '/components/icons/TelescopeIcon.tsx',
  '/components/icons/GpsIcon.tsx',
  '/components/icons/AladinIcon.tsx',
  
  // Services
  '/services/AstroService.ts',
  '/services/geminiService.ts',
  '/services/sampService.ts',

  // Utils
  '/utils/coords.ts',
  
  // Contexts
  '/contexts/LanguageContext.tsx',

  // i18n
  '/i18n/locales/en.ts',
  '/i18n/locales/ja.ts',
  
  // Static assets
  '/favicon.ico',
  
  // External Dependencies
  'https://cdn.tailwindcss.com',
  'https://cdn.jsdelivr.net/gh/astrojs/sampjs@master/samp.js', // Consistent with index.html
  'https://esm.sh/react@^19.1.0',
  'https://esm.sh/react-dom/client',
  'https://esm.sh/react@^19.1.0/',
  'https://esm.sh/react-dom@^19.1.0/',
  'https://esm.sh/@google/genai@^1.9.0',
  
  // Images from Unsplash
  'https://images.unsplash.com/photo-1627003489379-3388a1f8b656?q=80&w=2560&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1627003489379-3388a1f8b656?q=20&w=2560&auto=format&fit=crop&blur=10',
  'https://images.unsplash.com/photo-1614926590749-9954c3a4521e?q=80&w=2560&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1614926590749-9954c3a4521e?q=20&w=2560&auto=format&fit=crop&blur=10',
  'https://images.unsplash.com/photo-1590499308018-7fde43fac315?q=80&w=2560&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1590499308018-7fde43fac315?q=20&w=2560&auto=format&fit=crop&blur=10',
  'https://images.unsplash.com/photo-1614313913007-8b4ae9ce3a12?q=80&w=2560&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1614313913007-8b4ae9ce3a12?q=20&w=2560&auto=format&fit=crop&blur=10',
  'https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?q=80&w=2560&auto=format&fit=crop',
];

// Install event - caches the files
self.addEventListener('install', event => {
  console.log('Service Worker: Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Caching app shell');
        return cache.addAll(URLS_TO_CACHE.map(url => new Request(url, { cache: 'reload' })));
      })
      .catch(error => {
        console.error('Failed to cache', error);
      })
  );
});

// Activate event - cleans up old caches
self.addEventListener('activate', event => {
  console.log('Service Worker: Activating...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log('Service Worker: Clearing old cache', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// Fetch event - serves files from cache or network
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - return response
        if (response) {
          return response;
        }

        // Clone the request because it's a stream and can only be consumed once
        const fetchRequest = event.request.clone();

        return fetch(fetchRequest).then(
          response => {
            // Check if we received a valid response
            if (!response || (response.status !== 200 && response.status !== 0)) {
               return response;
            }
            
            // Clone the response because it's a stream and can only be consumed once
            const responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });

            return response;
          }
        ).catch(error => {
            console.error('Fetch failed for:', event.request.url, error);
            // You could return a custom offline page here if needed
        });
      })
  );
});
