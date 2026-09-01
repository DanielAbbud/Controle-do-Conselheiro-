const CACHE_NAME = "controle-unidade-v3.9";
const CACHE_PREFIX = "controle-unidade-";

const urlsToCache = [
    "./",
    "./index.html",
    "./style.css",
    "./script.js",
    "./logo.png",

    "./logo-thiago-white.png",
    "./logo-ellen-white.png",
    "./logo-joseph-bates.png",
    "./logo-rainha-ester.png",

    "./manifest.json",
    "./politica.html",
    "./termos.html",
    "./redefinir.html"
];


// INSTALA A NOVA VERSÃO
self.addEventListener("install", (event) => {

    event.waitUntil((async () => {

        const cache =
            await caches.open(CACHE_NAME);

        await Promise.all(
            urlsToCache.map(async (url) => {

                const request =
                    new Request(
                        url,
                        {
                            cache: "reload"
                        }
                    );

                const response =
                    await fetch(request);

                if (!response.ok) {

                    throw new Error(
                        `Erro ao atualizar ${url}`
                    );

                }

                await cache.put(
                    url,
                    response
                );

            })
        );

    })());

});


// RECEBE O CLIQUE EM "ATUALIZAR"
self.addEventListener(
    "message",
    (event) => {

        if (
            event.data &&
            event.data.action ===
            "skipWaiting"
        ) {

            self.skipWaiting();

        }

    }
);


// LIMPA CACHE ANTIGO
self.addEventListener(
    "activate",
    (event) => {

        event.waitUntil((async () => {

            const cachesExistentes =
                await caches.keys();

            await Promise.all(

                cachesExistentes
                    .filter(
                        (nome) =>
                            nome.startsWith(
                                CACHE_PREFIX
                            ) &&
                            nome !== CACHE_NAME
                    )
                    .map(
                        (nome) =>
                            caches.delete(nome)
                    )

            );

            await self.clients.claim();

        })());

    }
);


// CONTROLE DO CACHE
self.addEventListener(
    "fetch",
    (event) => {

        if (
            event.request.method !== "GET"
        ) return;

        const url =
            new URL(
                event.request.url
            );

        if (
            url.origin !==
            self.location.origin
        ) return;


        // HTML SEMPRE TENTA INTERNET PRIMEIRO
        if (
            event.request.mode ===
            "navigate"
        ) {

            event.respondWith((async () => {

                try {

                    const response =
                        await fetch(
                            event.request,
                            {
                                cache:
                                    "no-store"
                            }
                        );

                    return response;

                } catch (erro) {

                    return (
                        await caches.match(
                            "./index.html"
                        )
                    );

                }

            })());

            return;
        }


        // DEMAIS ARQUIVOS
        event.respondWith((async () => {

            const cached =
                await caches.match(
                    event.request
                );

            if (cached) {
                return cached;
            }

            return fetch(
                event.request
            );

        })());

    }
);