import { useState, useEffect, useMemo } from 'react';
import { parseDateLocal } from '../lib/utils';
import { MapPin, XCircle, Store } from 'lucide-react';
import { differenceInDays } from 'date-fns';
import { Sale } from '../types';
import { useSalesData } from '../hooks/useSalesData';

interface PontoStats {
  brutas: number;
  cancelamentos: number;
}

interface SalaStats {
  nome: string;
  brutasTotais: number;
  cancelamentosTotais: number;
  pontos: Record<string, PontoStats>;
}

export default function PontosCaptacao() {
  // Date filtering state
  const [monthSelection, setMonthSelection] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [cancelFilter, setCancelFilter] = useState<'all' | '7' | '30' | '31+'>('all');

  const { rawSales, loading } = useSalesData(startDate, endDate);

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
    setMonthSelection('');
  };

  const handleEndDateChange = (val: string) => {
    setEndDate(val);
    setMonthSelection('');
  };

  // Filter and Group Data
  const groupedData = useMemo(() => {
    const map: Record<string, SalaStats> = {};

    rawSales.forEach(sale => {
      // Date Filter
      if (startDate && (!sale.dataAtendimentoIso || sale.dataAtendimentoIso < startDate)) return;
      if (endDate && (!sale.dataAtendimentoIso || sale.dataAtendimentoIso > endDate)) return;

      const salaName = (sale.sala || 'SALA NÃO ESPECIFICADA').trim().toUpperCase();
      const rawPonto = (sale.pontoCaptacao || 'PONTO NÃO ESPECIFICADO').trim().toUpperCase();
      
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

      if (!map[salaName]) {
        map[salaName] = {
          nome: salaName,
          brutasTotais: 0,
          cancelamentosTotais: 0,
          pontos: {}
        };
      }

      if (!map[salaName].pontos[rawPonto]) {
        map[salaName].pontos[rawPonto] = { brutas: 0, cancelamentos: 0 };
      }

      map[salaName].brutasTotais++;
      map[salaName].pontos[rawPonto].brutas++;

      if (includesCancellation) {
        map[salaName].cancelamentosTotais++;
        map[salaName].pontos[rawPonto].cancelamentos++;
      }
    });

    // Convert map to array and sort by Total Vendas Brutas (desc)
    return Object.values(map).sort((a, b) => b.brutasTotais - a.brutasTotais);
  }, [rawSales, startDate, endDate, cancelFilter]);

  return (
    <div className="flex-1 flex flex-col p-5 gap-5 overflow-y-auto font-sans h-full bg-slate-50">
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
        </div>

        <div className="flex gap-2 items-center">
            {loading && <span className="text-xs text-slate-400 font-semibold animate-pulse mr-2">Calculando...</span>}
            <span className="bg-sky-100 text-sky-700 px-3 py-1.5 rounded-md text-[11px] font-bold">Salas Ativas: {groupedData.length}</span>
        </div>
      </div>

      {/* Grid of Salas */}
      {groupedData.length === 0 && !loading ? (
        <div className="flex flex-col items-center justify-center pt-20 text-slate-500">
           <Store className="w-16 h-16 text-slate-300 mb-4" />
           <p className="font-semibold text-lg">Nenhuma venda encontrada no período.</p>
           <p className="text-sm">Tente ajustar o filtro de datas acima.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6 items-stretch pb-10">
          {groupedData.map((sala) => {
             const taxaGlobal = sala.brutasTotais > 0 ? ((sala.cancelamentosTotais / sala.brutasTotais) * 100).toFixed(1) : '0.0';
             const isAltaGlobal = parseFloat(taxaGlobal) > 25;
             
             // Sort pontos by number of sales
             const pontos = Object.entries(sala.pontos)
                        .map(([nome, d]) => ({nome, ...d}))
                        .sort((a, b) => b.brutas - a.brutas);

             return (
               <div key={sala.nome} className="bg-white rounded-xl shadow border border-slate-200 overflow-hidden flex flex-col hover:shadow-md transition-shadow">
                  {/* Card Header (Sala Name & Overall Stats) */}
                  <div className="bg-slate-800 p-4 border-b border-slate-200 flex flex-col gap-2 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-5">
                       <Store className="w-32 h-32" />
                    </div>
                    <div className="flex items-center gap-2 relative z-10">
                      <Store className="w-5 h-5 text-indigo-400" />
                      <h2 className="text-lg font-bold text-white tracking-tight leading-tight">{sala.nome}</h2>
                    </div>
                    
                    <div className="flex items-center justify-between mt-2 pt-3 border-t border-slate-700/50 relative z-10">
                       <div className="flex flex-col">
                          <span className="text-[10px] text-slate-400 uppercase font-black tracking-wider">Total Vendas</span>
                          <span className="text-2xl font-black text-sky-400 leading-none">{sala.brutasTotais}</span>
                       </div>
                       <div className="flex flex-col items-end">
                          <span className="text-[10px] text-slate-400 uppercase font-black tracking-wider">Taxa Geral Canc.</span>
                          <span className={`text-xl font-black leading-none ${isAltaGlobal ? 'text-rose-400' : 'text-emerald-400'}`}>
                            {taxaGlobal}%
                          </span>
                       </div>
                    </div>
                  </div>

                  {/* Body (List of Pontos) */}
                  <div className="flex-1 p-0 flex flex-col bg-white">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-4 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">Ponto de Captação</th>
                          <th className="px-2 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 text-center">Brutas</th>
                          <th className="px-2 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 text-center">Canceladas</th>
                          <th className="px-2 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 text-center">% Canc.</th>
                          <th className="px-2 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 text-center">Líquidas</th>
                          <th className="px-2 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 text-center">% Líq.</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {pontos.map(ponto => {
                          const taxaPonto = ponto.brutas > 0 ? ((ponto.cancelamentos / ponto.brutas) * 100).toFixed(1) : '0.0';
                          const isAlta = parseFloat(taxaPonto) > 25;
                          const liquidas = ponto.brutas - ponto.cancelamentos;
                          const taxaLiq = ponto.brutas > 0 ? ((liquidas / ponto.brutas) * 100).toFixed(1) : '0.0';
                          
                          return (
                            <tr key={ponto.nome} className="hover:bg-slate-50 transition-colors">
                               <td className="px-4 py-3 text-xs font-bold text-slate-700 flex items-center gap-2">
                                  <MapPin className="w-3 h-3 flex-shrink-0 text-slate-400" />
                                  <span>{ponto.nome}</span>
                               </td>
                               <td className="px-2 py-3 text-sm font-black text-slate-600 text-center">{ponto.brutas}</td>
                               <td className="px-2 py-3 text-sm font-black text-slate-500 text-center">{ponto.cancelamentos}</td>
                               <td className="px-2 py-3">
                                  <div className={`flex items-center justify-center gap-1 px-2 py-1 rounded-md text-xs font-bold ${isAlta ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-600'}`}>
                                      {isAlta && <XCircle className="w-3 h-3 text-rose-500" />}
                                      {taxaPonto}%
                                  </div>
                               </td>
                               <td className="px-2 py-3 text-sm font-black text-emerald-600 text-center bg-emerald-50/30">{liquidas}</td>
                               <td className="px-2 py-3">
                                  <div className="flex items-center justify-center gap-1 px-2 py-1 rounded-md text-xs font-bold bg-emerald-50 text-emerald-600">
                                      {taxaLiq}%
                                  </div>
                               </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
               </div>
             )
          })}
        </div>
      )}
    </div>
  );
}
