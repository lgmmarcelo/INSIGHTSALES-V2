import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, Calendar, Search, Download } from 'lucide-react';
import { Sale } from '../types';
import { parseDateLocal } from '../lib/utils';
import * as XLSX from 'xlsx';
import { useSalesData } from '../hooks/useSalesData';
import { SkeletonTable } from '../components/ui/SkeletonTable';

export default function RelatorioRetencao() {
  const { userRole, userPermissions } = useAuth();
  
  // Default month
  const [monthSelection, setMonthSelection] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const { rawSales, loading } = useSalesData(startDate, endDate);

  const sales = useMemo(() => {
    return rawSales.filter(d => {
      // Date Filter
      if (startDate && (!d.dataAtendimentoIso || d.dataAtendimentoIso < startDate)) return false;
      const maxEndBound = endDate ? endDate.substring(0, 8) + '31' : null;
      if (maxEndBound && d.dataAtendimentoIso && d.dataAtendimentoIso > maxEndBound) return false;
      
      return d.retido === 'Sim' || d.retido === 'Não';
    });
  }, [rawSales, startDate, endDate]);

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

  // Aggregation per user
  const userStats = useMemo(() => {
    const stats: Record<string, { nome: string; totalAtendimentos: number; cotasRetidas: number; vgvRetido: number; vgvDevolvido: number }> = {};
    
    sales.forEach(sale => {
      const uid = sale.usuarioRetencaoId || 'N/A';
      const nome = sale.usuarioRetencaoNome?.split('@')[0] || 'Usuário Desconhecido';
      
      if (!stats[uid]) {
        stats[uid] = { nome, totalAtendimentos: 0, cotasRetidas: 0, vgvRetido: 0, vgvDevolvido: 0 };
      }
      
      stats[uid].totalAtendimentos += 1;
        
      if (sale.retido === 'Sim') {
        stats[uid].cotasRetidas += 1;
        stats[uid].vgvRetido += (sale.valorRetido || 0);
      } else if (sale.retido === 'Não') {
        stats[uid].vgvDevolvido += (sale.valorDevolvido || 0);
      }
    });
    
    return Object.values(stats).sort((a, b) => b.vgvRetido - a.vgvRetido);
  }, [sales]);

  const totaisGerais = useMemo(() => {
    return userStats.reduce((acc, curr) => {
      acc.atendimentos += curr.totalAtendimentos;
      acc.cotas += curr.cotasRetidas;
      acc.vgv += curr.vgvRetido;
      acc.vgvDev += curr.vgvDevolvido;
      return acc;
    }, { atendimentos: 0, cotas: 0, vgv: 0, vgvDev: 0 });
  }, [userStats]);

  const canView = userRole === 'admin' || userPermissions.includes('edit_atendimentos') || userPermissions.includes('view_retencao'); // Assuming they have access if they can edit

  const exportToExcel = () => {
    if (userStats.length === 0) {
      alert("Nenhum dado para exportar");
      return;
    }

    const dataToExport = userStats.map(stat => ({
      'Analista Pós-Vendas': stat.nome,
      'Total Atendimentos': stat.totalAtendimentos,
      'Cotas Retidas': stat.cotasRetidas,
      'Sucesso (%)': stat.totalAtendimentos > 0 ? Math.round((stat.cotasRetidas / stat.totalAtendimentos) * 100) : 0,
      'VGV Retido (R$)': stat.vgvRetido,
      'VGV Devolvido (R$)': stat.vgvDevolvido,
    }));

    // Add totals row
    dataToExport.push({
      'Analista Pós-Vendas': 'TOTAL GERAL',
      'Total Atendimentos': totaisGerais.atendimentos,
      'Cotas Retidas': totaisGerais.cotas,
      'Sucesso (%)': totaisGerais.atendimentos > 0 ? Math.round((totaisGerais.cotas / totaisGerais.atendimentos) * 100) : 0,
      'VGV Retido (R$)': totaisGerais.vgv,
      'VGV Devolvido (R$)': totaisGerais.vgvDev,
    });

    const ws = XLSX.utils.json_to_sheet(dataToExport);

    // Format column widths
    const wscols = [
      { wch: 30 }, // Analista
      { wch: 15 }, // Atendimentos
      { wch: 15 }, // Cotas Retidas
      { wch: 12 }, // Sucesso
      { wch: 20 }, // VGV Retido
      { wch: 20 }, // VGV Devolvido
    ];
    ws['!cols'] = wscols;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Retenção");

    const fileName = `Relatorio_Retencao_${startDate}_a_${endDate}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  if (!canView) {
    return (
      <div className="flex-1 flex items-center justify-center font-sans text-slate-500">
        Acesso restrito. Você não possui permissão para visualizar retenções.
      </div>
    );
  }

  if (loading && rawSales.length === 0) {
    return <SkeletonTable />;
  }

  return (
    <div className={`flex-1 flex flex-col p-5 gap-5 overflow-auto font-sans transition-opacity duration-300 ${loading ? 'opacity-60 pointer-events-none' : 'opacity-100'}`}>
      <div className="mb-2 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 flex items-center gap-2">
            <ShieldCheck className="text-sky-600" />
            Relatório de Retenção
          </h1>
          <p className="text-slate-500 text-sm mt-1">Análise de cotas canceladas que foram revertidas e salvas pelos analistas.</p>
        </div>
        <button
          onClick={exportToExcel}
          disabled={loading || userStats.length === 0}
          className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-md shadow-sm transition-colors text-sm flex items-center gap-2"
        >
          <Download size={16} /> Exportar Excel
        </button>
      </div>

      <div className="flex items-center justify-between bg-white p-4 border border-slate-200 rounded-lg shrink-0 shadow-sm flex-wrap gap-4">
        <div className="flex gap-6 items-center flex-wrap">
          <div className="flex flex-col">
            <label className="text-[10px] uppercase text-sky-700 font-bold tracking-wider mb-1">Mês Base das Vendas</label>
            <input 
              type="month" 
              value={monthSelection}
              onChange={(e) => setMonthSelection(e.target.value)}
              className="text-sm border border-slate-200 rounded-md px-2 py-1.5 focus:outline-none focus:border-sky-400 font-semibold text-slate-700 w-36 shadow-sm" 
            />
          </div>
          <div className="h-[30px] w-[1px] bg-slate-200 hidden md:block"></div>
          <div className="flex flex-col">
            <label className="text-[10px] uppercase text-slate-500 font-bold tracking-wider mb-1">Período Exato</label>
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
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-5 object-top shrink-0">
         <div className="bg-white p-5 border border-slate-200 rounded-lg shadow-sm flex items-center justify-between border-l-4 border-l-slate-400">
           <div>
             <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Total Atendimentos</span>
             <span className="text-2xl font-extrabold text-slate-800">{totaisGerais.atendimentos}</span>
           </div>
         </div>
         <div className="bg-white p-5 border border-slate-200 rounded-lg shadow-sm flex items-center justify-between border-l-4 border-l-sky-500">
           <div>
             <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Eficiência Geral</span>
             <span className="text-2xl font-extrabold text-sky-700">
                {totaisGerais.atendimentos > 0 ? Math.round((totaisGerais.cotas / totaisGerais.atendimentos) * 100) : 0}%
             </span>
           </div>
         </div>
         <div className="bg-white p-5 border border-slate-200 rounded-lg shadow-sm flex items-center justify-between border-l-4 border-l-emerald-500">
           <div>
             <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">VGV Retido</span>
             <span className="text-lg font-extrabold text-emerald-700 block truncate max-w-[120px]">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totaisGerais.vgv)}
             </span>
           </div>
         </div>
         <div className="bg-white p-5 border border-slate-200 rounded-lg shadow-sm flex items-center justify-between border-l-4 border-l-red-500">
           <div>
             <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">VGV Devolvido</span>
             <span className="text-lg font-extrabold text-red-600 block truncate max-w-[120px]">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totaisGerais.vgvDev)}
             </span>
           </div>
         </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden flex-1 flex flex-col">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
           <ShieldCheck size={18} className="text-slate-500"/>
           <h3 className="font-bold text-slate-700">Ranking de Retenção por Usuário</h3>
        </div>
        <div className="overflow-auto flex-1 p-0">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-100/50 sticky top-0 z-10 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
              <tr className="border-b border-slate-200 text-xs text-slate-500 uppercase tracking-wider font-extrabold">
                <th className="p-4">Analista Pós-Vendas</th>
                <th className="p-4 text-center">Atendimentos</th>
                <th className="p-4 text-center">Sucesso</th>
                <th className="p-4 text-center">Eficiência</th>
                <th className="p-4 text-right">VGV Retido Total</th>
                <th className="p-4 text-right">VGV Devolvido</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                   <td colSpan={6} className="text-center p-8 text-slate-400 font-semibold animate-pulse">Consultando dados...</td>
                </tr>
              ) : userStats.length === 0 ? (
                <tr>
                   <td colSpan={6} className="text-center p-8 text-slate-400">Nenhum registro de retenção no período selecionado.</td>
                </tr>
              ) : (
                userStats.map((stat, idx) => (
                  <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="p-4 font-bold text-slate-700 flex items-center gap-3">
                       <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center text-xs font-bold shrink-0">
                          {stat.nome.charAt(0).toUpperCase()}
                       </div>
                       {stat.nome}
                    </td>
                    <td className="p-4 text-center font-bold text-slate-600">{stat.totalAtendimentos}</td>
                    <td className="p-4 text-center font-extrabold text-sky-700">{stat.cotasRetidas}</td>
                    <td className="p-4 text-center font-bold text-slate-500">
                      {stat.totalAtendimentos > 0 ? Math.round((stat.cotasRetidas / stat.totalAtendimentos) * 100) : 0}%
                    </td>
                    <td className="p-4 text-right font-bold text-emerald-700">
                       {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stat.vgvRetido)}
                    </td>
                    <td className="p-4 text-right font-bold text-red-500">
                       {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stat.vgvDevolvido)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
