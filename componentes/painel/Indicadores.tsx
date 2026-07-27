import type { Indicador } from "@/lib/abas";

export function Indicadores({ itens }: { itens: Indicador[] }) {
  return (
    <dl className="grid grid-cols-3 gap-2 sm:gap-3">
      {itens.map((item) => (
        <div
          key={item.rotulo}
          className="flex flex-col gap-1 rounded-card border border-borda bg-superficie px-3 py-3 sm:px-4"
        >
          <dt className="text-xs text-texto-suave">{item.rotulo}</dt>
          <dd className="num font-titulo text-xl font-bold text-texto sm:text-2xl">
            {item.valor}
          </dd>
        </div>
      ))}
    </dl>
  );
}
