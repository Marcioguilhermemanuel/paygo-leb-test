'use client';

import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  CheckCircle,
  XCircle,
  RefreshCw,
  Plus,
  Radio,
  Server,
  Key,
  Database,
  ExternalLink,
  Clock,
  Eye,
  Activity,
} from 'lucide-react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333';

export default function Dashboard() {
  const [health, setHealth] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [webhookStats, setWebhookStats] = useState<any>({ received: 0, valid: 0, invalid: 0, duplicate: 0 });
  const [webhookEvents, setWebhookEvents] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Modals state
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const [selectedWebhook, setSelectedWebhook] = useState<any>(null);

  // Forms state
  const [productForm, setProductForm] = useState({
    name: 'BeSelly PayGo Integration Test',
    price: 50,
    thank_you_url: '',
    payment_multicaixa: true,
    payment_reference: true,
    payment_stripe: false,
  });

  const [paymentForm, setPaymentForm] = useState({
    product_id: '',
    payment_method: 'multicaixa',
    customer_name: 'Cliente Teste',
    customer_email: 'cliente@example.com',
    customer_phone: '923456789',
    confirmed_live: false,
  });

  const [isLiveConfirmOpen, setIsLiveConfirmOpen] = useState(false);

  // Fetch initial data
  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Health
      const healthRes = await fetch(`${API_BASE_URL}/health`).catch(() => null);
      if (healthRes && healthRes.ok) {
        setHealth(await healthRes.json());
      } else {
        setHealth({ status: 'offline', paygoConfigured: false, databaseConnected: false });
      }

      // 2. Products
      const prodRes = await fetch(`${API_BASE_URL}/api/test/products`).catch(() => null);
      if (prodRes && prodRes.ok) {
        const prodData = await prodRes.json();
        setProducts(prodData.products || []);
      }

      // 3. Payments
      const payRes = await fetch(`${API_BASE_URL}/api/test/payments`).catch(() => null);
      if (payRes && payRes.ok) {
        const payData = await payRes.json();
        setPayments(payData.payments || []);
      }

      // 4. Webhooks
      const statsRes = await fetch(`${API_BASE_URL}/api/webhooks/stats`).catch(() => null);
      if (statsRes && statsRes.ok) {
        setWebhookStats(await statsRes.json());
      }
      const eventsRes = await fetch(`${API_BASE_URL}/api/webhooks/events`).catch(() => null);
      if (eventsRes && eventsRes.ok) {
        const evData = await eventsRes.json();
        setWebhookEvents(evData.events || []);
      }

      // 5. Logs
      const logsRes = await fetch(`${API_BASE_URL}/api/logs`).catch(() => null);
      if (logsRes && logsRes.ok) {
        const logsData = await logsRes.json();
        setLogs(logsData.logs || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000); // Poll every 10 seconds
    return () => clearInterval(interval);
  }, []);

  // Handlers
  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/test/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...productForm,
          price: Number(productForm.price),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(`Erro ao criar produto: ${data.error || 'Falha na API'}`);
      } else {
        setIsProductModalOpen(false);
        loadData();
      }
    } catch (err: any) {
      alert(`Erro de conexão: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (health?.isLive) {
      setIsLiveConfirmOpen(true);
    } else {
      executePaymentCreation(false);
    }
  };

  const executePaymentCreation = async (confirmedLive: boolean) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/test/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...paymentForm,
          confirmed_live: confirmedLive,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(`Erro ao criar pagamento: ${data.error || 'Falha na requisição'}`);
      } else {
        setIsPaymentModalOpen(false);
        setIsLiveConfirmOpen(false);
        loadData();
      }
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleQueryStatus = async (paymentId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/test/payments/${paymentId}/status`);
      const data = await res.json();
      if (res.ok) {
        setSelectedPayment(data.payment);
        loadData();
      } else {
        alert(`Erro na consulta: ${data.error || 'Falha'}`);
      }
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Banner for Live Mode */}
      {health?.isLive && (
        <div className="bg-red-600/90 text-white font-bold px-4 py-2 text-center text-sm flex items-center justify-center gap-2 tracking-wide uppercase">
          <ShieldAlert className="w-5 h-5 animate-pulse" />
          <span>Atenção: Modo LIVE ativado. Transações reais movimentam dinheiro real na PayGo.</span>
        </div>
      )}

      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <Radio className="w-5 h-5 text-sky-400" />
              PAYGO INTEGRATION LAB
            </h1>
            <span className="text-xs font-mono bg-sky-500/20 text-sky-400 px-2 py-0.5 rounded border border-sky-500/30">
              v1.0.0-lab
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Laboratório de Engenharia e Investigação Experimental da API PayGo Checkout Angola (BeSelly)
          </p>
        </div>

        {/* Status Indicators */}
        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-1.5 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700">
            <Server className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-400">API:</span>
            <span className={health?.status === 'ok' ? 'text-emerald-400 font-semibold' : 'text-red-400'}>
              {health?.status === 'ok' ? 'Online' : 'Offline'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700">
            <Key className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-400">PayGo:</span>
            <span className={health?.paygoConfigured ? 'text-emerald-400 font-semibold' : 'text-amber-400'}>
              {health?.paygoConfigured ? 'Configurada' : 'Sem Chave'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700">
            <Database className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-400">DB:</span>
            <span className={health?.databaseConnected ? 'text-emerald-400 font-semibold' : 'text-slate-400'}>
              {health?.databaseConnected ? 'PostgreSQL' : 'Memory'}
            </span>
          </div>

          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-1.5 bg-sky-600 hover:bg-sky-500 text-white px-3 py-1.5 rounded-lg transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6">
        {/* Section 1: Test Products */}
        <section className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div>
              <h2 className="text-base font-semibold text-white">PRODUTOS DE TESTE</h2>
              <p className="text-xs text-slate-400">Produtos criados para testar faixas de valor e parâmetros da PayGo</p>
            </div>
            <button
              onClick={() => setIsProductModalOpen(true)}
              className="flex items-center gap-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition"
            >
              <Plus className="w-4 h-4" />
              Criar Produto
            </button>
          </div>

          <div className="mt-4 overflow-x-auto">
            {products.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">Nenhum produto de teste registrado ainda.</p>
            ) : (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-800/60 pb-2">
                    <th className="py-2">Nome</th>
                    <th className="py-2">Valor</th>
                    <th className="py-2">PayGo Product ID</th>
                    <th className="py-2">Métodos</th>
                    <th className="py-2">Criado em</th>
                    <th className="py-2 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {products.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-800/30">
                      <td className="py-2.5 font-medium text-white">{p.name}</td>
                      <td className="py-2.5 font-mono text-emerald-400 font-semibold">{p.price} Kz</td>
                      <td className="py-2.5 font-mono text-slate-400">{p.paygoProductId}</td>
                      <td className="py-2.5 text-slate-400">
                        {p.paymentMulticaixa && <span className="bg-slate-800 px-1.5 py-0.5 rounded mr-1">MCX</span>}
                        {p.paymentReference && <span className="bg-slate-800 px-1.5 py-0.5 rounded">Ref</span>}
                      </td>
                      <td className="py-2.5 text-slate-500 font-mono">
                        {new Date(p.createdAt).toLocaleTimeString()}
                      </td>
                      <td className="py-2.5 text-right">
                        <button
                          onClick={() => {
                            setPaymentForm((prev) => ({ ...prev, product_id: p.paygoProductId }));
                            setIsPaymentModalOpen(true);
                          }}
                          className="text-sky-400 hover:text-sky-300 font-medium"
                        >
                          Usar em Pagamento
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* Section 2: Payments */}
        <section className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div>
              <h2 className="text-base font-semibold text-white">PAGAMENTOS & TRANSAÇÕES</h2>
              <p className="text-xs text-slate-400">Intenções de pagamento, status normalizados e testes de valor mínimo</p>
            </div>
            <button
              onClick={() => setIsPaymentModalOpen(true)}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition"
            >
              <Plus className="w-4 h-4" />
              Criar Pagamento
            </button>
          </div>

          <div className="mt-4 overflow-x-auto">
            {payments.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">Nenhum pagamento gerado no laboratório.</p>
            ) : (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-800/60 pb-2">
                    <th className="py-2">ID Lab</th>
                    <th className="py-2">ID PayGo</th>
                    <th className="py-2">Valor</th>
                    <th className="py-2">Método</th>
                    <th className="py-2">Status</th>
                    <th className="py-2">Cliente</th>
                    <th className="py-2">Data</th>
                    <th className="py-2 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {payments.map((pay) => (
                    <tr key={pay.id} className="hover:bg-slate-800/30">
                      <td className="py-2.5 font-mono text-slate-400">{pay.id.slice(0, 8)}...</td>
                      <td className="py-2.5 font-mono text-sky-400">{pay.paygoPaymentId || '-'}</td>
                      <td className="py-2.5 font-mono font-semibold text-white">{pay.amount} Kz</td>
                      <td className="py-2.5 uppercase font-mono text-slate-300">{pay.paymentMethod}</td>
                      <td className="py-2.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase ${
                            pay.status === 'COMPLETED'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : pay.status === 'PENDING'
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                              : pay.status === 'AMOUNT_MISMATCH'
                              ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                              : 'bg-slate-700 text-slate-300'
                          }`}
                        >
                          {pay.status}
                        </span>
                      </td>
                      <td className="py-2.5 text-slate-400">{pay.customerPhone}</td>
                      <td className="py-2.5 text-slate-500 font-mono">
                        {new Date(pay.createdAt).toLocaleTimeString()}
                      </td>
                      <td className="py-2.5 text-right flex items-center justify-end gap-2">
                        <button
                          onClick={() => setSelectedPayment(pay)}
                          className="text-slate-300 hover:text-white flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Detalhes
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* Section 3: Webhooks & Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <h2 className="text-base font-semibold text-white">WEBHOOKS (HMAC)</h2>
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700/50">
                <span className="text-xs text-slate-400">Recebidos</span>
                <p className="text-xl font-bold text-white mt-1">{webhookStats.received}</p>
              </div>
              <div className="bg-emerald-950/30 p-3 rounded-lg border border-emerald-800/40">
                <span className="text-xs text-emerald-400">Válidos</span>
                <p className="text-xl font-bold text-emerald-400 mt-1">{webhookStats.valid}</p>
              </div>
              <div className="bg-red-950/30 p-3 rounded-lg border border-red-800/40">
                <span className="text-xs text-red-400">Inválidos (401)</span>
                <p className="text-xl font-bold text-red-400 mt-1">{webhookStats.invalid}</p>
              </div>
              <div className="bg-amber-950/30 p-3 rounded-lg border border-amber-800/40">
                <span className="text-xs text-amber-400">Duplicados</span>
                <p className="text-xl font-bold text-amber-400 mt-1">{webhookStats.duplicate}</p>
              </div>
            </div>
            <p className="text-[11px] text-slate-500">
              Endpoint local: <code className="text-slate-300 bg-slate-800 px-1 py-0.5 rounded">POST /webhooks/paygo</code>
            </p>
          </div>

          <div className="md:col-span-2 bg-slate-900/50 border border-slate-800 rounded-xl p-5 shadow-sm">
            <h2 className="text-base font-semibold text-white mb-2">EVENTOS DE WEBHOOK RECENTES</h2>
            <div className="overflow-x-auto max-h-48 overflow-y-auto text-xs">
              {webhookEvents.length === 0 ? (
                <p className="text-slate-500 text-center py-6">Nenhum evento de webhook recebido ainda.</p>
              ) : (
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-slate-400 border-b border-slate-800/60 pb-2">
                      <th className="py-1.5">Assinatura</th>
                      <th className="py-1.5">Hash do Payload</th>
                      <th className="py-1.5">Processado</th>
                      <th className="py-1.5">Hora</th>
                      <th className="py-1.5 text-right">Ver</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/40">
                    {webhookEvents.slice(0, 5).map((ev) => (
                      <tr key={ev.id} className="hover:bg-slate-800/30">
                        <td className="py-2">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                              ev.signatureValid
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : 'bg-red-500/20 text-red-400'
                            }`}
                          >
                            {ev.signatureValid ? 'VÁLIDA' : 'INVÁLIDA'}
                          </span>
                        </td>
                        <td className="py-2 font-mono text-slate-400">{ev.eventHash.slice(0, 10)}...</td>
                        <td className="py-2 text-slate-300">{ev.processed ? 'Sim' : 'Não'}</td>
                        <td className="py-2 text-slate-500 font-mono">
                          {new Date(ev.createdAt).toLocaleTimeString()}
                        </td>
                        <td className="py-2 text-right">
                          <button
                            onClick={() => setSelectedWebhook(ev)}
                            className="text-sky-400 hover:text-sky-300"
                          >
                            Payload
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* Section 4: API Request Logs */}
        <section className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h2 className="text-base font-semibold text-white">LOGS DE REQUISIÇÕES (OBSERVABILIDADE)</h2>
              <p className="text-xs text-slate-400">Auditoria completa de chamadas à PayGo com sanitização de segredos e PII</p>
            </div>
            <span className="text-xs font-mono text-slate-400">{logs.length} requisições registradas</span>
          </div>

          <div className="mt-3 overflow-x-auto max-h-64 overflow-y-auto">
            {logs.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">Nenhum log registrado.</p>
            ) : (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-800/60 pb-2">
                    <th className="py-1.5">Request ID</th>
                    <th className="py-1.5">Método</th>
                    <th className="py-1.5">Endpoint</th>
                    <th className="py-1.5">Status HTTP</th>
                    <th className="py-1.5">Duração</th>
                    <th className="py-1.5">Hora</th>
                    <th className="py-1.5 text-right">Detalhe</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-800/30 font-mono">
                      <td className="py-2 text-slate-300">{log.requestId}</td>
                      <td className="py-2 font-bold text-sky-400">{log.method}</td>
                      <td className="py-2 text-slate-200">{log.endpoint}</td>
                      <td className="py-2">
                        <span
                          className={`font-semibold ${
                            log.httpStatus >= 200 && log.httpStatus < 300
                              ? 'text-emerald-400'
                              : log.httpStatus >= 400
                              ? 'text-red-400'
                              : 'text-amber-400'
                          }`}
                        >
                          {log.httpStatus}
                        </span>
                      </td>
                      <td className="py-2 text-slate-400">{log.durationMs}ms</td>
                      <td className="py-2 text-slate-500">{new Date(log.createdAt).toLocaleTimeString()}</td>
                      <td className="py-2 text-right">
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="text-sky-400 hover:underline"
                        >
                          Inspecionar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </main>

      {/* Modal: Criar Produto */}
      {isProductModalOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-md w-full space-y-4">
            <h3 className="text-lg font-bold text-white">Criar Produto de Teste</h3>
            <div className="bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs p-3 rounded-lg">
              <strong>Aviso:</strong> Confirme o valor antes de criar uma transação real. A PayGo pode aplicar limites mínimos ou outras regras.
            </div>

            <form onSubmit={handleCreateProduct} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 mb-1">Nome do Produto</label>
                <input
                  type="text"
                  required
                  value={productForm.name}
                  onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Preço em Kwanzas (Kz)</label>
                <input
                  type="number"
                  required
                  min="1"
                  step="any"
                  value={productForm.price}
                  onChange={(e) => setProductForm({ ...productForm, price: Number(e.target.value) })}
                  className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1">URL pública de retorno após pagamento</label>
                <input
                  type="url"
                  required
                  value={productForm.thank_you_url}
                  onChange={(e) => setProductForm({ ...productForm, thank_you_url: e.target.value })}
                  placeholder="https://exemplo.ao/obrigado"
                  className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white"
                />
              </div>

              <div className="flex items-center gap-4 pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={productForm.payment_multicaixa}
                    onChange={(e) => setProductForm({ ...productForm, payment_multicaixa: e.target.checked })}
                    className="rounded"
                  />
                  <span>Multicaixa Express</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={productForm.payment_reference}
                    onChange={(e) => setProductForm({ ...productForm, payment_reference: e.target.checked })}
                    className="rounded"
                  />
                  <span>Referência</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setIsProductModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded text-slate-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-500 rounded text-white font-semibold disabled:opacity-50"
                >
                  {loading ? 'Criando...' : 'Confirmar e Criar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Criar Pagamento */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-md w-full space-y-4">
            <h3 className="text-lg font-bold text-white">Criar Pagamento de Teste</h3>
            <p className="text-xs text-slate-400">
              Dispara a criação de pagamento no Lab e na PayGo respeitando idempotência.
            </p>

            <form onSubmit={handleCreatePaymentSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 mb-1">Produto</label>
                <select
                  required
                  value={paymentForm.product_id}
                  onChange={(e) => setPaymentForm({ ...paymentForm, product_id: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white font-mono"
                >
                  <option value="">Selecione um produto</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.paygoProductId}>
                      {p.name} - {p.price} Kz ({p.paygoProductId})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Método de Pagamento</label>
                <select
                  value={paymentForm.payment_method}
                  onChange={(e) => setPaymentForm({ ...paymentForm, payment_method: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white"
                >
                  <option value="multicaixa">Multicaixa Express</option>
                  <option value="reference">Pagamento por Referência</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Nome do Cliente</label>
                <input
                  type="text"
                  required
                  value={paymentForm.customer_name}
                  onChange={(e) => setPaymentForm({ ...paymentForm, customer_name: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Email do Cliente</label>
                <input
                  type="email"
                  required
                  value={paymentForm.customer_email}
                  onChange={(e) => setPaymentForm({ ...paymentForm, customer_email: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Telefone do Cliente (9 dígitos)</label>
                <input
                  type="text"
                  required
                  value={paymentForm.customer_phone}
                  onChange={(e) => setPaymentForm({ ...paymentForm, customer_phone: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded text-slate-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded text-white font-semibold disabled:opacity-50"
                >
                  {loading ? 'Processando...' : 'Criar Pagamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Live Payment Confirmation Warning */}
      {isLiveConfirmOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-red-950 border-2 border-red-600 rounded-xl p-6 max-w-md w-full space-y-4 text-white">
            <div className="flex items-center gap-3 text-red-400">
              <ShieldAlert className="w-8 h-8" />
              <h3 className="text-lg font-bold">Confirmação de Transação Real</h3>
            </div>
            <p className="text-sm">
              Você está prestes a criar uma transação real na PayGo.
            </p>
            <div className="bg-black/40 p-3 rounded text-xs font-mono space-y-1">
              <p>Método: {paymentForm.payment_method}</p>
              <p>Telefone: {paymentForm.customer_phone}</p>
            </div>
            <p className="text-xs text-red-300">
              Esta ação enviará uma notificação bancária real ou gerará uma referência Multicaixa válida.
            </p>
            <div className="flex justify-end gap-3 pt-3">
              <button
                onClick={() => setIsLiveConfirmOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded text-white text-xs font-semibold"
              >
                CANCELAR
              </button>
              <button
                onClick={() => executePaymentCreation(true)}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded text-white text-xs font-semibold"
              >
                CONFIRMAR E PAGAR
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Detalhes do Pagamento */}
      {selectedPayment && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-2xl w-full space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Detalhes do Pagamento</h3>
              <span
                className={`px-2 py-0.5 rounded text-xs font-semibold uppercase ${
                  selectedPayment.status === 'COMPLETED'
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-amber-500/20 text-amber-400'
                }`}
              >
                {selectedPayment.status}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs font-mono bg-slate-800/40 p-4 rounded-lg">
              <div>
                <span className="text-slate-500 block">ID Interno Lab:</span>
                <span className="text-slate-200">{selectedPayment.id}</span>
              </div>
              <div>
                <span className="text-slate-500 block">PayGo Payment ID:</span>
                <span className="text-sky-400">{selectedPayment.paygoPaymentId || 'Nenhum'}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Valor:</span>
                <span className="text-emerald-400 font-bold">{selectedPayment.amount} Kz</span>
              </div>
              <div>
                <span className="text-slate-500 block">Método:</span>
                <span className="text-slate-200 uppercase">{selectedPayment.paymentMethod}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Cliente:</span>
                <span className="text-slate-200">{selectedPayment.customerName} ({selectedPayment.customerPhone})</span>
              </div>
              <div>
                <span className="text-slate-500 block">Criado em:</span>
                <span className="text-slate-200">{new Date(selectedPayment.createdAt).toLocaleString()}</span>
              </div>
            </div>

            {/* Action button */}
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => handleQueryStatus(selectedPayment.id)}
                disabled={loading || !selectedPayment.paygoPaymentId}
                className="flex items-center gap-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                Consultar PayGo Agora
              </button>
              <button
                onClick={() => setSelectedPayment(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg"
              >
                Fechar
              </button>
            </div>

            {/* Raw Response Display */}
            {selectedPayment.rawPaygoResponse && (
              <div className="pt-2">
                <span className="text-xs text-slate-400 block mb-1">Raw PayGo Response (Sanitizado):</span>
                <pre className="bg-slate-950 p-3 rounded-lg text-[11px] font-mono text-slate-300 overflow-x-auto max-h-48">
                  {typeof selectedPayment.rawPaygoResponse === 'string'
                    ? selectedPayment.rawPaygoResponse
                    : JSON.stringify(selectedPayment.rawPaygoResponse, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: Inspecionar Log */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-2xl w-full space-y-4">
            <h3 className="text-lg font-bold text-white">Inspeção de Requisição: {selectedLog.requestId}</h3>
            <div className="text-xs font-mono space-y-2">
              <div className="flex gap-4">
                <span>Método: <strong>{selectedLog.method}</strong></span>
                <span>Endpoint: <strong>{selectedLog.endpoint}</strong></span>
                <span>Status: <strong>{selectedLog.httpStatus}</strong></span>
                <span>Duração: <strong>{selectedLog.durationMs}ms</strong></span>
              </div>
              <div>
                <span className="text-slate-400 block mt-2">Request Sanitizado:</span>
                <pre className="bg-slate-950 p-3 rounded text-[11px] overflow-x-auto max-h-36">
                  {selectedLog.sanitizedRequest}
                </pre>
              </div>
              <div>
                <span className="text-slate-400 block mt-2">Response Sanitizado:</span>
                <pre className="bg-slate-950 p-3 rounded text-[11px] overflow-x-auto max-h-36">
                  {selectedLog.sanitizedResponse}
                </pre>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Ver Webhook */}
      {selectedWebhook && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-xl w-full space-y-4">
            <h3 className="text-lg font-bold text-white">Payload do Webhook</h3>
            <pre className="bg-slate-950 p-4 rounded text-xs font-mono overflow-x-auto max-h-64 text-slate-300">
              {selectedWebhook.payload}
            </pre>
            <div className="flex justify-end">
              <button
                onClick={() => setSelectedWebhook(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
