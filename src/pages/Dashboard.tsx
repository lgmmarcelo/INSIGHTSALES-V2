import { useState, useEffect, useMemo } from 'react';
import { collection, query, getDocs, limit, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { differenceInDays, parseDateLocal } from '../lib/utils';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList, Cell } from 'recharts';

const EMPREENDIMENTO_DICT: Record<string, string> = {
  "ALTOS DA BORGES": "ALTOS DA BORGES",
  "ALTOS DA BORGES - 1 SEMANA": "ALTOS DA BORGES",
  "CHATEAU DU GOLDEN I": "CHATEAU",
  "CHATEAU DU GOLDEN II": "CHATEAU",
  "CHATEAU DU GOLDEN I T": "CHATEAU",
  "CHATEAU DU GOLDEN II T": "CHATEAU",
  "CONDOMINIO ASA DELTA": "CHATEAU",
  "CONDOMINIO ATHIVABRASILX": "STILO BORGES",
  "CONDOMINIO GVP PARTICIPAÇÕES": "VILLAGIO",
  "CONDOMINIO RISERVA DOS VINHEDOS": "RISERVA",
  "GOLDEN GRAMADO RESORT LAGHETTO": "GOLDEN",
  "GOLDEN GRAMADO RESORT LAGHETTO - T": "GOLDEN",
  "GOLDEN VILLAGIO LAGHETTO": "VILLAGIO"
};

const normalizeEmpreendimento = (raw: string) => {
  const upper = (raw || '').trim().toUpperCase();
  return EMPREENDIMENTO_DICT[upper] || upper || 'NÃO ESPECIFICADO';
};

export default function Dashboard() {
  const [rawSales, setRawSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Date filtering state
  const [monthSelection, setMonthSelection] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [empreendimentoFilter, setEmpreendimentoFilter] = useState('all');

  useEffect(() => {
    if (monthSelection) {
      const [year, month] = monthSelection.split('-');
      const firstDay = `${year}-${month}-01`;
      const lastDayDate = new Date(parseInt(year), parseInt(month), 0);
      const lastDay = `${year}-${month}-${String(lastDayDate.getDate()).padStart(2, '0')}`;
      setStartDate(firstDay);
      setEndDate(lastDay);
    }
  }, [monthSelection]);

  const handleStartDateChange = (val: string) => {
    setStartDate(val);
    setMonthSelection(''); // clear month shortcut if manual edit
  };

  const handleEndDateChange = (val: string) => {
    setEndDate(val);
    setMonthSelection(''); // clear month shortcut if manual edit
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'sales'));
      const querySnapshot = await getDocs(q);
      const data: any[] = [];
      querySnapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() });
      });
      // Filter is handled by upload phase - all incoming data is valid contracts
      setRawSales(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const availableEmpreendimentos = useMemo(() => {
    const set = new Set<string>();
    rawSales.forEach(s => {
      const e = normalizeEmpreendimento(s.empreendimento);
      if (e && e !== 'NÃO ESPECIFICADO') set.add(e);
    });
    return Array.from(set).sort();
  }, [rawSales]);

  // Filter logic
  const sales = useMemo(() => {
    return rawSales.filter(sale => {
      // Date filter
      const saleDate = parseDateLocal(sale.dataAtendimento);
      const startObj = startDate ? new Date(startDate + 'T00:00:00') : null;
      const endObj = endDate ? new Date(endDate + 'T23:59:59') : null;

      if ((startDate || endDate) && !saleDate) return false;
      if (startObj && saleDate && saleDate < startObj) return false;
      if (endObj && saleDate && saleDate > endObj) return false;

      // Empreendimento filter
      const saleEmp = normalizeEmpreendimento(sale.empreendimento);
      if (empreendimentoFilter !== 'all' && saleEmp !== empreendimentoFilter) return false;

      return true;
    });
  }, [rawSales, startDate, endDate, empreendimentoFilter]);

  const calculateKPIs = () => {
    let cancel7 = 0;
    let cancel30 = 0;
    let cancelOver30 = 0;
    let totalCotasVendidas = sales.length; 
    let retained = 0;
    let totalSales = sales.length;
    let totalFaturamento = 0;
    
    // Map to track behavior per buyer
    const buyerMap: Record<string, { total: number; canceladas: number; retidas: number; c7: boolean; c30: boolean; cOver30: boolean }> = {};

    sales.forEach(sale => {
      totalFaturamento += (sale.valor || 0);
      
      const buyerIdentifier = (sale.cpf || sale.cliente || `desconhecido-${Math.random()}`).trim().toUpperCase();
      
      if (!buyerMap[buyerIdentifier]) {
          buyerMap[buyerIdentifier] = { total: 0, canceladas: 0, retidas: 0, c7: false, c30: false, cOver30: false };
      }
      
      buyerMap[buyerIdentifier].total++;

      const isCanceled = !!sale.dataCancelamento;

      if (!isCanceled) {
         retained++;
         buyerMap[buyerIdentifier].retidas++;
      } else {
        buyerMap[buyerIdentifier].canceladas++;

        const dAtendimento = parseDateLocal(sale.dataAtendimento);
        const dCancelamento = parseDateLocal(sale.dataCancelamento);
        
        if (dAtendimento && dCancelamento) {
          const diff = differenceInDays(dCancelamento, dAtendimento);
          
          if (diff <= 7) { cancel7++; buyerMap[buyerIdentifier].c7 = true; }
          else if (diff <= 30) { cancel30++; buyerMap[buyerIdentifier].c30 = true; }
          else { cancelOver30++; buyerMap[buyerIdentifier].cOver30 = true; }
        }
      }
    });

    let clientesCancelaramTudo = 0;
    let clientesCancelaramParcial = 0;
    
    let buyersCanceled7 = 0;
    let buyersCanceled30 = 0;
    let buyersCanceledOver30 = 0;

    Object.values(buyerMap).forEach(buyer => {
       if (buyer.canceladas === buyer.total && buyer.canceladas > 0) {
           clientesCancelaramTudo++;
       } else if (buyer.canceladas > 0 && buyer.retidas > 0) {
           clientesCancelaramParcial++;
       }
       
       if (buyer.c7) buyersCanceled7++;
       if (buyer.c30) buyersCanceled30++;
       if (buyer.cOver30) buyersCanceledOver30++;
    });

    const clientesComCancelamento = clientesCancelaramTudo + clientesCancelaramParcial;
    const clientesCompradores = Object.keys(buyerMap).length;

    return { 
      cancel7, cancel30, cancelOver30, totalCotasVendidas, retained, totalSales, totalFaturamento, 
      clientesCompradores, clientesComCancelamento, clientesCancelaramTudo, clientesCancelaramParcial,
      buyersCanceled7, buyersCanceled30, buyersCanceledOver30
    };
  };

  const kpis = calculateKPIs();

  // Overall Global Cancellation Variables
  const totalCanceledQuotas = kpis.totalCotasVendidas - kpis.retained;
  const percGlobalCancelBrutas = kpis.totalCotasVendidas > 0 ? ((totalCanceledQuotas / kpis.totalCotasVendidas) * 100).toFixed(1) : '0.0';
  const percGlobalCancelCompradores = kpis.clientesCompradores > 0 ? ((kpis.clientesCancelaramTudo / kpis.clientesCompradores) * 100).toFixed(1) : '0.0';

  // Helper values for percentages
  // Calculated dynamically per block so it represents the true value of that block
  const perc7Brutas = kpis.totalCotasVendidas > 0 ? ((kpis.cancel7 / kpis.totalCotasVendidas) * 100).toFixed(1) : '0.0';
  const perc7Compradores = kpis.clientesCompradores > 0 ? ((kpis.buyersCanceled7 / kpis.clientesCompradores) * 100).toFixed(1) : '0.0';

  const perc30Brutas = kpis.totalCotasVendidas > 0 ? ((kpis.cancel30 / kpis.totalCotasVendidas) * 100).toFixed(1) : '0.0';
  const perc30Compradores = kpis.clientesCompradores > 0 ? ((kpis.buyersCanceled30 / kpis.clientesCompradores) * 100).toFixed(1) : '0.0';

  const percOver30Brutas = kpis.totalCotasVendidas > 0 ? ((kpis.cancelOver30 / kpis.totalCotasVendidas) * 100).toFixed(1) : '0.0';
  const percOver30Compradores = kpis.clientesCompradores > 0 ? ((kpis.buyersCanceledOver30 / kpis.clientesCompradores) * 100).toFixed(1) : '0.0';

  const percRetainedBrutas = kpis.totalCotasVendidas > 0 ? ((kpis.retained / kpis.totalCotasVendidas) * 100).toFixed(1) : '0.0';
  const percRetainedCompradores = kpis.clientesCompradores > 0 ? (((kpis.clientesCompradores - kpis.clientesCancelaramTudo) / kpis.clientesCompradores) * 100).toFixed(1) : '0.0';

  const chartData = (() => {
    const dailyMap: Record<string, { totalVendas: number; totalCanceladas: number }> = {};
    for(let i=1; i<=31; i++) {
        dailyMap[i.toString()] = { totalVendas: 0, totalCanceladas: 0 };
    }
    sales.forEach(sale => {
      const parts = String(sale.dataAtendimento || '').split('/');
      if (parts.length === 3) {
        const day = parseInt(parts[0], 10).toString();
        if (dailyMap[day]) {
            dailyMap[day].totalVendas++;
            if (sale.dataCancelamento) {
                dailyMap[day].totalCanceladas++;
            }
        }
      }
    });

    return Object.keys(dailyMap).map(day => {
      const metrics = dailyMap[day];
      const perc = metrics.totalVendas > 0 ? (metrics.totalCanceladas / metrics.totalVendas) * 100 : 0;
      return {
        day,
        percentage: parseFloat(perc.toFixed(1)),
        isToday: day === new Date().getDate().toString(),
        totalVendas: metrics.totalVendas,
        totalCanceladas: metrics.totalCanceladas,
      };
    });
  })();

  return (
    <div className="flex-1 flex flex-col p-5 gap-5 overflow-y-auto font-sans">
      {/* Filter Bar */}
      <div className="flex items-center justify-between bg-white p-4 border border-slate-200 rounded-lg shrink-0 shadow-sm flex-wrap gap-4">
        
        <div className="flex gap-6 items-center flex-wrap">
          <div className="flex flex-col">
            <label className="text-[10px] uppercase text-sky-700 font-bold tracking-wider mb-1">Mês de Análise</label>
            <input 
              type="month" 
              value={monthSelection}
              onChange={(e) => setMonthSelection(e.target.value)}
              className="text-sm border border-slate-200 rounded-md px-2 py-1.5 focus:outline-none focus:border-sky-400 font-semibold text-slate-700 w-36 shadow-sm" 
            />
          </div>

          <div className="h-[30px] w-[1px] bg-slate-200 hidden md:block"></div>

          <div className="flex flex-col">
            <label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider mb-1">Período de Atendimento (Ínicio/Fim)</label>
            <div className="flex items-center gap-2">
              <input 
                type="date" 
                value={startDate}
                onChange={(e) => handleStartDateChange(e.target.value)}
                className="text-sm border border-slate-200 rounded-md px-2 py-1.5 focus:outline-none focus:border-slate-400 text-slate-600 shadow-sm" 
              />
              <span className="text-slate-400 text-sm">até</span>
              <input 
                type="date" 
                value={endDate}
                onChange={(e) => handleEndDateChange(e.target.value)}
                className="text-sm border border-slate-200 rounded-md px-2 py-1.5 focus:outline-none focus:border-slate-400 text-slate-600 shadow-sm" 
              />
            </div>
          </div>
          
          <div className="h-[30px] w-[1px] bg-slate-200 hidden md:block"></div>

          <div className="flex flex-col">
            <label className="text-[10px] uppercase text-indigo-700 font-bold tracking-wider mb-1">Empreendimento (Produto)</label>
            <select 
              value={empreendimentoFilter}
              onChange={(e) => setEmpreendimentoFilter(e.target.value)}
              className="text-sm border border-slate-200 rounded-md px-2 py-1.5 focus:outline-none focus:border-indigo-400 text-indigo-700 shadow-sm font-semibold min-w-[200px]"
            >
               <option value="all">Todos os Empreendimentos</option>
               {availableEmpreendimentos.map(emp => (
                 <option key={emp} value={emp}>{emp}</option>
               ))}
            </select>
          </div>
        </div>

        <div className="flex gap-2 items-center">
            {loading && <span className="text-xs text-slate-400 font-semibold animate-pulse mr-2">Carregando dados...</span>}
            <span className="bg-sky-100 text-sky-700 px-3 py-1.5 rounded-md text-[11px] font-bold">Vendas Analisadas: {sales.length}</span>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-4 shrink-0">
        
        {/* Faturamento (moved left for flow) */}
        <div className="bg-sky-50 border border-sky-100 p-4 rounded-lg shadow-sm flex flex-col justify-between">
          <div className="text-[11px] uppercase text-sky-700 font-semibold tracking-wider">Faturamento (VGV)</div>
          <div className="text-xl xl:text-2xl font-bold mt-2 text-sky-900" style={{ letterSpacing: '-0.5px' }}>
             {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(kpis.totalFaturamento)}
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-4 rounded-lg shadow-sm flex flex-col justify-between">
          <div className="text-[11px] uppercase text-slate-500 font-semibold tracking-wider mb-2">Vendas Brutas</div>
          <div className="text-3xl font-bold text-slate-700 mb-4">{kpis.totalCotasVendidas}</div>
          <div className="flex gap-2 w-full mt-auto">
             <div className="flex-1 bg-rose-50 border border-rose-100/50 rounded p-2 flex flex-col" title="Cancelamento Global / Vendas Brutas">
                <span className="text-[9px] uppercase font-semibold text-rose-500/70 leading-none mb-1">Canc. Cotas</span>
                <span className="text-sm font-bold text-rose-600 leading-none">{percGlobalCancelBrutas}%</span>
             </div>
             <div className="flex-1 bg-rose-50 border border-rose-100/50 rounded p-2 flex flex-col" title="Cancelamento Global / Compradores (Pediram Saída)">
                <span className="text-[9px] uppercase font-semibold text-rose-500/70 leading-none mb-1">Canc. Clientes</span>
                <span className="text-sm font-bold text-rose-600 leading-none">{percGlobalCancelCompradores}%</span>
             </div>
          </div>
        </div>

        <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-lg shadow-sm flex flex-col justify-between">
          <div className="text-[11px] uppercase text-emerald-700 font-semibold tracking-wider mb-2">Vendas Líquidas</div>
          <div className="text-3xl font-bold text-emerald-600 mb-4">{kpis.retained}</div>
          <div className="flex gap-2 w-full mt-auto">
             <div className="flex-1 bg-emerald-100/50 border border-emerald-200/50 rounded p-2 flex flex-col">
                <span className="text-[9px] uppercase font-semibold text-emerald-600/70 leading-none mb-1">Retenção Cotas</span>
                <span className="text-sm font-bold text-emerald-700 leading-none">{percRetainedBrutas}%</span>
             </div>
             <div className="flex-1 bg-emerald-100/50 border border-emerald-200/50 rounded p-2 flex flex-col">
                <span className="text-[9px] uppercase font-semibold text-emerald-600/70 leading-none mb-1">Retenção Clientes</span>
                <span className="text-sm font-bold text-emerald-700 leading-none">{percRetainedCompradores}%</span>
             </div>
          </div>
        </div>

        {/* Detailed Compradores Card (Span 2) */}
        <div className="xl:col-span-2 bg-indigo-50 border border-indigo-100 p-4 rounded-lg shadow-sm flex flex-col justify-between">
          <div className="text-[11px] uppercase text-indigo-700 font-semibold tracking-wider mb-2">Compradores (CPFs)</div>
          <div className="text-3xl font-bold text-indigo-900 mb-4">{kpis.clientesCompradores}</div>
          <div className="flex gap-2 w-full mt-auto">
             <div className="flex-1 bg-indigo-100/50 border border-indigo-200/50 rounded p-2 flex flex-col">
                <span className="text-[9px] uppercase font-semibold text-indigo-600/70 leading-none mb-1" title="Cancelaram Totalmente">Pediram Saída</span>
                <span className="text-sm font-bold text-indigo-700 leading-none">{kpis.clientesCancelaramTudo}</span>
             </div>
             <div className="flex-1 bg-indigo-100/50 border border-indigo-200/50 rounded p-2 flex flex-col">
                <span className="text-[9px] uppercase font-semibold text-indigo-600/70 leading-none mb-1" title="Cancelaram Parcialmente">Canc. Parcial</span>
                <span className="text-sm font-bold text-indigo-700 leading-none">{kpis.clientesCancelaramParcial}</span>
             </div>
             <div className="flex-1 bg-indigo-100/50 border border-indigo-200/50 rounded p-2 flex flex-col">
                <span className="text-[9px] uppercase font-semibold text-indigo-600/70 leading-none mb-1">Evadiram</span>
                <span className="text-sm font-bold text-indigo-700 leading-none">{kpis.clientesCompradores > 0 ? ((kpis.clientesCancelaramTudo / kpis.clientesCompradores)*100).toFixed(1) : '0.0'}%</span>
             </div>
          </div>
        </div>

        {/* Cancellation KPI's with metrics overlay */}
        <div className="bg-white border border-slate-200 p-4 rounded-lg shadow-sm flex flex-col justify-between">
          <div className="text-[11px] uppercase text-slate-500 font-semibold tracking-wider mb-2">Cancel. (até 7 dias)</div>
          <div className="text-3xl font-bold text-red-500 mb-4">{kpis.cancel7}</div>
          <div className="flex gap-2 w-full mt-auto">
             <div className="flex-1 bg-slate-50 border border-slate-100 rounded p-2 flex flex-col">
                <span className="text-[10px] uppercase font-semibold text-slate-400 leading-none mb-1">/ Brutas</span>
                <span className="text-sm font-bold text-slate-700 leading-none">{perc7Brutas}%</span>
             </div>
             <div className="flex-1 bg-slate-50 border border-slate-100 rounded p-2 flex flex-col">
                <span className="text-[10px] uppercase font-semibold text-slate-400 leading-none mb-1">/ Compr.</span>
                <span className="text-sm font-bold text-slate-700 leading-none">{perc7Compradores}%</span>
             </div>
          </div>
        </div>
        
        <div className="bg-white border border-slate-200 p-4 rounded-lg shadow-sm flex flex-col justify-between">
          <div className="text-[11px] uppercase text-slate-500 font-semibold tracking-wider mb-2">Cancel. (8-30 dias)</div>
          <div className="text-3xl font-bold text-amber-500 mb-4">{kpis.cancel30}</div>
          <div className="flex gap-2 w-full mt-auto">
             <div className="flex-1 bg-slate-50 border border-slate-100 rounded p-2 flex flex-col">
                <span className="text-[10px] uppercase font-semibold text-slate-400 leading-none mb-1">/ Brutas</span>
                <span className="text-sm font-bold text-slate-700 leading-none">{perc30Brutas}%</span>
             </div>
             <div className="flex-1 bg-slate-50 border border-slate-100 rounded p-2 flex flex-col">
                <span className="text-[10px] uppercase font-semibold text-slate-400 leading-none mb-1">/ Compr.</span>
                <span className="text-sm font-bold text-slate-700 leading-none">{perc30Compradores}%</span>
             </div>
          </div>
        </div>
        
        <div className="bg-white border border-slate-200 p-4 rounded-lg shadow-sm flex flex-col justify-between">
          <div className="text-[11px] uppercase text-slate-500 font-semibold tracking-wider mb-2">Cancel. (+30 dias)</div>
          <div className="text-3xl font-bold text-orange-600 mb-4">{kpis.cancelOver30}</div>
          <div className="flex gap-2 w-full mt-auto">
             <div className="flex-1 bg-slate-50 border border-slate-100 rounded p-2 flex flex-col">
                <span className="text-[10px] uppercase font-semibold text-slate-400 leading-none mb-1">/ Brutas</span>
                <span className="text-sm font-bold text-slate-700 leading-none">{percOver30Brutas}%</span>
             </div>
             <div className="flex-1 bg-slate-50 border border-slate-100 rounded p-2 flex flex-col">
                <span className="text-[10px] uppercase font-semibold text-slate-400 leading-none mb-1">/ Compr.</span>
                <span className="text-sm font-bold text-slate-700 leading-none">{percOver30Compradores}%</span>
             </div>
          </div>
        </div>

      </div>

      {/* Analytics Charts Grid */}
      <div className="grid grid-cols-1 gap-5 shrink-0">
         {/* Cancelation Volumn Chart */}
        <div className="bg-white p-5 border border-slate-200 rounded-lg shadow-sm flex flex-col h-80">
          <div className="flex justify-between items-center mb-4">
             <h2 className="text-sm font-bold uppercase text-slate-700">Cotadas Vendidas x Canceladas</h2>
              <div className="text-xs font-semibold px-2 py-1 bg-slate-100 rounded text-slate-600">
               Total Bruto Diário
             </div>
          </div>
          <div className="flex-1 w-full min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip cursor={{ fill: '#f1f5f9' }} />
                <Bar dataKey="totalVendas" name="Vendidas" fill="#1e3a8a" radius={[2, 2, 0, 0]}>
                   <LabelList dataKey="totalVendas" position="top" formatter={(val: number) => val > 0 ? val : ''} style={{ fontSize: '10px', fill: '#475569', fontWeight: 600 }} />
                </Bar>
                <Bar dataKey="totalCanceladas" name="Canceladas" fill="#ef4444" radius={[2, 2, 0, 0]}>
                   <LabelList dataKey="totalCanceladas" position="top" formatter={(val: number) => val > 0 ? val : ''} style={{ fontSize: '10px', fill: '#475569', fontWeight: 600 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Cancelation % Chart */}
        <div className="bg-white p-5 border border-slate-200 rounded-lg shadow-sm flex flex-col h-80">
          <div className="flex justify-between items-center mb-4">
             <h2 className="text-sm font-bold uppercase text-slate-700">Taxa de Cancelamento (%)</h2>
              <div className="text-xs font-semibold px-2 py-1 bg-slate-100 rounded text-slate-600">
               Volumetria
             </div>
          </div>
          <div className="flex-1 w-full min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(val) => `${val}%`} />
                <Tooltip cursor={{ fill: '#f1f5f9' }} formatter={(val: number) => [`${val}%`, 'Taxa']} />
                <Bar dataKey="percentage" name="Cancelamento (%)" fill="#64748b" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.isToday ? '#f97316' : '#94a3b8'} />
                  ))}
                  <LabelList dataKey="percentage" position="top" formatter={(val: number) => val > 0 ? `${val}%` : ''} style={{ fontSize: '10px', fill: '#475569', fontWeight: 600 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
