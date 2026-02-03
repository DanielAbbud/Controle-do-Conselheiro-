// 1. Mudei o nome para v3.0 para forçar a atualização nos celulares
const CACHE_NAME = "controle-unidade-v2.1";

const urlsToCache = [
    "./",
    "./index.html",
    "./style.css",
    "./script.js",
    "./logo.png",
    "./manifest.json",
    "./politica.html",
    "./termos.html",
    "./redefinir.html"
];

// 2. INSTALAÇÃO: Agora ele baixa os arquivos mas FICA ESPERANDO (Waiting)
self.addEventListener("install", (event) => {
    // REMOVI O self.skipWaiting() DAQUI PARA O BOTÃO FUNCIONAR
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log("Baixando nova versão v3.0...");
            return cache.addAll(urlsToCache);
        })
    );
});

// 3. MENSAGEM: É aqui que a mágica do botão acontece
// Quando o usuário clica em "Atualizar" no site, ele manda essa mensagem pra cá
self.addEventListener('message', (event) => {
    if (event.data.action === 'skipWaiting') {
        self.skipWaiting(); // AGORA SIM ele atualiza!
    }
});

// 4. ATIVAÇÃO: Limpa os caches antigos (v2, v1...)
self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        console.log("Limpando cache antigo:", cache);
                        return caches.delete(cache);
                    }
                })
            );
        }).then(() => {
            return self.clients.claim(); // Assume o controle da página
        })
    );
});

// 5. FETCH: Mantém o site funcionando offline
self.addEventListener("fetch", (event) => {
    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request);
        })
    );
});