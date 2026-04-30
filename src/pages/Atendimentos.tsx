import React, { useState, useEffect, useMemo, Fragment } from 'react';

/**
 * ⚠️ AVISO DE INTEGRIDADE ESTRUTURAL (InsightSales)
 * ESTE ARQUIVO CONTÉM A LÓGICA DE AGRUPAMENTO DE COTAS (1 DOC = 1 COTA).
 * NÃO ALTERAR A LÓGICA DE totals.quantVenda OU groupedSales SEM AUTORIZAÇÃO.
 */
import { updateDoc, doc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { parseDateLocal } from '../lib/utils';
import { Upload, ArrowUpDown, ChevronUp, ChevronDown, ChevronRight, Search, X, Save, Check } from 'lucide-react';
import { Sale } from '../types';
import { useSalesData } from '../hooks/useSalesData';
import { SkeletonTable } from '../components/ui/SkeletonTable';

export default function Atendimentos() {
  const { userRole, userPermissions, currentUser } = useAuth();
  const [sortConfig, setSortConfig] = useState<{key: string, direction: 'asc' | 'desc'} | null>(null);

  // Date filtering state
  const [monthSelection, setMonthSelection] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  const { rawSales, loading, mutate } = useSalesData(startDate, endDate);

  // Search state
  const [searchTerm, setSearchTerm] = useState('');
  
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [analysts, setAnalysts] = useState<{id: string, displayName: string, email: string}[]>([]);

  useEffect(() => {
    const fetchAnalysts = async () => {
      try {
        const q = query(collection(db, 'users'), where('role', '==', 'analyst'));
        const snap = await getDocs(q);
        const list = snap.docs.map(d => ({
          id: d.id,
          displayName: d.data().displayName || '',
          email: d.data().email || ''
        }));
        setAnalysts(list);
      } catch (err) {
        console.error("Erro ao buscar analistas:", err);
      }
    };
    fetchAnalysts();
  }, []);

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
      const lastDayDate = new Date(parseInt(year, 10), parseInt(month, 10), 0);
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

  // Filter logic
  const sales = useMemo(() => {
    let filtered = rawSales;

    // Apply date filter (sanity check in case hook fetches wider range or for consistency)
    if (startDate || endDate) {
        const maxEndBound = endDate ? endDate.substring(0, 8) + '31' : null;

        filtered = filtered.filter(sale => {
          if (startDate && (!sale.dataAtendimentoIso || sale.dataAtendimentoIso < startDate)) return false;
          if (maxEndBound && sale.dataAtendimentoIso && sale.dataAtendimentoIso > maxEndBound) return false;
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
  }, [rawSales, searchTerm, startDate, endDate]);

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

      const isCanceled = !!sale.dataCancelamento && sale.retido !== 'Sim';
      
      if (sale.dataCancelamento && (!g.dataCancelamento || parseDateLocal(sale.dataCancelamento)! > parseDateLocal(g.dataCancelamento)!)) {
        g.dataCancelamento = sale.dataCancelamento;
      }

      if (isCanceled) {
         g.cotasCanceladas += 1;
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
      const isCanceled = !!s.dataCancelamento && s.retido !== 'Sim';
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

  const [editingRows, setEditingRows] = useState<Record<string, Partial<Sale>>>({});

  const handleLocalChange = (id: string, field: string, value: any) => {
    setEditingRows(prev => ({
      ...prev,
      [id]: {
        ...(prev[id] || {}),
        [field]: value
      }
    }));
  };

  const handleDateChange = (id: string, dateVal: string) => {
    let brDate = '';
    if (dateVal) {
      const parts = dateVal.split('-');
      if (parts.length === 3) brDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    handleLocalChange(id, 'dataCancelamento', brDate);
  };

  const handleSaveRow = async (id: string, currentSale: Sale) => {
    const updates = editingRows[id];
    if (!updates || Object.keys(updates).length === 0) return;

    try {
      const dbRef = doc(db, 'sales', id);
      const finalUpdates: any = { ...updates };
      
      // Auto-assign current user if analyst wasn't manually selected but retention state changed
      if ('retido' in updates && !updates.usuarioRetencaoId) {
        if (updates.retido === 'Sim' || updates.retido === 'Não') {
          finalUpdates.dataRetencao = Date.now();
          finalUpdates.usuarioRetencaoId = currentUser?.uid || '';
          finalUpdates.usuarioRetencaoNome = currentUser?.displayName || currentUser?.email || 'Usuário Desconhecido';
          
          if (updates.retido === 'Sim') finalUpdates.valorDevolvido = 0;
          else finalUpdates.valorRetido = 0;
        } else if (updates.retido === '') {
          finalUpdates.dataRetencao = null;
          finalUpdates.usuarioRetencaoId = null;
          finalUpdates.usuarioRetencaoNome = null;
          finalUpdates.valorRetido = 0;
          finalUpdates.valorDevolvido = 0;
        }
      }

      // Handle manual analyst selection
      if (updates.usuarioRetencaoId) {
        const selectedAnalyst = analysts.find(a => a.id === updates.usuarioRetencaoId);
        if (selectedAnalyst) {
          finalUpdates.usuarioRetencaoNome = selectedAnalyst.displayName || selectedAnalyst.email;
          finalUpdates.dataRetencao = Date.now();
        }
      }

      if ('formaPagamentoEntrada' in updates && updates.formaPagamentoEntrada === '') {
        finalUpdates.valorEntradaEfetiva = null;
        finalUpdates.parcelasEntrada = null;
      }

      await updateDoc(dbRef, finalUpdates);

      mutate(prev => {
        if (!prev) return [];
        return prev.map(s => {
          if (s.id === id) {
            return { ...s, ...finalUpdates };
          }
          return s;
        });
      }, { revalidate: false });

      setEditingRows(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });

    } catch (e: any) {
      alert("Erro ao salvar: " + e.message);
    }
  };

  const handleClearFields = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("Tem certeza que deseja limpar os dados de atendimento deste lançamento? Isso irá zerar a forma de pagamento, retenção e valores lançados.")) {
      return;
    }
    try {
      const dbRef = doc(db, 'sales', id);
      const finalUpdates = {
        retido: null,
        valorRetido: null,
        valorDevolvido: null,
        formaPagamentoEntrada: null,
        valorEntradaEfetiva: null,
        parcelasEntrada: null,
        dataRetencao: null,
        usuarioRetencaoId: null,
        usuarioRetencaoNome: null,
        dataCancelamento: '',
        statusContrato: 'ATIVO'
      };
      await updateDoc(dbRef, finalUpdates);

      mutate(prev => {
        if (!prev) return [];
        return prev.map(s => {
          if (s.id === id) {
             return { ...s, ...finalUpdates };
          }
          return s;
        });
      }, { revalidate: false });

      setEditingRows(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });

    } catch (err: any) {
      console.error(err);
      alert("Erro ao limpar os dados: " + err.message);
    }
  };

  const canEdit = userRole === 'admin' || userPermissions.includes('edit_atendimentos');
  const canOverride = userRole === 'admin' || userPermissions.includes('override_atendimentos');
  const canClearData = userRole === 'admin' || userPermissions.includes('clear_atendimentos');

  // Utils for Date input conversion: DB uses DD/MM/YYYY, input type="date" uses YYYY-MM-DD
  const formatForInput = (brDate?: string) => {
    if (!brDate) return '';
    const parts = brDate.split('/');
    if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
    return brDate;
  };

  if (loading && rawSales.length === 0) {
    return <SkeletonTable />;
  }

  return (
    <div className={`flex-1 flex flex-col p-5 gap-5 overflow-hidden font-sans transition-opacity duration-300 ${loading ? 'opacity-60 pointer-events-none' : 'opacity-100'}`}>
      
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
                       
                       {isExpanded && g.contracts.map((s: Sale) => {
                         const isCanceledLine = !!s.dataCancelamento && s.retido !== 'Sim';
                         
                         const isOwner = s.usuarioRetencaoId === currentUser?.uid;
                         const isRecent = s.dataRetencao ? (Date.now() - s.dataRetencao < 1000 * 60 * 60 * 2) : true; // 2 horas para correção pelo próprio autor
                         const isLockedForAnalyst = s.retido && !(isOwner && isRecent);
                         const canEditRecord = canOverride ? true : (canEdit && !isLockedForAnalyst);

                         return (
                         <tr key={s.id} className="bg-slate-50/50 text-sm border-b border-slate-100 last:border-b-2 last:border-slate-200">
                           <td colSpan={3} className="pl-10 py-3">
                              <div className="flex flex-col gap-4">
                                <div className="flex flex-wrap gap-6 items-center">
                                  <div className="flex flex-col">
                                    <span className="font-semibold text-[10px] uppercase text-slate-400 tracking-wider">Empreendimento</span>
                                    <span className="text-slate-600 font-medium truncate max-w-[150px]">{s.empreendimento || 'N/A'}</span>
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="font-semibold text-[10px] uppercase text-slate-400 tracking-wider">Localizador</span>
                                    <span className="text-slate-600 font-medium">{s.localizador}</span>
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="font-semibold text-[10px] uppercase text-slate-400 tracking-wider">Valor (VGV)</span>
                                    <span className="text-slate-600 font-medium">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(s.valor || 0)}</span>
                                  </div>
                                  
                                  <div className="h-[30px] w-[1px] bg-slate-200 hidden md:block"></div>
                                  
                                  <div className="flex gap-4 p-2 bg-indigo-50/50 border border-indigo-100 rounded-md">
                                    <div className="flex flex-col">
                                      <span className="font-semibold text-[10px] uppercase text-indigo-500 tracking-wider">Forma Pgto 1ª Parc</span>
                                      <select 
                                        className="text-xs border rounded p-1 bg-white cursor-pointer focus:ring-indigo-500 min-w-[100px]"
                                        disabled={!canEditRecord}
                                        value={editingRows[s.id!]?.formaPagamentoEntrada !== undefined ? editingRows[s.id!]?.formaPagamentoEntrada : (s.formaPagamentoEntrada || '')}
                                        onChange={(e) => handleLocalChange(s.id!, 'formaPagamentoEntrada', e.target.value)}
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <option value="">Não Inf.</option>
                                        <option value="Crédito">Crédito</option>
                                        <option value="Débito">Débito</option>
                                        <option value="PIX">PIX</option>
                                        <option value="Dinheiro">Dinheiro</option>
                                      </select>
                                    </div>

                                    {(editingRows[s.id!]?.formaPagamentoEntrada !== undefined ? editingRows[s.id!]?.formaPagamentoEntrada : s.formaPagamentoEntrada) && (
                                      <>
                                        <div className="flex flex-col">
                                          <span className="font-semibold text-[10px] uppercase text-indigo-500 tracking-wider">Entrada Efetiva (R$)</span>
                                          <div className="flex items-center gap-2">
                                            <input 
                                              type="number"
                                              className="text-xs border rounded p-1 bg-white focus:ring-indigo-500 w-[100px]"
                                              disabled={!canEditRecord}
                                              value={editingRows[s.id!]?.valorEntradaEfetiva !== undefined ? editingRows[s.id!]?.valorEntradaEfetiva : (s.valorEntradaEfetiva || '')}
                                              placeholder="Ex: 5000"
                                              onChange={(e) => handleLocalChange(s.id!, 'valorEntradaEfetiva', parseFloat(e.target.value) || undefined)}
                                              onClick={(e) => e.stopPropagation()}
                                            />
                                            <span className="text-xs font-semibold text-indigo-600 bg-indigo-100 px-2 py-1 rounded text-center min-w-[50px]">
                                              {s.valor ? 
                                                (((editingRows[s.id!]?.valorEntradaEfetiva !== undefined ? editingRows[s.id!]?.valorEntradaEfetiva : (s.valorEntradaEfetiva || 0)) as number) / s.valor * 100).toFixed(1) + '%' 
                                                : '0.0%'}
                                            </span>
                                          </div>
                                        </div>
                                        <div className="flex flex-col">
                                          <span className="font-semibold text-[10px] uppercase text-indigo-500 tracking-wider">Parcelas Entrada</span>
                                          <select 
                                            className="text-xs border rounded p-1 bg-white cursor-pointer focus:ring-indigo-500 min-w-[70px]"
                                            disabled={!canEditRecord}
                                            value={editingRows[s.id!]?.parcelasEntrada !== undefined ? editingRows[s.id!]?.parcelasEntrada : (s.parcelasEntrada || '')}
                                            onChange={(e) => handleLocalChange(s.id!, 'parcelasEntrada', parseInt(e.target.value) || undefined)}
                                            onClick={(e) => e.stopPropagation()}
                                          >
                                            <option value="">--</option>
                                            {[...Array(12)].map((_, i) => (
                                              <option key={i+1} value={i+1}>{i+1}x</option>
                                            ))}
                                          </select>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                </div>

                                <div className="flex flex-wrap gap-5 items-end p-2 bg-slate-100/50 rounded-md">
                                  <div className="flex flex-col">
                                    <span className="font-semibold text-[10px] uppercase text-slate-400 tracking-wider">Houve Retenção?</span>
                                    {s.dataCancelamento || editingRows[s.id!]?.dataCancelamento ? (
                                      <select 
                                        className="text-xs border rounded p-1 bg-white cursor-pointer focus:ring-sky-500 max-w-[120px]"
                                        disabled={!canEditRecord}
                                        value={editingRows[s.id!]?.retido !== undefined ? editingRows[s.id!]?.retido : (s.retido || '')}
                                        onChange={(e) => handleLocalChange(s.id!, 'retido', e.target.value)}
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <option value="">Selecione...</option>
                                        <option value="Sim">Sim</option>
                                        <option value="Não">Não</option>
                                      </select>
                                    ) : (
                                      <span className="text-slate-400 text-[11px] italic mt-1">N/A (Sem Solicitação)</span>
                                    )}
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="font-semibold text-[10px] uppercase text-slate-400 tracking-wider text-nowrap">
                                      {(editingRows[s.id!]?.retido ?? s.retido) === 'Sim' ? 'Valor Retido (R$)' : (editingRows[s.id!]?.retido ?? s.retido) === 'Não' ? 'Valor Devolvido (R$)' : 'Valor Alvo'}
                                    </span>
                                    {(editingRows[s.id!]?.retido ?? s.retido) === 'Sim' ? (
                                      <input 
                                        type="number"
                                        className="text-xs border rounded p-1 bg-white focus:ring-sky-500 max-w-[120px]"
                                        disabled={!canEditRecord}
                                        value={editingRows[s.id!]?.valorRetido !== undefined ? editingRows[s.id!]?.valorRetido : (s.valorRetido || '')}
                                        placeholder="Ex: 5000"
                                        onChange={(e) => handleLocalChange(s.id!, 'valorRetido', parseFloat(e.target.value) || undefined)}
                                        onClick={(e) => e.stopPropagation()}
                                      />
                                    ) : (editingRows[s.id!]?.retido ?? s.retido) === 'Não' ? (
                                      <input 
                                        type="number"
                                        className="text-xs border rounded p-1 bg-white focus:ring-sky-500 max-w-[120px]"
                                        disabled={!canEditRecord}
                                        value={editingRows[s.id!]?.valorDevolvido !== undefined ? editingRows[s.id!]?.valorDevolvido : (s.valorDevolvido || '')}
                                        placeholder="Ex: 15000"
                                        onChange={(e) => handleLocalChange(s.id!, 'valorDevolvido', parseFloat(e.target.value) || undefined)}
                                        onClick={(e) => e.stopPropagation()}
                                      />
                                    ) : (
                                      <span className="text-slate-400 text-[11px] italic mt-1">-</span>
                                    )}
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="font-semibold text-[10px] uppercase text-slate-400 tracking-wider">Analista</span>
                                    {(editingRows[s.id!]?.retido ?? s.retido) ? (
                                      <select 
                                        className="text-[11px] border rounded p-1 bg-white cursor-pointer focus:ring-sky-500 mt-1 min-w-[140px]"
                                        disabled={!canEditRecord}
                                        value={editingRows[s.id!]?.usuarioRetencaoId !== undefined ? editingRows[s.id!]?.usuarioRetencaoId : (s.usuarioRetencaoId || '')}
                                        onChange={(e) => handleLocalChange(s.id!, 'usuarioRetencaoId', e.target.value)}
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <option value="">Selecione o Analista...</option>
                                        {analysts.map(a => (
                                          <option key={a.id} value={a.id}>{a.displayName || a.email.split('@')[0]}</option>
                                        ))}
                                      </select>
                                    ) : (
                                      <span className="text-slate-400 text-[11px] italic mt-1">-</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="mt-3 w-full flex justify-end gap-2">
                                {canClearData && (
                                  <button 
                                    onClick={(e) => handleClearFields(s.id!, e)}
                                    className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-3 py-1.5 rounded text-[11px] font-bold shadow-sm flex items-center gap-1 transition-colors"
                                  >
                                    <X size={14}/> Limpar Dados
                                  </button>
                                )}
                                {editingRows[s.id!] && Object.keys(editingRows[s.id!] || {}).length > 0 && (
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); handleSaveRow(s.id!, s); }}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded text-[11px] font-bold shadow flex items-center gap-1 transition-colors"
                                  >
                                    <Save size={14}/> Salvar Lançamento
                                  </button>
                                )}
                              </div>
                           </td>
                           <td className="font-semibold text-center text-slate-500">1</td>
                           <td>
                             <div className="flex flex-col">
                               <input 
                                 type="date" 
                                 className="input-field w-full max-w-[130px] text-xs cursor-pointer bg-white"
                                 disabled={!canEditRecord}
                                 min={formatForInput(s.dataAtendimento)}
                                 max={maxDateAllowed}
                                 value={formatForInput(editingRows[s.id!]?.dataCancelamento !== undefined ? editingRows[s.id!]?.dataCancelamento : s.dataCancelamento)}
                                 onChange={(e) => handleDateChange(s.id!, e.target.value)}
                                 onClick={(e) => e.stopPropagation()}
                               />
                             </div>
                           </td>
                           <td className="font-semibold text-center text-red-500">{isCanceledLine ? 1 : 0}</td>
                           <td className="font-semibold text-emerald-600 text-center">{isCanceledLine ? 0 : 1}</td>
                         </tr>
                       )})}
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
