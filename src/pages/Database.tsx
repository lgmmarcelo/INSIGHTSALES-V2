import { useState, useEffect } from 'react';
import { collection, getDocs, doc, setDoc, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { DownloadCloud, ShieldCheck, Database as DbIcon, Info, Upload, CheckCircle, Trash2, Link } from 'lucide-react';
import * as xlsx from 'xlsx';

export default function DatabaseManagement() {
  const [loadingBackup, setLoadingBackup] = useState(false);
  const [loadingUpload, setLoadingUpload] = useState(false);
  const [uploadStatusText, setUploadStatusText] = useState('');
  const [recordCount, setRecordCount] = useState<number | null>(null);
  const [successMsg, setSuccessMsg] = useState('');
  
  // States for cross-uploading
  const [fileContratos, setFileContratos] = useState<File | null>(null);
  const [fileAtendimentos, setFileAtendimentos] = useState<File | null>(null);

  // States for targeted deletion
  const [deleteStartDate, setDeleteStartDate] = useState('');
  const [deleteEndDate, setDeleteEndDate] = useState('');
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  useEffect(() => {
    getDocs(collection(db, 'sales')).then(snap => setRecordCount(snap.size)).catch(() => {});
  }, []);

  const handleBackup = async () => {
    // ... logic remains standard
    setLoadingBackup(true);
    try {
      const querySnapshot = await getDocs(collection(db, 'sales'));
      const data: any[] = [];
      querySnapshot.forEach((doc) => {
        data.push(doc.data());
      });

      if (data.length === 0) {
        alert("O banco de dados está vazio.");
        return;
      }

      const ws = xlsx.utils.json_to_sheet(data);
      const wb = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(wb, ws, "Backup Sales");

      const today = new Date();
      const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      
      xlsx.writeFile(wb, `Backup_InsightSales_${dateStr}.xlsx`);
    } catch (e: any) {
      alert("Erro ao gerar backup: " + e.message);
    } finally {
      setLoadingBackup(false);
    }
  };

  const executeTargetedDelete = async () => {
    if (confirmText !== 'APAGAR') return;
    setLoadingBackup(true);
    try {
       const snap = await getDocs(collection(db, 'sales'));
       const docsToDelete = snap.docs.filter((d) => {
          if (!deleteStartDate && !deleteEndDate) {
              return true; // Nuke all
          }

          const data = d.data();
          
          let isoCompare = data.dataAtendimentoIso;
          
          // Fallback algorithm for old records that don't have the Iso field
          if (!isoCompare && data.dataAtendimento) {
             const parts = data.dataAtendimento.split('/');
             if (parts.length === 3) {
                 isoCompare = `${parts[2]}-${parts[1]}-${parts[0]}`;
             }
          }

          if (!isoCompare) {
             // If we really can't determine the date, and the user provided wide dates, delete it anyway to clear the corruption.
             return true; 
          }
          
          return isoCompare >= deleteStartDate && isoCompare <= deleteEndDate;
       });

       if (docsToDelete.length === 0) {
          alert('Nenhum registro encontrado para este período exato.');
          setLoadingBackup(false);
          setShowConfirmDelete(false);
          setConfirmText('');
          return;
       }

       const chunk = 300;
       for(let i=0; i<docsToDelete.length; i+=chunk) {
          const batch = writeBatch(db);
          docsToDelete.slice(i, i+chunk).forEach(d => batch.delete(d.ref));
          await batch.commit();
       }
       
       alert(`Sucesso! ${docsToDelete.length} registros permanentemente apagados do sistema.`);
       
       getDocs(collection(db, 'sales')).then(snap => setRecordCount(snap.size)).catch(() => {});
       setSuccessMsg('Registros apagados.');
       setShowConfirmDelete(false);
       setConfirmText('');
       setDeleteStartDate('');
       setDeleteEndDate('');
       setTimeout(() => setSuccessMsg(''), 5000);
    } catch (e: any) {
       alert("Erro ao limpar base: " + e.message);
    } finally {
       setLoadingBackup(false);
    }
  };

  function formatExcelDate(excelValue: any) {
    if (!excelValue) return '';
    if (typeof excelValue === 'number') {
        const d = new Date(Math.round((excelValue - 25569) * 86400 * 1000));
        const dd = String(d.getUTCDate()).padStart(2, '0');
        const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
        const yyyy = d.getUTCFullYear();
        return `${dd}/${mm}/${yyyy}`;
    }
    return String(excelValue).trim();
  }

  const readExcel = (file: File) => new Promise<any[]>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
         try {
             const wb = xlsx.read(e.target?.result, { type: 'binary' });
             const ws = wb.Sheets[wb.SheetNames[0]];
             const data = xlsx.utils.sheet_to_json(ws, { header: 'A', defval: '' });
             resolve(data);
         } catch (err) {
             reject(err);
         }
      };
      reader.onerror = reject;
      reader.readAsBinaryString(file);
  });

  const handleCrossUpload = async () => {
    if (!fileContratos || !fileAtendimentos) {
       alert("Selecione ambas as planilhas antes de importar.");
       return;
    }

    setLoadingUpload(true);
    setUploadStatusText('Iniciando envio...');
    setSuccessMsg('');

    // Allow browser to render loading state
    await new Promise(r => setTimeout(r, 50));

    try {
      setUploadStatusText('Lendo planilha de Contratos...');
      await new Promise(r => setTimeout(r, 50));
      const dataContratos = await readExcel(fileContratos);

      setUploadStatusText('Lendo planilha de Atendimentos...');
      await new Promise(r => setTimeout(r, 50));
      const dataAtend = await readExcel(fileAtendimentos);

      setUploadStatusText('Consolidando e salvando na nuvem (isso pode demorar varios segundos)...');
      await new Promise(r => setTimeout(r, 50));

      // Phase 1: Map Atendimentos purely for Demographic enrichment
      const atendMapByLoc: Record<string, any> = {};
      const atendMapByCpf: Record<string, any> = {};
      const atendMapByName: Record<string, any> = {};
      
      for (const row of dataAtend) {
          const locVenda = String(row['BA'] || '').trim();
          if (locVenda && !locVenda.toUpperCase().includes('LOCALIZADOR')) {
             atendMapByLoc[locVenda] = row;
          }
          
          const cpfRaw = String(row['G'] || '').replace(/\D/g, '');
          if (cpfRaw && cpfRaw.length >= 5) {
             atendMapByCpf[cpfRaw] = row;
          }

          const nameRaw = String(row['F'] || '').trim().toUpperCase();
          if (nameRaw && nameRaw.length > 5) {
             atendMapByName[nameRaw] = row;
          }
      }

      // Phase 2: Iterate Contratos and merge with Atendimentos mapping
      let processed = 0;
      let skippedConfig = 0;
      let currentBatch = writeBatch(db);
      let batchCount = 0;
      
      const docIdCounts: Record<string, number> = {};

      for (const cRow of dataContratos) {
          // Headers protection
          const headCheck = String(cRow['A'] || '').toUpperCase();
          if (headCheck.includes('LOCALIZADOR') || headCheck.includes('STATUS')) continue;

          // Permissive check to catch "Ativo ", "ATIVOS", "Cancelada", etc
          const status = String(cRow['Y'] || '').toUpperCase();
          if (!status.includes('ATIV') && !status.includes('CANCEL')) {
              skippedConfig++;
              continue;
          }

          // O Código (Coluna E) é a chave primária única da cota. O Localizador geralmente é do Atendimento.
          const localizador = String(cRow['A'] || '').trim();
          const codigo = String(cRow['E'] || '').trim();
          
          let baseDocId = codigo || (localizador ? `${localizador}-S/Cod` : `cota-SemCod`);
          baseDocId = baseDocId.replace(/\//g, '-').replace(/\\/g, '-').trim();

          // Anti-Sobreposição Determinística: Controla duplicatas baseadas no mesmo código 
          // durante a mesma importação, para não gerar IDs infinitos, permitindo que subidas das 
          // mesmas planilhas sobrescrevam (merge) a mesma combinação exata de cota irmã.
          docIdCounts[baseDocId] = (docIdCounts[baseDocId] || 0) + 1;
          const occurrence = docIdCounts[baseDocId];
          const docId = occurrence > 1 ? `${baseDocId}-${occurrence}` : baseDocId;

          const cpf1 = String(cRow['H'] || '').replace(/\D/g, '');
          const cpf2 = String(cRow['J'] || '').replace(/\D/g, '');

          // Multiproduto: Procura pelo Localizador. Se falhar (comprou + de 1 cota mas o atendimento só registrou 1 localizador), 
          // nós casamos pelo CPF do Cliente 1 ou Cliente 2.
          let aRow = atendMapByLoc[localizador];
          if (!aRow && cpf1) aRow = atendMapByCpf[cpf1];
          if (!aRow && cpf2) aRow = atendMapByCpf[cpf2];

          // Se Cessionário 1 existe mas tá sem CPF, tentar casar pelo NOME do Cessionario 1
          const cessionarioNomeContratos = String(cRow['G'] || '').trim().toUpperCase();
          if (!aRow && cessionarioNomeContratos) {
             aRow = atendMapByName[cessionarioNomeContratos];
          }

          // If aRow is still undefined, we create an empty fallback so the Venda is not lost.
          aRow = aRow || {};

          // Data da venda (Fielmente pela Coluna F "DATA" da aba Contratos)
          const dataAtendimento = formatExcelDate(cRow['F']);
          
          let dataAtendimentoIso = "";
          if (dataAtendimento && dataAtendimento.includes('/')) {
              const p = dataAtendimento.split('/');
              if(p.length === 3) dataAtendimentoIso = `${p[2]}-${p[1]}-${p[0]}`;
          }

          // COlumn H is ALWAYS the master CPF. Column G in Contratos is Cessionario 1 Name.
          const clienteNome = String(cRow['G'] || aRow['F'] || 'S/N');
          // Start with cpf1 (Column H of Contratos), then try cpf2 (Column J), then finally fallback to Atendimentos
          const cpfRaw = cpf1 || cpf2 || String(aRow['G'] || '').replace(/\D/g, '');
          
          // Force numbers only formatting for Currency
          let rawValor = cRow['BN'] || cRow['BM'] || cRow['BL']; // Try to catch Value
          let valorNum = 0;
          if (typeof rawValor === 'number') {
              valorNum = rawValor;
          } else if (typeof rawValor === 'string') {
              valorNum = parseFloat(rawValor.replace(/[^\d,-]/g, '').replace(',', '.')) || 0;
          }

          const saleDoc = {
            localizador,
            codigo,
            cpf: cpfRaw,
            cliente: clienteNome,
            empreendimento: String(cRow['AR'] || ''),
            valor: valorNum,
            
            // Puxando dados da equipe PREFERENCIALMENTE da Aba Contratos (BZ, CA, CB), 
            // e usando Atendimentos apenas como plano B de segurança secundária.
            // Algumas colunas ficam invisíveis no Excel dependendo da versão, 
            // e mudam a matriz. Vamos "Atirar com Escopeta" pegando da BZ até a CF para garantir.
            captador: String(cRow['BY'] || cRow['BZ'] || cRow['CA'] || '').trim() || String(aRow['BK'] || '').trim() || '',
            consultor: String(cRow['CA'] || cRow['CB'] || cRow['CC'] || '').trim() || String(aRow['BM'] || '').trim() || '',
            to: String(cRow['CB'] || cRow['CC'] || cRow['CD'] || '').trim() || String(aRow['BO'] || '').trim() || '',
            sala: String(cRow['X'] || '').trim() || String(aRow['AL'] || '').trim() || '',
            pontoCaptacao: String(cRow['BV'] || '').trim(),

            dataAtendimento,
            dataAtendimentoIso,
            statusContrato: status,

            // Demographics from Atendimentos
            idade1: String(aRow['O'] || ''),
            idade2: String(aRow['P'] || ''),
            profissao1: String(aRow['Q'] || ''),
            profissao2: String(aRow['R'] || ''),
            estadoCivil: String(aRow['W'] || ''),
            renda: String(aRow['AB'] || ''),
            cidade: String(aRow['AC'] || ''),
            estado: String(aRow['AD'] || ''),
            possuiVeiculo: String(aRow['AE'] || ''),
            anoVeiculo: String(aRow['AF'] || ''),
            possuiCasaPropria: String(aRow['AG'] || ''),
            
            uploadedAt: Date.now()
          };

          currentBatch.set(doc(db, 'sales', docId), saleDoc, { merge: true });
          processed++;
          batchCount++;

          if (batchCount >= 400) {
            await currentBatch.commit();
            currentBatch = writeBatch(db);
            batchCount = 0;
          }
      }
      
      if (batchCount > 0) {
        await currentBatch.commit();
      }

      setSuccessMsg(`Sucesso: ${processed} contratos foram atrelados aos seus atendimentos e importados. (${skippedConfig} ignorados).`);
      getDocs(collection(db, 'sales')).then(snap => setRecordCount(snap.size)).catch(() => {});
      setTimeout(() => setSuccessMsg(''), 8000);

    } catch (err: any) {
      alert("Erro na interseção de dados: " + err.message);
    } finally {
      setLoadingUpload(false);
      setUploadStatusText('');
      setFileContratos(null);
      setFileAtendimentos(null);
    }
  };

  return (
    <div className="flex-1 overflow-auto p-5 gap-5 flex flex-col h-full font-sans">
      <div className="mb-2">
        <h1 className="text-2xl font-extrabold text-slate-800 flex items-center gap-2">
          <DbIcon className="text-sky-600" />
          Gestão de Banco de Dados
        </h1>
        <p className="text-slate-500 text-sm mt-1">Gerencie, preserve e faça o backup físico de toda a inteligência do sistema.</p>
      </div>

      <div className="bg-white p-6 border border-slate-200 rounded-lg shadow-sm">
        <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
           <Link size={18} />
           Carga Dupla (Matriz de Inteligência)
        </h2>
        <p className="text-sm text-slate-500 mb-6">Para extrair a modelagem definitiva e exibir apenas quem efetivamente fechou negócio, o sistema necessita realizar o cruzamento entre as duas bases utilizando a chave "Localizador". Selecione abaixo as duas matrizes e clique. <b>Somente clientes que possuírem status 'Ativo' ou 'Cancelado' nos contratos serão processados.</b></p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
           <div className={`p-4 border border-dashed rounded-lg flex flex-col gap-2 transition-colors ${fileContratos ? 'border-emerald-400 bg-emerald-50' : 'border-slate-300 bg-slate-50'}`}>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Passo 1</span>
              <span className="font-semibold text-sm text-slate-700">Suba a Planilha "CONTRATOS"</span>
              <input 
                 type="file" accept=".xlsx, .xls"
                 onChange={(e) => setFileContratos(e.target.files?.[0] || null)}
                 className="text-xs cursor-pointer file:mr-4 file:rounded-md file:border-0 file:bg-slate-200 file:px-4 file:py-2 file:text-xs file:font-bold hover:file:bg-slate-300"
              />
           </div>
           
           <div className={`p-4 border border-dashed rounded-lg flex flex-col gap-2 transition-colors ${fileAtendimentos ? 'border-emerald-400 bg-emerald-50' : 'border-slate-300 bg-slate-50'}`}>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Passo 2</span>
              <span className="font-semibold text-sm text-slate-700">Suba a Planilha "ATENDIMENTOS"</span>
              <input 
                 type="file" accept=".xlsx, .xls"
                 onChange={(e) => setFileAtendimentos(e.target.files?.[0] || null)}
                 className="text-xs cursor-pointer file:mr-4 file:rounded-md file:border-0 file:bg-slate-200 file:px-4 file:py-2 file:text-xs file:font-bold hover:file:bg-slate-300"
              />
           </div>
        </div>

        <button 
           onClick={handleCrossUpload}
           disabled={!fileContratos || !fileAtendimentos || loadingUpload}
           className="w-full sm:w-auto bg-sky-600 outline-none hover:bg-sky-700 text-white font-bold py-3 px-8 rounded-md shadow-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
           {loadingUpload ? <span className="animate-pulse">{uploadStatusText || 'Carregando...'}</span> : <><Upload size={16}/> Cruzar e Importar Bases</>}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-5">
        {/* Backup Card */}
        <div className="bg-white p-6 border border-slate-200 rounded-lg shadow-sm flex flex-col">
          <div className="flex items-center gap-3 mb-4 text-sky-700">
            <div className="bg-sky-100 p-3 rounded-full">
              <DownloadCloud size={24} />
            </div>
            <div>
              <h2 className="font-bold text-lg leading-tight">Exportar Backup Completo</h2>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Rotina de Segurança</span>
            </div>
          </div>
          
          <p className="text-sm text-slate-600 mb-6 flex-1">
            Gera uma planilha contendo a união <b>absoluta</b> de todos os dados do sistema. Esta planilha mescla tanto as informações brutas que vieram do sistema ERP (Excel original) quanto os inputs manuais salvos pelos analistas diretamente na plataforma (Prazos, Cotas e Cancelamentos).
          </p>
          
          <div className="flex items-center justify-between mt-auto">
            <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
              <DbIcon size={14}/> {recordCount !== null ? `${recordCount} registros na nuvem` : 'Lendo dados...'}
            </span>
            <button 
              onClick={handleBackup}
              disabled={loadingBackup || loadingUpload || recordCount === 0}
              className="bg-sky-600 text-white font-bold py-2.5 px-6 rounded-md shadow-sm transition-colors hover:bg-sky-700 disabled:opacity-50 flex items-center gap-2"
            >
              {loadingBackup ? 'Compilando...' : 'Baixar .XLSX agora'}
            </button>
          </div>
        </div>

        {/* Info Card */}
        <div className="bg-emerald-50 p-6 border border-emerald-100 rounded-lg shadow-sm flex flex-col">
          <div className="flex items-center gap-3 mb-4 text-emerald-800">
            <div className="bg-emerald-100 p-3 rounded-full">
              <ShieldCheck size={24} />
            </div>
            <div>
              <h2 className="font-bold text-lg leading-tight">Arquitetura de Preservação Anti-Perda</h2>
              <span className="text-xs font-semibold text-emerald-600/80 uppercase tracking-widest">Proteção do Sistema</span>
            </div>
          </div>
          
          <div className="text-sm text-emerald-800/80 mb-6 flex-1 space-y-3">
            <p>
              Ao realizar importações de planilhas de meses muito passados, você <b>não corre o risco</b> de sobrescrever o trabalho de curadoria dos Analistas.
            </p>
            <p className="flex items-start gap-2 bg-white/50 p-3 rounded border border-emerald-200/50">
              <Info size={16} className="shrink-0 mt-0.5 text-emerald-600" />
              <span>O motor do InsightSales utiliza Injeção de Dados com <code>merge:true</code>. Se uma linha for re-importada, o sistema apenas atualiza as colunas de "Venda e Valores", mas <b>ignora respeitosamente</b> as "Datas de Cancelamento" e "Cotas Canceladas" que já haviam sido cadastradas à mão na nuvem.</span>
            </p>
          </div>
        </div>
      </div>
      
      {/* Danger Zone */}
      <div className="border border-red-200 bg-white rounded-lg p-6 shadow-sm mt-2 flex flex-col gap-4">
         <div>
          <h2 className="text-red-700 font-bold mb-1 flex items-center gap-2"><Trash2 size={18}/> Zona de Perigo (Exclusão)</h2>
           <p className="text-sm text-slate-500 max-w-3xl">Apaga permanentemente os dados. Se você não selecionar datas, <b>TODA O BANCO DE DADOS SERÁ DESTRUÍDO</b>.</p>
         </div>
         
         {!showConfirmDelete ? (
           <div className="flex items-end gap-3 p-4 bg-slate-50 border border-slate-200 rounded-md max-w-3xl">
             <div className="flex flex-col flex-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 tracking-wider">A PARTIR DE (OPCIONAL)</label>
                <input 
                  type="date" 
                  value={deleteStartDate} 
                  onChange={(e) => setDeleteStartDate(e.target.value)}
                  className="w-full text-sm border-slate-300 rounded shadow-sm p-2 focus:ring-sky-500 focus:border-sky-500 text-slate-700"
                />
             </div>
             <div className="flex flex-col flex-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 tracking-wider">ATÉ (OPCIONAL)</label>
                <input 
                  type="date" 
                  value={deleteEndDate} 
                  onChange={(e) => setDeleteEndDate(e.target.value)}
                  className="w-full text-sm border-slate-300 rounded shadow-sm p-2 focus:ring-sky-500 focus:border-sky-500 text-slate-700"
                />
             </div>
             <button 
                onClick={() => setShowConfirmDelete(true)} 
                disabled={loadingBackup || loadingUpload} 
                className="bg-red-50 text-red-700 border border-red-200 py-2 px-6 font-semibold text-sm rounded shadow-sm hover:bg-red-100 transition-colors disabled:opacity-50"
              >
               Iniciar Exclusão...
             </button>
           </div>
         ) : (
           <div className="flex flex-col gap-3 p-4 bg-red-50 border border-red-200 rounded-md max-w-2xl">
             <p className="text-sm font-semibold text-red-800">
               ⚠️ TEM CERTEZA ABSOLUTA? 
               {!deleteStartDate || !deleteEndDate 
                 ? " VOCÊ ESTÁ PRESTES A APAGAR 100% DO BANCO DE DADOS." 
                 : ` Todos os registros de ${deleteStartDate.split('-').reverse().join('/')} até ${deleteEndDate.split('-').reverse().join('/')} serão apagados.`
               }
               <br/><br/>
               Para prosseguir, digite a palavra <b>APAGAR</b> na caixa abaixo:
             </p>
             <div className="flex gap-3 items-center">
               <input 
                 type="text" 
                 placeholder="Digite APAGAR" 
                 value={confirmText}
                 onChange={(e) => setConfirmText(e.target.value)}
                 className="border-red-300 text-sm p-2 rounded shadow-sm focus:border-red-500 focus:ring-red-500"
               />
               <button 
                 onClick={executeTargetedDelete}
                 disabled={confirmText !== 'APAGAR' || loadingBackup}
                 className="bg-red-600 text-white py-2 px-4 font-bold text-sm rounded shadow-sm hover:bg-red-700 disabled:opacity-50"
               >
                 {loadingBackup ? 'Apagando...' : 'Confirmar e Apagar'}
               </button>
               <button 
                 onClick={() => { setShowConfirmDelete(false); setConfirmText(''); }}
                 className="text-slate-500 hover:text-slate-800 text-sm font-semibold ml-2 underline"
               >
                 Cancelar
               </button>
             </div>
           </div>
         )}
      </div>

      {successMsg && (
        <div className="fixed bottom-5 right-5 z-50 bg-emerald-100 text-emerald-800 p-4 rounded-md shadow-lg flex items-center gap-2 font-semibold text-sm transition-opacity">
          <CheckCircle size={18} className="text-emerald-600" />
          {successMsg}
        </div>
      )}
    </div>
  );
}
