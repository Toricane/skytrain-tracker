// Service Worker for Vancouver Transit Tracker
const CACHE_NAME = "vancouver-transit-v1.3";
const STATIC_CACHE_NAME = "vancouver-transit-static-v1.3";
const DATA_CACHE_NAME = "vancouver-transit-data-v1.3";

// Check if we're in development mode
const isDevelopment =
    location.hostname === "localhost" || location.hostname === "127.0.0.1";

// Cache duration constants (in milliseconds)
const CACHE_DURATIONS = {
    STATIC_ASSETS: 7 * 24 * 60 * 60 * 1000, // 7 days
    DATA_FILES: 5 * 60 * 1000, // 5 minutes
    EXTERNAL_RESOURCES: 30 * 24 * 60 * 60 * 1000, // 30 days
    DEVELOPMENT: 0, // No caching in dev
};

// Static assets that should be cached
const staticUrlsToCache = [
    "/",
    "/index.html",
    "/style.css",
    "/script.js",
    "/manifest.json",
    "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap",
    "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",
    "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js",
];

// Dynamic data files that should have shorter cache times
const dataUrls = [
    "/stations_for_map.csv",
    "/transit_routes.geojson",
    "/train_journeys.json",
    "/station_schedules.json",
];

// Helper function to check if cached item is still fresh
function isCacheValid(cachedResponse, maxAge) {
    if (!cachedResponse) return false;

    const cachedDate = new Date(
        cachedResponse.headers.get("date") ||
            cachedResponse.headers.get("cache-date")
    );
    const now = new Date();
    return now - cachedDate < maxAge;
}

// Helper function to check if URL is a static asset
function isStaticAsset(url) {
    return (
        url.pathname.match(
            /\.(css|js|html|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/
        ) ||
        staticUrlsToCache.some(
            (staticUrl) => url.pathname === staticUrl || url.href === staticUrl
        )
    );
}

// Helper function to check if URL is a data file
function isDataFile(url) {
    return dataUrls.some((dataUrl) => url.pathname.endsWith(dataUrl));
}

// Helper function to check if URL is an external resource
function isExternalResource(url) {
    return url.hostname !== location.hostname;
}

// Install event - cache static resources only in production
self.addEventListener("install", (event) => {
    console.log("Service Worker installing...");

    if (isDevelopment) {
        console.log("Development mode: Skipping aggressive caching");
        self.skipWaiting();
        return;
    }

    event.waitUntil(
        Promise.all([
            caches.open(STATIC_CACHE_NAME).then((cache) => {
                console.log("Caching static assets");
                return cache.addAll(staticUrlsToCache);
            }),
            caches.open(DATA_CACHE_NAME).then((cache) => {
                console.log("Preparing data cache");
                return cache.addAll(dataUrls);
            }),
        ]).catch((error) => {
            console.log("Cache install failed:", error);
        })
    );
});

// Fetch event - intelligent caching strategy with proper duration controls
self.addEventListener("fetch", (event) => {
    const request = event.request;
    const url = new URL(request.url);

    // Skip caching for non-GET requests
    if (request.method !== "GET") return;

    // Development mode - minimal caching with fresh content
    if (isDevelopment) {
        if (isStaticAsset(url) || isExternalResource(url)) {
            event.respondWith(
                caches.open(STATIC_CACHE_NAME).then((cache) => {
                    return cache.match(request).then((cachedResponse) => {
                        // Always try to fetch fresh, fallback to cache
                        const fetchPromise = fetch(request)
                            .then((response) => {
                                if (response && response.status === 200) {
                                    cache.put(request, response.clone());
                                }
                                return response;
                            })
                            .catch(() => cachedResponse);

                        return fetchPromise;
                    });
                })
            );
        } else {
            // For HTML, data files, etc., always fetch fresh in development
            event.respondWith(fetch(request));
        }
        return;
    }

    // Production mode with proper cache duration controls
    if (isStaticAsset(url)) {
        event.respondWith(
            caches.open(STATIC_CACHE_NAME).then((cache) => {
                return cache.match(request).then((cachedResponse) => {
                    if (
                        isCacheValid(
                            cachedResponse,
                            CACHE_DURATIONS.STATIC_ASSETS
                        )
                    ) {
                        console.log(
                            "Serving static asset from cache:",
                            url.pathname
                        );
                        return cachedResponse;
                    }

                    console.log("Fetching fresh static asset:", url.pathname);
                    return fetch(request)
                        .then((response) => {
                            if (response && response.status === 200) {
                                // Add cache timestamp
                                const responseToCache = new Response(
                                    response.body,
                                    {
                                        status: response.status,
                                        statusText: response.statusText,
                                        headers: {
                                            ...Object.fromEntries(
                                                response.headers.entries()
                                            ),
                                            "cache-date":
                                                new Date().toISOString(),
                                        },
                                    }
                                );
                                cache.put(request, responseToCache.clone());
                            }
                            return response;
                        })
                        .catch(() => {
                            console.log(
                                "Network failed, using cached static asset:",
                                url.pathname
                            );
                            return (
                                cachedResponse ||
                                new Response("Offline", { status: 503 })
                            );
                        });
                });
            })
        );
    } else if (isDataFile(url)) {
        event.respondWith(
            caches.open(DATA_CACHE_NAME).then((cache) => {
                return cache.match(request).then((cachedResponse) => {
                    const fetchPromise = fetch(request).then((response) => {
                        if (response && response.status === 200) {
                            const responseToCache = new Response(
                                response.body,
                                {
                                    status: response.status,
                                    statusText: response.statusText,
                                    headers: {
                                        ...Object.fromEntries(
                                            response.headers.entries()
                                        ),
                                        "cache-date": new Date().toISOString(),
                                    },
                                }
                            );
                            cache.put(request, responseToCache.clone());
                            console.log(
                                "Updated data file cache:",
                                url.pathname
                            );
                        }
                        return response;
                    });

                    if (
                        isCacheValid(cachedResponse, CACHE_DURATIONS.DATA_FILES)
                    ) {
                        console.log(
                            "Serving data file from cache (background update):",
                            url.pathname
                        );
                        // Return cached version immediately, update in background
                        fetchPromise.catch(() => {
                            console.log(
                                "Background update failed for:",
                                url.pathname
                            );
                        });
                        return cachedResponse;
                    }

                    console.log(
                        "Data file cache expired, fetching fresh:",
                        url.pathname
                    );
                    return fetchPromise.catch(() => {
                        console.log(
                            "Network failed, using cached data file:",
                            url.pathname
                        );
                        return (
                            cachedResponse ||
                            new Response("Offline", { status: 503 })
                        );
                    });
                });
            })
        );
    } else if (isExternalResource(url)) {
        event.respondWith(
            caches.open(STATIC_CACHE_NAME).then((cache) => {
                return cache.match(request).then((cachedResponse) => {
                    if (
                        isCacheValid(
                            cachedResponse,
                            CACHE_DURATIONS.EXTERNAL_RESOURCES
                        )
                    ) {
                        console.log(
                            "Serving external resource from cache:",
                            url.hostname
                        );
                        return cachedResponse;
                    }

                    return fetch(request)
                        .then((response) => {
                            if (response && response.status === 200) {
                                const responseToCache = new Response(
                                    response.body,
                                    {
                                        status: response.status,
                                        statusText: response.statusText,
                                        headers: {
                                            ...Object.fromEntries(
                                                response.headers.entries()
                                            ),
                                            "cache-date":
                                                new Date().toISOString(),
                                        },
                                    }
                                );
                                cache.put(request, responseToCache.clone());
                            }
                            return response;
                        })
                        .catch(
                            () =>
                                cachedResponse ||
                                new Response("Offline", { status: 503 })
                        );
                });
            })
        );
    } else {
        // For other requests, try network first
        event.respondWith(
            fetch(request).catch(() => {
                // If offline and no cache, return offline page for documents
                if (request.destination === "document") {
                    return (
                        caches.match("/index.html") ||
                        new Response(
                            `<!DOCTYPE html>
                        <html>
                        <head>
                            <title>Vancouver Transit Tracker - Offline</title>
                            <meta charset="UTF-8">
                            <meta name="viewport" content="width=device-width, initial-scale=1.0">
                            <style>
                                body { 
                                    font-family: Inter, sans-serif; 
                                    text-align: center; 
                                    padding: 2rem; 
                                    background: #f8fafc;
                                    color: #1a202c;
                                }
                                .offline-message {
                                    max-width: 400px;
                                    margin: 2rem auto;
                                    padding: 2rem;
                                    background: white;
                                    border-radius: 12px;
                                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                                }
                                .emoji { font-size: 3rem; margin-bottom: 1rem; }
                                h1 { color: #005dab; margin-bottom: 1rem; }
                                p { color: #4a5568; line-height: 1.6; }
                                button { 
                                    background: #005dab; 
                                    color: white; 
                                    border: none; 
                                    padding: 0.75rem 1.5rem; 
                                    border-radius: 8px; 
                                    font-size: 1rem; 
                                    cursor: pointer; 
                                    margin-top: 1rem;
                                }
                                button:hover { background: #004494; }
                            </style>
                        </head>
                        <body>
                            <div class="offline-message">
                                <div class="emoji">🚇</div>
                                <h1>Vancouver Transit Tracker</h1>
                                <p>You're currently offline. Please check your internet connection and try again.</p>
                                <button onclick="location.reload()">Try Again</button>
                            </div>
                        </body>
                        </html>`,
                            {
                                headers: {
                                    "Content-Type": "text/html",
                                },
                            }
                        )
                    );
                }
                return new Response("Offline", { status: 503 });
            })
        );
    }
});

// Activate event - clean up old caches and take control immediately
self.addEventListener("activate", (event) => {
    console.log("Service Worker activating...");

    event.waitUntil(
        Promise.all([
            // Clean up old caches
            caches.keys().then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (
                            cacheName !== STATIC_CACHE_NAME &&
                            cacheName !== DATA_CACHE_NAME &&
                            cacheName !== CACHE_NAME
                        ) {
                            console.log("Deleting old cache:", cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            }),
            // Take control of all pages immediately
            self.clients.claim(),
        ])
    );
});

// Handle skip waiting message from main thread
self.addEventListener("message", (event) => {
    if (event.data && event.data.type === "SKIP_WAITING") {
        self.skipWaiting();
    }
});

// Background sync for data updates when online (optional)
self.addEventListener("sync", (event) => {
    if (event.tag === "background-sync") {
        event.waitUntil(
            // Update data caches in background
            Promise.all(
                dataUrls.map((url) =>
                    fetch(url)
                        .then((response) => {
                            if (response.ok) {
                                return caches
                                    .open(DATA_CACHE_NAME)
                                    .then((cache) => cache.put(url, response));
                            }
                        })
                        .catch(() => {
                            // Ignore network errors in background sync
                        })
                )
            )
        );
    }
});
