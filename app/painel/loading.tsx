/**
 * Esqueleto do miolo enquanto a aba chega.
 *
 * Cobre só o que está dentro do layout: cabeçalho e barra lateral continuam na
 * tela, e o Johny vê na hora que o toque dele pegou.
 */
export default function Carregando() {
  return (
    <>
      <dl className="grid grid-cols-3 gap-2 sm:gap-3">
        {["Marcados", "A receber", "Pix pendente"].map((rotulo) => (
          <div
            key={rotulo}
            className="flex flex-col gap-1 rounded-card border border-borda bg-superficie px-3 py-3 sm:px-4"
          >
            <dt className="text-xs text-texto-suave">{rotulo}</dt>
            <dd className="num font-titulo text-xl font-bold text-texto-apagado sm:text-2xl">
              ·
            </dd>
          </div>
        ))}
      </dl>

      <section className="flex min-h-[240px] items-center justify-center rounded-grande border border-borda bg-superficie p-5">
        <span className="text-sm text-texto-apagado">Carregando...</span>
      </section>
    </>
  );
}
