const CACHE_NAME = "dbv-app-v2";
const urlsToCache = [
    "./",
    "./index.html",
    "./style.css",
    "./script.js",
    "./logo.png",
    "./manifest.json",
    "./politica.html",
    "./termos.html"
];

// Instala o App no Cache do Celular
self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log("Arquivos em cache");
            return cache.addAll(urlsToCache);
        })
    );
});

// Busca do Cache quando estiver offline ou carregando
self.addEventListener("fetch", (event) => {
    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request);
        })
    );
});