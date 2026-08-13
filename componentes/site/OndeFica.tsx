import { Clock, ExternalLink, Instagram, MapPin, Phone } from "lucide-react";

import { CASA } from "@/lib/casa";

/**
 * Onde fica, que horas abre e como chamar.
 *
 * O endereço já estava no rodapé em texto, e texto de endereço ninguém lê:
 * a pessoa quer ver se é perto. O mapa responde isso antes de qualquer
 * palavra.
 *
 * O mapa é um embed do Google sem chave de API. Se um dia parar de carregar,
 * o quadro fica vazio mas o endereço, o "ver no mapa" e o telefone continuam
 * logo abaixo — ninguém deixa de achar a barbearia por causa disso.
 */
export function OndeFica() {
  const busca = encodeURIComponent(CASA.enderecoCompleto);

  return (
    <div className="flex w-full flex-col overflow-hidden rounded-grande border border-borda bg-superficie">
      <div className="relative h-[200px] w-full bg-superficie-ativa sm:h-[220px]">
        <iframe
          title={`Mapa até a ${CASA.nome}`}
          src={`https://maps.google.com/maps?q=${busca}&z=16&output=embed`}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          className="h-full w-full border-0 [filter:invert(92%)_hue-rotate(180deg)_contrast(88%)]"
        />
      </div>

      <div className="flex items-start gap-3 border-t border-borda px-4 py-4">
        <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-texto-apagado" strokeWidth={1.75} />
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-sm text-texto">
            {CASA.endereco}
            <br />
            <span className="num text-texto-suave">
              {CASA.cidade} · CEP {CASA.cep}
            </span>
          </span>
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${busca}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 self-start font-titulo text-sm font-semibold text-acao underline underline-offset-4 hover:text-acao-hover"
          >
            Ver no mapa
            <ExternalLink className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
          </a>
        </div>
      </div>

      <div className="flex items-start gap-3 border-t border-borda px-4 py-4">
        <Clock className="mt-0.5 h-5 w-5 shrink-0 text-texto-apagado" strokeWidth={1.75} />
        <ul className="flex min-w-0 flex-1 flex-col gap-1.5">
          {CASA.expediente.map((linha) => (
            <li
              key={linha.dia}
              className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 text-sm"
            >
              <span className="text-texto">{linha.dia}</span>
              <span className="num text-texto-suave">{linha.horario}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex items-center gap-3 border-t border-borda px-4 py-4">
        <Phone className="h-5 w-5 shrink-0 text-texto-apagado" strokeWidth={1.75} />
        <a
          href={`https://wa.me/${CASA.whatsapp}`}
          target="_blank"
          rel="noopener noreferrer"
          className="num text-sm text-texto hover:text-acao"
        >
          {CASA.telefone}
        </a>
      </div>

      <div className="flex items-center justify-center gap-3 border-t border-borda px-4 py-4">
        <a
          href={CASA.instagram}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${CASA.nome} no Instagram`}
          className="grid h-11 w-11 place-items-center rounded-pill border border-borda text-texto-suave transition-colors hover:border-acao hover:text-acao"
        >
          <Instagram className="h-5 w-5" strokeWidth={1.75} />
        </a>
        <a
          href={`https://wa.me/${CASA.whatsapp}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Chamar a ${CASA.nome} no WhatsApp`}
          className="grid h-11 w-11 place-items-center rounded-pill border border-borda text-texto-suave transition-colors hover:border-clube hover:text-clube"
        >
          {/* O lucide não traz o glifo do WhatsApp; este é o oficial. */}
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
            <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.95 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.14-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.42-.07-.13-.27-.2-.57-.35Z" />
            <path d="M12.04 2C6.6 2 2.17 6.43 2.17 11.87c0 1.74.46 3.44 1.32 4.94L2 22l5.35-1.4a9.83 9.83 0 0 0 4.69 1.19h.01c5.43 0 9.86-4.43 9.86-9.87 0-2.64-1.03-5.12-2.89-6.98A9.8 9.8 0 0 0 12.04 2Zm0 18.02h-.01a8.2 8.2 0 0 1-4.17-1.14l-.3-.18-3.1.81.83-3.02-.2-.31a8.16 8.16 0 0 1-1.25-4.35c0-4.52 3.68-8.2 8.2-8.2 2.19 0 4.25.86 5.8 2.41a8.14 8.14 0 0 1 2.4 5.8c0 4.52-3.68 8.2-8.2 8.2Z" />
          </svg>
        </a>
      </div>
    </div>
  );
}
