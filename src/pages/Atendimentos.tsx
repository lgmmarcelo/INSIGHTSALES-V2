import React, { useState, useEffect, useMemo, Fragment } from 'react';
import { collection, query, getDocs, updateDoc, doc, limit, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { parseDateLocal } from '../lib/utils';
import { Upload, ArrowUpDown, ChevronUp, ChevronDown, ChevronRight, Search, X } from 'lucide-react';

export default function Atendimentos() {
  const { userRole } = useAuth();
  const [rawSales, setRawSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortConfig, setSortConfig] = useState<{key: string, direction: 'asc' | 'desc'} | null>(null);

  // Date filtering state
  const [monthSelection, setMonthSelection] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // Search state
  const [searchTerm, setSearchTerm] = useState('');
  
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (id: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // By default, do not fetch the entire database to avoid quota explosions.
      // E.g., if we have 20000 rows, fetching all consumes 20k reads per click.
      const constraints: any[] = [];
      if (startDate) {
        constraints.push(where("dataAtendimentoIso", ">=", startDate));
      }
      if (endDate) {
        constraints.push(where("dataAtendimentoIso", "<=", endDate));
      }

      // If no date filters are set at all, we limit to the last 2000 to prevent quota wipe out.
      // Ideally we force a default date range (e.g., current month)
      const q = constraints.length > 0
        ? query(collection(db, 'sales'), ...constraints)
        : query(collection(db, 'sales'), limit(1500));

      const querySnapshot = await getDocs(q);
      const data: any[] = [];
      querySnapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() });
      });
      // All items in the new schema are confirmed contracts
      setRawSales(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Filter logic
  const sales = useMemo(() => {
    let filtered = rawSales;
    
    // Apply date filter
    if (startDate || endDate) {
        const startObj = startDate ? new Date(startDate + 'T00:00:00') : null;
        const endObj = endDate ? new Date(endDate + 'T23:59:59') : null;

        filtered = filtered.filter(sale => {
          const saleDate = parseDateLocal(sale.dataAtendimento);
          if (!saleDate) return false;
          
          if (startObj && saleDate < startObj) return false;
          if (endObj && saleDate > endObj) return false;
          return true;
        });
    }

    // Apply search filter
    if (searchTerm.trim()) {
        const lowerSearch = searchTerm.trim().toLowerCase();
        filtered = filtered.filter(sale => {
             const nameMatch = String(sale.cliente || '').toLowerCase().includes(lowerSearch);
             const cpfMatch = String(sale.cpf || '').replace(/\D/g, '').includes(lowerSearch.replace(/\D/g, ''));
             return nameMatch || (cpfMatch && lowerSearch.replace(/\D/g, '').length > 0);
        });
    }

    return filtered;
  }, [rawSales, startDate, endDate, searchTerm]);

  const groupedSales = useMemo(() => {
    const groups: Record<string, any> = {};
    sales.forEach(sale => {
      const cpfKey = sale.cpf || sale.cliente || sale.id;
      if (!groups[cpfKey]) {
        groups[cpfKey] = {
          id: cpfKey,
          cpf: sale.cpf || 'S/N',
          cliente: sale.cliente || 'S/N',
          dataAtendimento: sale.dataAtendimento,
          dataCancelamento: '',
          contracts: [],
          quantVenda: 0,
          cotasCanceladas: 0,
          cotasRetidas: 0,
          faturamento: 0
        };
      }
      
      const g = groups[cpfKey];
      g.contracts.push(sale);
      g.quantVenda += 1;
      g.faturamento += (sale.valor || 0);

      const isCanceled = !!sale.dataCancelamento;
      if (isCanceled) {
         g.cotasCanceladas += 1;
         if (sale.dataCancelamento && (!g.dataCancelamento || parseDateLocal(sale.dataCancelamento)! > parseDateLocal(g.dataCancelamento)!)) {
           g.dataCancelamento = sale.dataCancelamento;
         }
      } else {
         g.cotasRetidas += 1;
      }
    });
    return Object.values(groups);
  }, [sales]);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedSales = useMemo(() => {
    let sortableItems = [...groupedSales];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        let aValue = a[sortConfig.key];
        let bValue = b[sortConfig.key];

        if (sortConfig.key === 'cotasRetidas') {
           aValue = a.cotasRetidas ?? a.quantVenda ?? 0;
           bValue = b.cotasRetidas ?? b.quantVenda ?? 0;
        }

        // Handle specific date sorting types
        if (sortConfig.key === 'dataAtendimento' || sortConfig.key === 'dataCancelamento') {
           const dateA = parseDateLocal(aValue)?.getTime() || 0;
           const dateB = parseDateLocal(bValue)?.getTime() || 0;
           if (dateA < dateB) return sortConfig.direction === 'asc' ? -1 : 1;
           if (dateA > dateB) return sortConfig.direction === 'asc' ? 1 : -1;
           return 0;
        }

        if (aValue === undefined || aValue === null) aValue = '';
        if (bValue === undefined || bValue === null) bValue = '';
        
        if (typeof aValue === 'string' && typeof bValue === 'string') {
            const cmp = aValue.localeCompare(bValue);
            return sortConfig.direction === 'asc' ? cmp : -cmp;
        }

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [groupedSales, sortConfig]);

  // Aggregate totals
  const totals = useMemo(() => {
    let quantVenda = sales.length; // 1 Doc = 1 Cota
    let cotasCanceladas = 0;
    let cotasRetidas = 0;
    let faturamento = 0;

    sales.forEach(s => {
      faturamento += (s.valor || 0);
      const isCanceled = !!s.dataCancelamento;
      if (isCanceled) {
          cotasCanceladas += 1;
      } else {
          cotasRetidas += 1;
      }
    });

    return { quantVenda, cotasCanceladas, cotasRetidas, faturamento };
  }, [sales]);

  // Compute today's date in GMT-3 to block future dates in the picker
  const maxDateAllowed = useMemo(() => {
    const today = new Date();
    const formatter = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' });
    const parts = formatter.format(today).split('/'); // dd/mm/yyyy
    return `${parts[2]}-${parts[1]}-${parts[0]}`; // yyyy-mm-dd
  }, []);

  const SortHeader = ({ label, sortKey, canSort = true }: { label: string, sortKey: string, canSort?: boolean }) => {
    if (!canSort) return <th className="select-none">{label}</th>;
    
    const isActive = sortConfig?.key === sortKey;
    return (
      <th onClick={() => handleSort(sortKey)} className="cursor-pointer hover:bg-slate-50 transition-colors group select-none">
        <div className="flex items-center gap-1">
          {label}
          <span className="text-slate-300 group-hover:text-slate-500">
             {isActive ? (sortConfig.direction === 'asc' ? <ChevronUp size={14}/> : <ChevronDown size={14}/>) : <ArrowUpDown size={14}/>}
          </span>
        </div>
      </th>
    );
  };

  const handleUpdateManualField = async (id: string, field: string, value: any, currentSale: any) => {
    try {
      const dbRef = doc(db, 'sales', id);
      let updates: any = { [field]: value };
      
      // Compute cotasRetidas automatically
      if (field === 'cotasCanceladas') {
         updates.cotasRetidas = Math.max(0, (currentSale.quantVenda || 0) - value);
      }
      
      await updateDoc(dbRef, updates);
      
      setRawSales(prev => prev.map(s => {
        if (s.id === id) {
          const newS = { ...s, ...updates };
          return newS;
        }
        return s;
      }));
    } catch (e: any) {
      alert("Erro ao salvar: " + e.message);
    }
  };

  const canEdit = userRole === 'admin' || userRole === 'analyst';

  // Utils for Date input conversion: DB uses DD/MM/YYYY, input type="date" uses YYYY-MM-DD
  const formatForInput = (brDate?: string) => {
    if (!brDate) return '';
    const parts = brDate.split('/');
    if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
    return brDate;
  };

  const handleDateChange = (id: string, dateVal: string, sale: any) => {
    let brDate = '';
    if (dateVal) {
      const parts = dateVal.split('-');
      if (parts.length === 3) brDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    handleUpdateManualField(id, 'dataCancelamento', brDate, sale);
  };

  return (
    <div className="flex-1 flex flex-col p-5 gap-5 overflow-hidden font-sans">
      
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
        </div>

        <div className="flex gap-4 items-center">
            <div className="relative">
               <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search size={14} className="text-slate-400" />
               </div>
               <input
                  type="text"
                  placeholder="Buscar por Cliente ou CPF..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-8 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:border-sky-400 w-64 shadow-sm"
               />
               {searchTerm && (
                  <button 
                     onClick={() => setSearchTerm('')}
                     className="absolute inset-y-0 right-0 pr-2 flex items-center text-slate-400 hover:text-slate-600"
                  >
                     <X size={14} />
                  </button>
               )}
            </div>
            
            <div className="flex items-center">
               {loading && <span className="text-xs text-slate-400 font-semibold animate-pulse mr-2">Carregando dados...</span>}
               <span className="bg-sky-100 text-sky-700 px-3 py-1.5 rounded-md text-[11px] font-bold shrink-0">Total Encontrado: {sales.length}</span>
            </div>
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-white border border-slate-200 rounded-lg flex-1 flex flex-col min-h-0 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-white shrink-0">
          <span className="font-bold text-sm">Log de Atendimentos & Vendas</span>
        </div>
        
        <div className="overflow-auto flex-1">
          <table className="data-table">
            <thead className="sticky top-0 z-10 shadow-sm bg-white">
              <tr className="bg-slate-100 border-b border-slate-200">
                <th colSpan={3} className="text-right font-extrabold text-[11px] uppercase tracking-wider text-slate-500 py-3 pr-4">Total do Período Filtrado:</th>
                <th className="text-center font-extrabold text-sky-800 text-[15px]">{totals.quantVenda}</th>
                <th className="text-center font-extrabold text-sky-800 text-[15px]">R$ {totals.faturamento.toLocaleString('pt-BR')}</th>
                <th className="text-center font-extrabold text-red-600 text-[15px]">{totals.cotasCanceladas}</th>
                <th className="text-center font-extrabold text-emerald-600 text-[15px]">{totals.cotasRetidas}</th>
              </tr>
              <tr>
                <SortHeader label="Data Venda" sortKey="dataAtendimento" />
                <SortHeader label="Cliente" sortKey="cliente" />
                <SortHeader label="CPF" sortKey="cpf" canSort={false} />
                <SortHeader label="Vendas Brutas" sortKey="quantVenda" />
                <SortHeader label="Data Solicitação" sortKey="dataCancelamento" />
                <SortHeader label="Cotas Canc." sortKey="cotasCanceladas" />
                <SortHeader label="Cotas Líquidas" sortKey="cotasRetidas" />
              </tr>
            </thead>
            <tbody>
              {sortedSales.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                       {loading ? <div className="text-xs font-semibold animate-pulse text-slate-500">Listando vendas...</div> : (
                         <>
                           <Upload size={32} className="opacity-50" />
                           <div>Nenhum dado encontrado no período.</div>
                         </>
                       )}
                    </div>
                  </td>
                </tr>
              ) : (
                sortedSales.map(g => {
                   const isExpanded = expandedGroups.has(g.id);
                   return (
                     <Fragment key={g.id}>
                       <tr 
                          className="cursor-pointer hover:bg-slate-50 transition-colors border-b border-slate-100" 
                          onClick={() => toggleGroup(g.id)}
                       >
                         <td>
                           <div className="flex items-center gap-2">
                             {isExpanded ? <ChevronDown size={16} className="text-slate-400 shrink-0" /> : <ChevronRight size={16} className="text-slate-400 shrink-0" />}
                             {g.dataAtendimento}
                           </div>
                         </td>
                         <td className="font-semibold text-slate-800">{g.cliente}</td>
                         <td className="text-slate-600">{g.cpf}</td>
                         <td className="font-bold text-center text-sky-700">{g.quantVenda}</td>
                         <td className="text-slate-600">{g.dataCancelamento || '-'}</td>
                         <td className="font-bold text-center text-red-500">{g.cotasCanceladas}</td>
                         <td className="font-bold text-center text-emerald-600">{g.cotasRetidas}</td>
                       </tr>
                       
                       {isExpanded && g.contracts.map((s: any) => (
                         <tr key={s.id} className="bg-slate-50/50 text-sm border-b border-slate-100 last:border-b-2 last:border-slate-200">
                           <td colSpan={3} className="pl-10">
                              <div className="grid grid-cols-3 gap-2">
                                <div className="flex flex-col">
                                  <span className="font-semibold text-[10px] uppercase text-slate-400 tracking-wider">Empreendimento</span>
                                  <span className="text-slate-600 font-medium truncate">{s.empreendimento || 'N/A'}</span>
                                </div>
                                <div className="flex flex-col">
                                  <span className="font-semibold text-[10px] uppercase text-slate-400 tracking-wider">Localizador</span>
                                  <span className="text-slate-600 font-medium">{s.localizador}</span>
                                </div>
                                <div className="flex flex-col">
                                  <span className="font-semibold text-[10px] uppercase text-slate-400 tracking-wider">Valor (VGV)</span>
                                  <span className="text-slate-600 font-medium">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(s.valor || 0)}</span>
                                </div>
                              </div>
                           </td>
                           <td className="font-semibold text-center text-slate-500">1</td>
                           <td>
                             <input 
                               type="date" 
                               className="input-field w-32 text-xs cursor-pointer bg-white"
                               disabled={!canEdit}
                               min={formatForInput(s.dataAtendimento)}
                               max={maxDateAllowed}
                               value={formatForInput(s.dataCancelamento)}
                               onChange={(e) => handleDateChange(s.id, e.target.value, s)}
                               onClick={(e) => e.stopPropagation()}
                             />
                           </td>
                           <td className="font-semibold text-center text-red-500">{s.dataCancelamento || s.statusContrato === 'CANCELADO' ? 1 : 0}</td>
                           <td className="font-semibold text-emerald-600 text-center">{s.dataCancelamento || s.statusContrato === 'CANCELADO' ? 0 : 1}</td>
                         </tr>
                       ))}
                     </Fragment>
                   );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
