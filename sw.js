const CACHE_NAME = "dbv-app-v3"; // <--- Mudei para v3 pra garantir!
const urlsToCache = [
    "./",
    "./index.html",
    "./style.css",
    "./script.js",
    "./logo.png",
    "./manifest.json",
    "./politica.html",
    "./termos.html",
    "./redefinir.html" // Adicionei sua página nova aqui também
];

// 1. INSTALAÇÃO: Força a entrada imediata (O Pulo do Gato)
self.addEventListener("install", (event) => {
    self.skipWaiting(); // <--- ESSA LINHA DIZ: "NÃO ESPERE, ATUALIZE JÁ!"

    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log("Arquivos em cache (Versão Nova)");
            return cache.addAll(urlsToCache);
        })
    );
});

// 2. ATIVAÇÃO: Limpa caches velhos e assume o controle na hora
self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        console.log("Deletando cache velho:", cache);
                        return caches.delete(cache);
                    }
                })
            );
        }).then(() => {
            return self.clients.claim(); // <--- ESSA LINHA DIZ: "CONTROLE A PÁGINA AGORA"
        })
    );
});

// 3. FETCH: O padrão (cache primeiro, depois rede)
self.addEventListener("fetch", (event) => {
    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request);
        })
    );
});