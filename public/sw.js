/**
 * O que fica rodando quando o site está fechado.
 *
 * Só existe para dois momentos: o aviso chegar e o toque no aviso abrir a
 * tela certa. Nada de cache — a agenda muda a todo minuto e servir tela velha
 * seria pior que não ter aplicativo nenhum.
 */

self.addEventListener("push", (evento) => {
  let dados = {};
  try {
    dados = evento.data ? evento.data.json() : {};
  } catch {
    dados = { titulo: "Johny Barbearia", corpo: evento.data?.text() ?? "" };
  }

  const titulo = dados.titulo || "Johny Barbearia";

  evento.waitUntil(
    self.registration.showNotification(titulo, {
      body: dados.corpo || "",
      icon: "/icone-192.png",
      badge: "/icone-192.png",
      // Vibra mesmo no silencioso, que é como o celular fica na barbearia.
      vibrate: [200, 80, 200],
      // Avisos do mesmo tipo se substituem em vez de empilhar dez cartões.
      tag: dados.grupo || "agenda",
      renotify: true,
      data: { url: dados.url || "/painel" },
    }),
  );
});

self.addEventListener("notificationclick", (evento) => {
  evento.notification.close();
  const destino = evento.notification.data?.url || "/painel";

  evento.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((abertas) => {
      // Já tem o painel aberto: traz para a frente em vez de abrir outra aba.
      for (const janela of abertas) {
        if (janela.url.includes("/painel") && "focus" in janela) {
          janela.navigate?.(destino);
          return janela.focus();
        }
      }
      return clients.openWindow(destino);
    }),
  );
});
