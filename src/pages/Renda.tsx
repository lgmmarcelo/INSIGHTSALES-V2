import { useState, useEffect, useMemo } from 'react';
import { db } from '../lib/firebase';
import { parseDateLocal } from '../lib/utils';
import { Wallet, XCircle } from 'lucide-react';
import { differenceInDays } from 'date-fns';
import { Sale } from '../types';
import { useSalesData } from '../hooks/useSalesData';

import { SkeletonTable } from '../components/ui/SkeletonTable';

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

interface RendaStats {
  faixa: string;
  brutas: number;
  cancelamentos: number;
  order: number;
}

const faixasRenda = [
  { label: 'Entre R$ 0 e R$ 4.999', min: 0, max: 4999.99, order: 1 },
  { label: 'Entre R$ 5.000 e R$ 9.999', min: 5000, max: 9999.99, order: 2 },
  { label: 'Entre R$ 10.000 e R$ 10.999', min: 10000, max: 10999.99, order: 3 },
  { label: 'Entre R$ 11.000 e R$ 15.999', min: 11000, max: 15999.99, order: 4 },
  { label: 'Entre R$ 16.000 e R$ 20.999', min: 16000, max: 20999.99, order: 5 },
  { label: 'Entre R$ 21.000 e R$ 29.999', min: 21000, max: 29999.99, order: 6 },
  { label: 'Acima de R$ 30.000', min: 30000, max: Infinity, order: 7 },
  { label: 'Não Informada', min: -1, max: -1, order: 8 }
];

function getFaixaRenda(rendaValue: any): { label: string, order: number } {
  if (rendaValue === null || rendaValue === undefined || String(rendaValue).trim() === '') {
      return { label: 'Não Informada', order: 8 };
  }
  
  let str = String(rendaValue).trim();
  // Remove R$ and all spaces
  str = str.replace(/[R$\s]/gi, '');
  
  if (str.includes(',') && str.includes('.')) {
      str = str.replace(/\./g, '').replace(',', '.');
  } else if (str.includes(',')) {
      str = str.replace(',', '.');
  } else if (str.includes('.')) {
      // If there's a dot, check if it's a decimal separator like "1200.50"
      const parts = str.split('.');
      const lastPart = parts[parts.length - 1];
      if (lastPart.length === 2 || lastPart.length === 1) {
          // If it ends exactly with 1 or 2 digits after the last dot, assume decimal (eg: 15.5 or 15.50)
          if (parts.length > 2) {
             // multiple dots like 1.500.20 -> invalid or weird, just strip first ones
             str = parts.slice(0, -1).join('') + '.' + lastPart;
          }
      } else {
          // It's likely a thousands separator, e.g. "14.000"
          str = str.replace(/\./g, '');
      }
  }
  
  const parsed = parseFloat(str);
  if (isNaN(parsed) || parsed < 0) {
      return { label: 'Não Informada', order: 8 };
  }

  for (const faixa of faixasRenda) {
      if (parsed >= faixa.min && parsed <= faixa.max && faixa.label !== 'Não Informada') {
          return { label: faixa.label, order: faixa.order };
      }
  }

  return { label: 'Não Informada', order: 8 };
}

export default function Renda() {
  // Date filtering state
  const [monthSelection, setMonthSelection] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [cancelFilter, setCancelFilter] = useState<'all' | '7' | '30' | '31+'>('all');
  const [empreendimentoFilter, setEmpreendimentoFilter] = useState('all');

  const { rawSales, loading } = useSalesData(startDate, endDate);

  useEffect(() => {
    if (monthSelection) {
      const [year, month] = monthSelection.split('-');
      const firstDay = `${year}-${month}-01`;
      const lastDay = `${year}-${month}-31`;
      setStartDate(firstDay);
      setEndDate(lastDay);
    }
  }, [monthSelection]);

  const handleStartDateChange = (val: string) => {
    setStartDate(val);
    setMonthSelection('');
  };

  const handleEndDateChange = (val: string) => {
    setEndDate(val);
    setMonthSelection('');
  };

  const availableEmpreendimentos = useMemo(() => {
    const set = new Set<string>();
    rawSales.forEach(s => {
      const e = normalizeEmpreendimento(s.empreendimento);
      if (e && e !== 'NÃO ESPECIFICADO') set.add(e);
    });
    return Array.from(set).sort();
  }, [rawSales]);

  // Filter and Group Data
  const groupedData = useMemo(() => {
    const map: Record<string, RendaStats> = {};

    rawSales.forEach(sale => {
      // Date Filter
      if (startDate && (!sale.dataAtendimentoIso || sale.dataAtendimentoIso < startDate)) return;
      if (endDate && (!sale.dataAtendimentoIso || sale.dataAtendimentoIso > endDate)) return;

      // Empreendimento filter
      const saleEmp = normalizeEmpreendimento(sale.empreendimento);
      if (empreendimentoFilter !== 'all' && saleEmp !== empreendimentoFilter) return;

      const { label: faixaRenda, order } = getFaixaRenda(sale.renda);
      
      let includesCancellation = false;
      const isCanceledRaw = !!sale.dataCancelamento;
      
      if (isCanceledRaw) {
         if (cancelFilter === 'all') {
             includesCancellation = true;
         } else {
             const dAtendimento = parseDateLocal(sale.dataAtendimento);
             const dCancelamento = parseDateLocal(sale.dataCancelamento);
             if (dAtendimento && dCancelamento) {
                 const diff = differenceInDays(dCancelamento, dAtendimento);
                 if (cancelFilter === '7' && diff <= 7) includesCancellation = true;
                 if (cancelFilter === '30' && diff > 7 && diff <= 30) includesCancellation = true;
                 if (cancelFilter === '31+' && diff > 30) includesCancellation = true;
             }
         }
      }

      if (!map[faixaRenda]) {
        map[faixaRenda] = {
          faixa: faixaRenda,
          brutas: 0,
          cancelamentos: 0,
          order
        };
      }

      map[faixaRenda].brutas++;

      if (includesCancellation) {
        map[faixaRenda].cancelamentos++;
      }
    });

    // Convert map to array and sort by Order
    return Object.values(map).sort((a, b) => a.order - b.order);
  }, [rawSales, startDate, endDate, cancelFilter, empreendimentoFilter]);

  const totaisGerais = useMemo(() => {
    return groupedData.reduce(
        (acc, item) => {
            acc.brutas += item.brutas;
            acc.cancelamentos += item.cancelamentos;
            return acc;
        },
        { brutas: 0, cancelamentos: 0 }
    );
  }, [groupedData]);

  const taxaGlobalCanc = totaisGerais.brutas > 0 ? ((totaisGerais.cancelamentos / totaisGerais.brutas) * 100).toFixed(1) : '0.0';

  if (loading && rawSales.length === 0) {
    return <SkeletonTable />;
  }

  return (
    <div className={`flex-1 flex flex-col p-5 gap-5 overflow-y-auto font-sans h-full bg-slate-50 transition-opacity duration-300 ${loading ? 'opacity-60 pointer-events-none' : 'opacity-100'}`}>
      {/* Top Filter Bar */}
      <div className="flex items-center justify-between bg-white p-4 border border-slate-200 rounded-lg shrink-0 flex-wrap gap-4 shadow-sm">
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
            <label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider mb-1">Filtro Customizado (Ínicio/Fim)</label>
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
            <label className="text-[10px] uppercase text-rose-500 font-bold tracking-wider mb-1">Período do Canc.</label>
            <select 
              value={cancelFilter}
              onChange={(e) => setCancelFilter(e.target.value as any)}
              className="text-sm border border-slate-200 rounded-md px-2 py-1.5 focus:outline-none focus:border-rose-400 text-slate-600 shadow-sm font-semibold"
            >
               <option value="all">Todos os Cancelamentos</option>
               <option value="7">0 a 7 dias</option>
               <option value="30">8 a 30 dias</option>
               <option value="31+">Acima de 30 dias</option>
            </select>
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
            {loading && <span className="text-xs text-slate-400 font-semibold animate-pulse mr-2">Calculando...</span>}
            <span className="bg-sky-100 text-sky-700 px-3 py-1.5 rounded-md text-[11px] font-bold">Total Brutas: {totaisGerais.brutas}</span>
            <span className="bg-rose-100 text-rose-700 px-3 py-1.5 rounded-md text-[11px] font-bold">Taxa Canc: {taxaGlobalCanc}%</span>
        </div>
      </div>

      {/* Grid */}
      {groupedData.length === 0 && !loading ? (
        <div className="flex flex-col items-center justify-center pt-20 text-slate-500">
           <Wallet className="w-16 h-16 text-slate-300 mb-4" />
           <p className="font-semibold text-lg">Nenhuma venda encontrada no período.</p>
           <p className="text-sm">Tente ajustar o filtro de datas acima.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6 items-stretch pb-10 max-w-5xl mx-auto w-full">
           <div className="bg-white rounded-xl shadow border border-slate-200 overflow-hidden flex flex-col hover:shadow-md transition-shadow">
              {/* Card Header */}
              <div className="bg-slate-800 p-4 border-b border-slate-200 flex flex-col gap-2 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-5">
                   <Wallet className="w-32 h-32" />
                </div>
                <div className="flex items-center gap-2 relative z-10">
                  <Wallet className="w-5 h-5 text-indigo-400" />
                  <h2 className="text-lg font-bold text-white tracking-tight leading-tight">Análise por Faixa de Renda</h2>
                </div>
              </div>

              {/* Body */}
              <div className="flex-1 p-0 flex flex-col bg-white">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">Faixa de Renda Familiar</th>
                      <th className="px-2 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 text-center">% do Total</th>
                      <th className="px-2 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 text-center">Brutas</th>
                      <th className="px-2 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 text-center">Canceladas</th>
                      <th className="px-2 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 text-center">% Canc.</th>
                      <th className="px-2 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 text-center">Líquidas</th>
                      <th className="px-2 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 text-center">% Líq.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {groupedData.map(faixa => {
                      const taxaFaixa = faixa.brutas > 0 ? ((faixa.cancelamentos / faixa.brutas) * 100).toFixed(1) : '0.0';
                      const percentTotal = totaisGerais.brutas > 0 ? ((faixa.brutas / totaisGerais.brutas) * 100).toFixed(1) : '0.0';
                      const isAlta = parseFloat(taxaFaixa) > 25;
                      const liquidas = faixa.brutas - faixa.cancelamentos;
                      const taxaLiq = faixa.brutas > 0 ? ((liquidas / faixa.brutas) * 100).toFixed(1) : '0.0';
                      
                      return (
                        <tr key={faixa.faixa} className="hover:bg-slate-50 transition-colors">
                           <td className="px-4 py-4 text-xs font-bold text-slate-700 flex items-center gap-2">
                              {faixa.faixa}
                           </td>
                           <td className="px-2 py-4">
                              <div className="flex items-center justify-center gap-1 px-2 py-1 rounded-md text-xs font-bold bg-sky-50 text-sky-600">
                                  {percentTotal}%
                              </div>
                           </td>
                           <td className="px-2 py-4 text-sm font-black text-slate-600 text-center">{faixa.brutas}</td>
                           <td className="px-2 py-4 text-sm font-black text-slate-500 text-center">{faixa.cancelamentos}</td>
                           <td className="px-2 py-4">
                              <div className={`flex items-center justify-center gap-1 px-2 py-1 rounded-md text-xs font-bold ${isAlta ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-600'}`}>
                                  {isAlta && <XCircle className="w-3 h-3 text-rose-500" />}
                                  {taxaFaixa}%
                              </div>
                           </td>
                           <td className="px-2 py-4 text-sm font-black text-emerald-600 text-center bg-emerald-50/30">{liquidas}</td>
                           <td className="px-2 py-4">
                              <div className="flex items-center justify-center gap-1 px-2 py-1 rounded-md text-xs font-bold bg-emerald-50 text-emerald-600">
                                  {taxaLiq}%
                              </div>
                           </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {/* Footer Totais */}
                  <tfoot className="bg-slate-50">
                    <tr>
                       <td className="px-4 py-4 text-xs font-bold text-slate-800 text-right">TOTAIS</td>
                       <td className="px-2 py-4">
                          <div className="flex items-center justify-center gap-1 px-2 py-1 rounded-md text-xs font-bold bg-sky-100 text-sky-700">
                              100.0%
                          </div>
                       </td>
                       <td className="px-2 py-4 text-sm font-black text-slate-800 text-center">{totaisGerais.brutas}</td>
                       <td className="px-2 py-4 text-sm font-black text-slate-800 text-center">{totaisGerais.cancelamentos}</td>
                       <td className="px-2 py-4">
                          <div className={`flex items-center justify-center gap-1 px-2 py-1 rounded-md text-xs font-bold bg-slate-200 text-slate-700`}>
                              {taxaGlobalCanc}%
                          </div>
                       </td>
                       <td className="px-2 py-4 text-sm font-black text-emerald-700 text-center bg-emerald-100/50">{totaisGerais.brutas - totaisGerais.cancelamentos}</td>
                       <td className="px-2 py-4">
                          <div className="flex items-center justify-center gap-1 px-2 py-1 rounded-md text-xs font-bold bg-emerald-100 text-emerald-700">
                              {totaisGerais.brutas > 0 ? (((totaisGerais.brutas - totaisGerais.cancelamentos) / totaisGerais.brutas) * 100).toFixed(1) : '0.0'}%
                          </div>
                       </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
