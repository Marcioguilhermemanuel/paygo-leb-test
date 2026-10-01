import Link from 'next/link';
import { Clock3 } from 'lucide-react';

export default function ThankYouPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-slate-100">
      <section className="w-full max-w-lg space-y-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-sky-400">
          PayGo Integration Lab
        </p>
        <h1 className="text-3xl font-semibold text-white">Recebemos o retorno do checkout</h1>
        <p className="text-base leading-7 text-slate-300">
          Estamos verificando o estado da transação. Chegar a esta página, por si só, não confirma o pagamento.
        </p>
        <div className="flex items-center gap-3 border-y border-slate-800 py-4 text-sm text-amber-300">
          <Clock3 aria-hidden="true" className="h-5 w-5 shrink-0" />
          <span>Aguardando confirmação do PayGo</span>
        </div>
        <Link href="/" className="inline-block text-sm text-sky-400 underline underline-offset-4 hover:text-sky-300">
          Voltar ao Integration Lab
        </Link>
      </section>
    </main>
  );
}
