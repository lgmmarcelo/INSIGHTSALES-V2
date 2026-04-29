import { useState, useEffect, useMemo } from 'react';
import { differenceInDays, parseDateLocal } from '../lib/utils';
import { Sale } from '../types';
import { useSalesData } from '../hooks/useSalesData';
import { SkeletonTable } from '../components/ui/SkeletonTable';

interface TeamMetric {
  name: string;
  brutas: number;
  cancel7: number;
  cancel30: number;
  cancelTotal: number;
}

export default function Equipe() {
  const [sortKey, setSortKey] = useState<keyof TeamMetric | 'taxa'>('brutas');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Date filtering state
  const [monthSelection, setMonthSelection] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [cancelFilter, setCancelFilter] = useState<'all' | '7' | '30' | '31+'>('all');
  const [salaFilter, setSalaFilter] = useState<string>('all');
  
  // Tab state
  const [activeTab, setActiveTab] = useState<'consultor' | 'captador' | 'to'>('consultor');

  const { rawSales, loading } = useSalesData(startDate, endDate);

  const handleSort = (key: keyof TeamMetric | 'taxa') => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('desc');
    }
  };

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

  // Filter by Date
  const dateFilteredSales = useMemo(() => {
    return rawSales.filter(sale => {
      if (startDate && (!sale.dataAtendimentoIso || sale.dataAtendimentoIso < startDate)) return false;
      if (endDate && (!sale.dataAtendimentoIso || sale.dataAtendimentoIso > endDate)) return false;
      return true;
    });
  }, [rawSales, startDate, endDate]);

  const availableSalas = useMemo(() => {
    const salas = new Set<string>();
    dateFilteredSales.forEach(sale => {
      const s = (sale.sala || 'SALA NÃO ESPECIFICADA').trim().toUpperCase();
      salas.add(s);
    });
    return Array.from(salas).sort();
  }, [dateFilteredSales]);

  const getMetrics = (roleKey: 'consultor' | 'captador' | 'to'): TeamMetric[] => {
    const map: Record<string, TeamMetric> = {};

    dateFilteredSales.forEach(sale => {
      const s = (sale.sala || 'SALA NÃO ESPECIFICADA').trim().toUpperCase();
      if (salaFilter !== 'all' && s !== salaFilter) return;

      let rawName = sale[roleKey];
      let name = (rawName ? String(rawName).trim() : '') || 'NÃO ESPECIFICADO';
      name = name.toUpperCase();
      
      if (!map[name]) {
         map[name] = { name, brutas: 0, cancel7: 0, cancel30: 0, cancelTotal: 0 };
      }
      
      map[name].brutas++;

      const isCanceledRaw = !!sale.dataCancelamento;
      let includesCancellation = false;

      if (isCanceledRaw) {
         const dAtendimento = parseDateLocal(sale.dataAtendimento);
         const dCancelamento = parseDateLocal(sale.dataCancelamento);
         
         if (cancelFilter === 'all') {
             includesCancellation = true;
         } else if (dAtendimento && dCancelamento) {
             const diff = differenceInDays(dCancelamento, dAtendimento);
             if (cancelFilter === '7' && diff <= 7) includesCancellation = true;
             if (cancelFilter === '30' && diff > 7 && diff <= 30) includesCancellation = true;
             if (cancelFilter === '31+' && diff > 30) includesCancellation = true;
         }

         // Track standard columns too regardless of filter (for the columns cancel7 and cancel30)
         // Assuming if someone is looking at standard table, maybe we don't want those to shift, 
         // but wait, the instructions imply using the newly filtered number for `cancelTotal`
         if (includesCancellation) {
            map[name].cancelTotal++;
         }

         if (dAtendimento && dCancelamento) {
            const diff = differenceInDays(dCancelamento, dAtendimento);
            if (diff <= 7) { map[name].cancel7++; }
            else if (diff <= 30) { map[name].cancel30++; }
         }
      }
    });

    return Object.values(map);
  };

  const currentMetrics = useMemo(() => {
    const metrics = getMetrics(activeTab);
    return metrics.sort((a, b) => {
      let valA: any = a[sortKey as keyof TeamMetric];
      let valB: any = b[sortKey as keyof TeamMetric];
      
      if (sortKey === 'taxa') {
         valA = a.brutas > 0 ? a.cancelTotal / a.brutas : 0;
         valB = b.brutas > 0 ? b.cancelTotal / b.brutas : 0;
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [dateFilteredSales, activeTab, sortKey, sortOrder, cancelFilter, salaFilter]);

  const renderSortIcon = (key: keyof TeamMetric | 'taxa') => {
    if (sortKey !== key) return <span className="text-slate-300 ml-1">↕</span>;
    return <span className="text-indigo-500 font-black ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>;
  };

  const renderTable = () => (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden flex flex-col flex-1 min-h-0">
      <div className="overflow-y-auto custom-scrollbar flex-1">
        <table className="w-full text-left border-collapse min-w-[700px]">
          <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
            <tr>
              <th className="p-3 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 cursor-pointer hover:bg-slate-100" onClick={() => handleSort('name')}>Colaborador ({activeTab.toUpperCase()}) {renderSortIcon('name')}</th>
              <th className="p-3 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 text-center cursor-pointer hover:bg-slate-100" onClick={() => handleSort('brutas')}>Vendas Brutas {renderSortIcon('brutas')}</th>
              <th className="p-3 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 text-center cursor-pointer hover:bg-slate-100" onClick={() => handleSort('cancel7')}>Canc. (Até 7d) {renderSortIcon('cancel7')}</th>
              <th className="p-3 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 text-center cursor-pointer hover:bg-slate-100" onClick={() => handleSort('cancel30')}>Canc. (8-30d) {renderSortIcon('cancel30')}</th>
              <th className="p-3 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 text-center cursor-pointer hover:bg-slate-100" onClick={() => handleSort('cancelTotal')}>Total Cancel. {renderSortIcon('cancelTotal')}</th>
              <th className="p-3 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 text-center cursor-pointer hover:bg-slate-100" onClick={() => handleSort('taxa')}>Taxa Canc. (%) {renderSortIcon('taxa')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {currentMetrics.map((row, idx) => {
               const rate = row.brutas > 0 ? ((row.cancelTotal / row.brutas) * 100).toFixed(1) : '0.0';
               return (
                <tr key={idx} className="hover:bg-slate-50 transition-colors">
                  <td className="p-3 text-sm font-semibold text-slate-700">{row.name}</td>
                  <td className="p-3 text-sm font-bold text-sky-700 text-center bg-sky-50/30">{row.brutas}</td>
                  <td className="p-3 text-sm font-bold text-red-500 text-center">{row.cancel7}</td>
                  <td className="p-3 text-sm font-bold text-amber-500 text-center">{row.cancel30}</td>
                  <td className="p-3 text-sm font-bold text-rose-600 text-center bg-rose-50/30">{row.cancelTotal}</td>
                  <td className="p-3 text-sm font-semibold text-slate-600 text-center">{rate}%</td>
                </tr>
               )
            })}
            {currentMetrics.length === 0 && (
              <tr>
                <td colSpan={6} className="p-10 text-center text-slate-400 text-sm">Nenhum dado encontrado no período.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="flex-1 flex flex-col p-5 gap-5 overflow-y-auto font-sans h-full">
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
            <span className="bg-sky-100 text-sky-700 px-3 py-1.5 rounded-md text-[11px] font-bold">Base Total: {dateFilteredSales.length}</span>
        </div>
      </div>

      <div className="flex flex-col flex-1 min-h-[500px]">
         <div className="flex justify-between items-center mb-4 shrink-0 border-b border-slate-200 pb-2">
            <div className="flex gap-2">
              <button 
                onClick={() => setActiveTab('consultor')}
                className={`px-4 py-2 text-sm font-bold uppercase tracking-wider rounded-md transition-colors ${activeTab === 'consultor' ? 'bg-indigo-600 text-white shadow' : 'bg-white text-slate-500 hover:bg-slate-100 border border-slate-200'}`}
              >
                 Consultores
              </button>
              <button 
                onClick={() => setActiveTab('captador')}
                className={`px-4 py-2 text-sm font-bold uppercase tracking-wider rounded-md transition-colors ${activeTab === 'captador' ? 'bg-indigo-600 text-white shadow' : 'bg-white text-slate-500 hover:bg-slate-100 border border-slate-200'}`}
              >
                 Captadores
              </button>
              <button 
                onClick={() => setActiveTab('to')}
                className={`px-4 py-2 text-sm font-bold uppercase tracking-wider rounded-md transition-colors ${activeTab === 'to' ? 'bg-indigo-600 text-white shadow' : 'bg-white text-slate-500 hover:bg-slate-100 border border-slate-200'}`}
              >
                 T.O. / Closers
              </button>
            </div>
            
            <div className="flex items-center gap-2">
              <label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Filtrar por Sala:</label>
              <select 
                value={salaFilter}
                onChange={(e) => setSalaFilter(e.target.value)}
                className="text-sm border border-slate-200 rounded-md px-2 py-1.5 focus:outline-none focus:border-indigo-400 text-indigo-700 shadow-sm font-bold w-64 bg-slate-50"
              >
                 <option value="all">Todas as Salas</option>
                 {availableSalas.map(s => (
                   <option key={s} value={s}>{s}</option>
                 ))}
              </select>
            </div>
         </div>
         {renderTable()}
      </div>
    </div>
  );
}
