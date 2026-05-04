import { useState, useEffect } from 'react';

/**
 * ⚠️ CABEÇALHO DE PROTEÇÃO DO MOTOR DE DADOS (InsightSales)
 * AS REGRAS DE IMPORTAÇÃO, CRUZAMENTO (LEFT-JOIN) E GERAÇÃO DE ID DETERMINÍSTICO
 * NESTE ARQUIVO SÃO IMUTÁVEIS PARA GARANTIR A CONSISTÊNCIA DE 2026.
 */
import { collection, getDocs, getCountFromServer, doc, setDoc, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { mutate } from 'swr';
import { DownloadCloud, ShieldCheck, Database as DbIcon, Info, Upload, CheckCircle, Trash2, Link } from 'lucide-react';
import * as xlsx from 'xlsx';
import { Sale } from '../types';
import { useAuth } from '../context/AuthContext';

export default function DatabaseManagement() {
  const { userRole, userPermissions } = useAuth();
  
  const canUpload = userRole === 'admin' || userPermissions.includes('db_upload');
  const canExport = userRole === 'admin' || userPermissions.includes('db_export');
  const canRestore = userRole === 'admin' || userPermissions.includes('db_restore');
  const canDelete = userRole === 'admin' || userPermissions.includes('db_delete');

  const [loadingBackup, setLoadingBackup] = useState(false);
  const [loadingUpload, setLoadingUpload] = useState(false);
  const [uploadStatusText, setUploadStatusText] = useState('');
  const [recordCount, setRecordCount] = useState<number | null>(null);
  const [successMsg, setSuccessMsg] = useState('');
  
  // States for cross-uploading
  const [fileContratos, setFileContratos] = useState<File | null>(null);
  const [fileAtendimentos, setFileAtendimentos] = useState<File | null>(null);
  const [loadingManualBackup, setLoadingManualBackup] = useState(false);
  const [fileManualRestore, setFileManualRestore] = useState<File | null>(null);
  const [manualBackupStartDate, setManualBackupStartDate] = useState('');
  const [manualBackupEndDate, setManualBackupEndDate] = useState('');
  const [manualRestoreStartDate, setManualRestoreStartDate] = useState('');
  const [manualRestoreEndDate, setManualRestoreEndDate] = useState('');


  // States for targeted deletion
  const [deleteStartDate, setDeleteStartDate] = useState('');
  const [deleteEndDate, setDeleteEndDate] = useState('');
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  useEffect(() => {
    getCountFromServer(collection(db, 'sales')).then(snap => setRecordCount(snap.data().count)).catch(() => {});
  }, []);

  const [backupStartDate, setBackupStartDate] = useState('');
  const [backupEndDate, setBackupEndDate] = useState('');

  const handleBackup = async () => {
    setLoadingBackup(true);
    try {
      const querySnapshot = await getDocs(collection(db, 'sales'));
      const data: any[] = [];
      querySnapshot.forEach((doc) => {
        const d = doc.data();
        let add = true;
        
        let dateToCheck: number | null = null;
        
        if (d.dataAtendimento && d.dataAtendimento.includes('/')) {
            const p = d.dataAtendimento.split('/');
            if (p.length === 3) {
                const day = parseInt(p[0], 10);
                const month = parseInt(p[1], 10) - 1;
                let year = parseInt(p[2], 10);
                if (year < 100) year += 2000;
                dateToCheck = new Date(year, month, day).getTime();
            }
        } else if (d.dataAtendimentoIso) {
            const p = d.dataAtendimentoIso.split('-');
            if (p.length === 3) {
                let year = parseInt(p[0], 10);
                if (year < 100) year += 2000;
                const month = parseInt(p[1], 10) - 1;
                const day = parseInt(p[2], 10);
                dateToCheck = new Date(year, month, day).getTime();
            }
        }
        
        if (dateToCheck !== null) {
            if (backupStartDate) {
                const ds = backupStartDate.split('-');
                const startTimestamp = new Date(parseInt(ds[0], 10), parseInt(ds[1], 10) - 1, parseInt(ds[2], 10)).getTime();
                if (dateToCheck < startTimestamp) add = false;
            }
            if (backupEndDate) {
                const de = backupEndDate.split('-');
                const endTimestamp = new Date(parseInt(de[0], 10), parseInt(de[1], 10) - 1, parseInt(de[2], 10)).getTime();
                if (dateToCheck > endTimestamp) add = false;
            }
        } else {
            // If we have strict backup filters and the date is totally unknown, wait, we should probably still export it if they requested the whole DB.
            if (backupStartDate || backupEndDate) {
               add = false; 
            }
        }
        
        if (add) {
           data.push({ ...d, id: doc.id });
        }
      });

      if (data.length === 0) {
        alert("O banco de dados está vazio ou não há registros no período selecionado.");
        return;
      }

      const ws = xlsx.utils.json_to_sheet(data);
      const wb = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(wb, ws, "Backup Sales");

      const today = new Date();
      const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      
      let fileName = `Backup_InsightSales_${dateStr}.xlsx`;
      if (backupStartDate || backupEndDate) {
          fileName = `Backup_InsightSales_${backupStartDate || 'Inicio'}_ate_${backupEndDate || 'Fim'}.xlsx`;
      }

      xlsx.writeFile(wb, fileName);
    } catch (e: any) {
      alert("Erro ao gerar backup: " + e.message);
    } finally {
      setLoadingBackup(false);
    }
  };

  const handleManualDataExport = async () => {
    setLoadingManualBackup(true);
    try {
      const snap = await getDocs(collection(db, 'sales'));
      const manualEntries: any[] = [];
      snap.forEach(doc => {
          const d = doc.data();
          const hasManualData = d.formaPagamentoEntrada || d.valorEntradaEfetiva || d.parcelasEntrada || d.retido || d.dataSolicitacao;
          const docDate = d.dataVendaIso || d.dataAtendimentoIso || "";
          
          let passesFilter = true;
          if (manualBackupStartDate && docDate < manualBackupStartDate) passesFilter = false;
          if (manualBackupEndDate && docDate > manualBackupEndDate) passesFilter = false;
          
          if (hasManualData && passesFilter) {
              manualEntries.push({
                 _match_localizador: d.localizador || '',
                 _match_cpf: d.cpf || '',
                 _match_cliente: d.cliente || '',
                 formaPagamentoEntrada: d.formaPagamentoEntrada || '',
                 valorEntradaEfetiva: d.valorEntradaEfetiva !== undefined ? d.valorEntradaEfetiva : '',
                 parcelasEntrada: d.parcelasEntrada || '',
                 retido: d.retido || '',
                 valorRetido: d.valorRetido !== undefined ? d.valorRetido : '',
                 valorDevolvido: d.valorDevolvido !== undefined ? d.valorDevolvido : '',
                 dataSolicitacao: d.dataSolicitacao || '',
                 usuarioRetencaoId: d.usuarioRetencaoId || '',
                 usuarioRetencaoNome: d.usuarioRetencaoNome || '',
                 dataRetencao: d.dataRetencao || ''
              });
          }
      });
      if(manualEntries.length === 0){
         alert("Nenhum dado manual encontrado para backup!");
         return;
      }
      const ws = xlsx.utils.json_to_sheet(manualEntries);
      const wb = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(wb, ws, "Trabalhos Manuais");
      xlsx.writeFile(wb, `Backup_DadosManuais_InsightSales_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch(e:any) {
      alert("Erro ao exportar dados manuais: " + e.message);
    } finally {
      setLoadingManualBackup(false);
    }
  };

  const handleManualDataRestore = async () => {
    if (!fileManualRestore) return;
    setLoadingManualBackup(true);
    setUploadStatusText('Lendo backup de Trabalhos Manuais...');
    setSuccessMsg('');
    try {
        const data = await readExcelDict(fileManualRestore);
        if (data.length === 0) throw new Error('A planilha está vazia.');
        
        setUploadStatusText('Procurando e atualizando correspondências no banco atual...');
        const snap = await getDocs(collection(db, 'sales'));
        const currentSales = snap.docs.map(d => ({ id: d.id, data: d.data() }));
        
        let matchedCount = 0;
        let batchCount = 0;
        let currentBatch = writeBatch(db);
        
        for (const row of data) {
           const loc = String(row._match_localizador || row.localizador || '').trim();
           const cpf = String(row._match_cpf || row.cpf || '').trim();
           const cliente = String(row._match_cliente || row.cliente || '').trim();
           
           if (!loc && !cpf && !cliente) continue;
           
           const matches = currentSales.filter(s => {
               const sLoc = String(s.data.localizador || '').trim();
               const sCpf = String(s.data.cpf || '').trim();
               const sCliente = String(s.data.cliente || '').trim();
               
               let score = 0;
               if (loc && sLoc === loc) score++;
               if (cpf && sCpf === cpf) score++;
               if (cliente && sCliente === cliente) score++;
               
               return score >= 2;
           });
           
           for (const match of matches) {
               const docDate = match.data.dataVendaIso || match.data.dataAtendimentoIso || "";
               let passesFilter = true;
               if (manualRestoreStartDate && docDate < manualRestoreStartDate) passesFilter = false;
               if (manualRestoreEndDate && docDate > manualRestoreEndDate) passesFilter = false;
               if (!passesFilter) continue;

               const updates: any = {};
               if (row.formaPagamentoEntrada) updates.formaPagamentoEntrada = row.formaPagamentoEntrada;
               if (row.valorEntradaEfetiva !== undefined && row.valorEntradaEfetiva !== null && row.valorEntradaEfetiva !== '') updates.valorEntradaEfetiva = Number(row.valorEntradaEfetiva);
               if (row.parcelasEntrada) updates.parcelasEntrada = String(row.parcelasEntrada);
               if (row.retido) updates.retido = row.retido;
               if (row.valorRetido !== undefined && row.valorRetido !== null && row.valorRetido !== '') updates.valorRetido = Number(row.valorRetido);
               if (row.valorDevolvido !== undefined && row.valorDevolvido !== null && row.valorDevolvido !== '') updates.valorDevolvido = Number(row.valorDevolvido);
               if (row.dataSolicitacao) updates.dataSolicitacao = row.dataSolicitacao;
               if (row.usuarioRetencaoId) updates.usuarioRetencaoId = row.usuarioRetencaoId;
               if (row.usuarioRetencaoNome) updates.usuarioRetencaoNome = row.usuarioRetencaoNome;
               if (row.dataRetencao) updates.dataRetencao = Number(row.dataRetencao);
               
               if (Object.keys(updates).length > 0) {
                   currentBatch.update(doc(db, 'sales', match.id), updates);
                   matchedCount++;
                   batchCount++;
                   
                   if (batchCount >= 400) {
                      await currentBatch.commit();
                      currentBatch = writeBatch(db);
                      batchCount = 0;
                   }
               }
           }
        }
        
        if (batchCount > 0) {
            await currentBatch.commit();
        }
        
        setSuccessMsg(`Sucesso: ${matchedCount} cotas receberam a restauração dos Trabalhos Manuais de forma segura.`);
        setFileManualRestore(null);
        mutate((key) => Array.isArray(key) && key[0] === 'sales-query', undefined, { revalidate: true });
    } catch(err: any) {
        alert("Erro ao restaurar manuais: " + err.message);
    } finally {
        setUploadStatusText('');
        setLoadingManualBackup(false);
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
          
          let dateToCheck: number | null = null;
          
          if (data.dataAtendimento && data.dataAtendimento.includes('/')) {
              const p = data.dataAtendimento.split('/');
              if (p.length === 3) {
                  const day = parseInt(p[0], 10);
                  const month = parseInt(p[1], 10) - 1;
                  let year = parseInt(p[2], 10);
                  if (year < 100) year += 2000;
                  dateToCheck = new Date(year, month, day).getTime();
              }
          } else if (data.dataAtendimentoIso) {
              const p = data.dataAtendimentoIso.split('-'); // e.g. 2026-01-01
              if (p.length === 3) {
                  let year = parseInt(p[0], 10);
                  if (year < 100) year += 2000;
                  const month = parseInt(p[1], 10) - 1;
                  const day = parseInt(p[2], 10);
                  dateToCheck = new Date(year, month, day).getTime();
              }
          }

          if (dateToCheck === null) {
              return false; // Safely skip invalid dates instead of deleting everything!
          }
          
          let inRange = true;
          if (deleteStartDate) {
              // deleteStartDate is YYYY-MM-DD
              const ds = deleteStartDate.split('-');
              const startTimestamp = new Date(parseInt(ds[0], 10), parseInt(ds[1], 10) - 1, parseInt(ds[2], 10)).getTime();
              if (dateToCheck < startTimestamp) inRange = false;
          }
          if (deleteEndDate) {
              const de = deleteEndDate.split('-');
              const endTimestamp = new Date(parseInt(de[0], 10), parseInt(de[1], 10) - 1, parseInt(de[2], 10)).getTime();
              if (dateToCheck > endTimestamp) inRange = false;
          }
          
          return inRange;
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
       
       getCountFromServer(collection(db, 'sales')).then(snap => setRecordCount(snap.data().count)).catch(() => {});
       mutate((key) => Array.isArray(key) && key[0] === 'sales-query', undefined, { revalidate: true });
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

  const readExcelDict = (file: File) => new Promise<any[]>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
         try {
             const wb = xlsx.read(e.target?.result, { type: 'binary' });
             const ws = wb.Sheets[wb.SheetNames[0]];
             const data = xlsx.utils.sheet_to_json(ws);
             resolve(data);
         } catch (err) {
             reject(err);
         }
      };
      reader.onerror = reject;
      reader.readAsBinaryString(file);
  });

  const [fileRestore, setFileRestore] = useState<File | null>(null);

  const handleRestoreBackup = async () => {
    if (!fileRestore) return;
    setLoadingUpload(true);
    setUploadStatusText('Lendo arquivo de Restauração...');
    setSuccessMsg('');
    try {
        const data = await readExcelDict(fileRestore);
        if (data.length === 0) {
            throw new Error('A planilha de backup está vazia.');
        }

        setUploadStatusText(`Restaurando ${data.length} registros...`);
        let restoredCount = 0;
        let batchCount = 0;
        let currentBatch = writeBatch(db);

        for (const row of data) {
            const rowId = row.id;
            if (!rowId) continue; // Precisa do ID exato para restaurar

            // Remove o ID do corpo do dado para ficar igual era salvo
            const docData = { ...row };
            delete docData.id;

            currentBatch.set(doc(db, 'sales', rowId), docData); // Sobrescreve (ou recria) o documento com os dados do backup
            restoredCount++;
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

        getCountFromServer(collection(db, 'sales')).then(snap => setRecordCount(snap.data().count)).catch(() => {});
        setSuccessMsg(`Sucesso: ${restoredCount} registros foram restaurados a partir do backup.`);
        setFileRestore(null);
    } catch(err: any) {
        alert("Erro ao restaurar backup: " + err.message);
    } finally {
        setUploadStatusText('');
        setLoadingUpload(false);
    }
  };

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

      // Validação das Planilhas
      const isContratosValid = dataContratos.some((row, idx) => idx < 10 && String(row['Y'] || '').toUpperCase().includes('STATUS'));
      const isAtendimentosValid = dataAtend.some((row, idx) => idx < 10 && String(row['BA'] || '').toUpperCase().includes('LOCALIZA'));

      if (!isContratosValid || !isAtendimentosValid) {
          throw new Error('As planilhas carregadas não são as matrizes aceitas pelo sistema. Verifique se você subiu "CONTRATOS" no Passo 1 (com a coluna Y de Status) e "ATENDIMENTOS" no Passo 2 (com a coluna BA de Localizador).');
      }

      setUploadStatusText('Consolidando e salvando na nuvem (isso pode demorar varios segundos)...');
      await new Promise(r => setTimeout(r, 50));

      // Phase 1: Map Atendimentos purely for Demographic enrichment
      const atendMapByLoc: Record<string, any> = {};
      const atendMapByCpf: Record<string, any> = {};
      const atendMapByName: Record<string, any> = {};
      
      for (const row of dataAtend) {
          const locVenda = String(row['BA'] || '').trim();
          if (locVenda && !locVenda.toUpperCase().includes('LOCALIZADOR')) {
             // Separa os localizadores por vírgula, barra ou ponto-e-vírgula para cadastrar cada cota individualmente
             const locs = locVenda.split(/[,/;\s]+/).map(l => l.trim().replace(/\D/g, '')).filter(l => l.length > 1);
             for (const l of locs) {
                 atendMapByLoc[l] = row;
             }
          }
          
          const cpfRaw = String(row['G'] || '').trim();
          if (cpfRaw) {
             const cpfs = cpfRaw.split(/[^0-9]+/).filter(c => c.length >= 5);
             for (const c of cpfs) {
                atendMapByCpf[c] = row;
             }
          }

          const nameRaw = String(row['F'] || '').trim().toUpperCase();
          if (nameRaw) {
             // Desmembra os clientes divididos por "/" (barra) para garantir o link do cônjuge
             const names = nameRaw.split('/').map(n => n.trim()).filter(n => n.length > 5);
             for (const n of names) {
                 atendMapByName[n] = row;
             }
          }
      }

      // Phase 2: Iterate Contratos and merge with Atendimentos mapping
      let processed = 0;
      let skippedConfig = 0;
      let currentBatch = writeBatch(db);
      let batchCount = 0;

      for (const cRow of dataContratos) {
          const headCheck = String(cRow['A'] || '').toUpperCase();
          if (headCheck.includes('LOCALIZADOR') || headCheck.includes('STATUS')) continue;

          // Permissive check to catch "Ativo ", "ATIVOS", "Cancelada", etc
          const status = String(cRow['Y'] || '').toUpperCase();
          if (!status.includes('ATIV') && !status.includes('CANCEL')) {
              skippedConfig++;
              continue;
          }

          const localizadorOriginal = String(cRow['A'] || '').trim();
          const localizador = localizadorOriginal.replace(/\D/g, '');
          const codigo = String(cRow['E'] || '').trim();
          
          let baseDocId = codigo || (localizador ? `${localizador}-S/Cod` : `cota-SemCod`);
          baseDocId = baseDocId.replace(/\//g, '-').replace(/\\/g, '-').trim();

          // Como exigido pelas regras de ouro e pelo usuário: 
          // "TODO documento criado recebe incondicionalmente um sufixo randômico gerado após seu código principal, abolindo 100% o risco de apagamento por sombreamento"
          const randomSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
          const docId = `${baseDocId}-${randomSuffix}`;

          const cpf1 = String(cRow['H'] || '').replace(/\D/g, '');
          const cpf2 = String(cRow['K'] || '').replace(/\D/g, '');

          const cessionarioNomeContratos = String(cRow['G'] || '').trim().toUpperCase();

          // Conexão (Mudança Estrutural Autorizada): Localizador como principal (precisão da transação), fallback no CPF
          let aRow = null;
          if (localizador && atendMapByLoc[localizador]) {
             aRow = atendMapByLoc[localizador];
          } else if (cpf1 && atendMapByCpf[cpf1]) {
             aRow = atendMapByCpf[cpf1];
          } else if (cpf2 && atendMapByCpf[cpf2]) {
             aRow = atendMapByCpf[cpf2];
          } else if (cessionarioNomeContratos && atendMapByName[cessionarioNomeContratos]) {
             aRow = atendMapByName[cessionarioNomeContratos];
          }

          // If aRow is still undefined, we create an empty fallback so the Venda is not lost.
          aRow = aRow || {};

          // Data da venda (Fielmente pela Coluna F "DATA" da aba Contratos)
          const dataAtendimento = formatExcelDate(cRow['F']);
          
          let dataAtendimentoIso = "";
          if (dataAtendimento && dataAtendimento.includes('/')) {
              const p = dataAtendimento.split('/');
              if(p.length === 3) {
                  let yearStr = p[2];
                  if (yearStr.length === 2) yearStr = '20' + yearStr;
                  dataAtendimentoIso = `${yearStr}-${String(p[1]).padStart(2, '0')}-${String(p[0]).padStart(2, '0')}`;
                  
                  // Trava de 3 dias para perfis não admin
                  if (userRole !== 'admin') {
                      const rowDate = new Date(Number(p[2]), Number(p[1]) - 1, Number(p[0]), 0, 0, 0);
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      
                      const diffTime = today.getTime() - rowDate.getTime();
                      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                      
                      if (diffDays > 3) {
                          throw new Error(`Acesso Restrito: Seu perfil de usuário não tem permissão para importar contratos com mais de 3 dias de retroatividade. (Data encontrada: ${dataAtendimento}). Contate um administrador.`);
                      }
                  }
              }
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

          const saleDoc: Sale = {
            localizador: localizadorOriginal,
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
            idade1: aRow['O'] != null ? String(aRow['O']) : '',
            idade2: aRow['P'] != null ? String(aRow['P']) : '',
            profissao1: aRow['Q'] != null ? String(aRow['Q']) : '',
            profissao2: aRow['R'] != null ? String(aRow['R']) : '',
            estadoCivil: aRow['W'] != null ? String(aRow['W']) : '',
            renda: aRow['AB'] != null ? String(aRow['AB']) : '',
            cidade: aRow['AC'] != null ? String(aRow['AC']) : '',
            estado: aRow['AD'] != null ? String(aRow['AD']) : '',
            possuiVeiculo: aRow['AE'] != null ? String(aRow['AE']) : '',
            anoVeiculo: aRow['AF'] != null ? String(aRow['AF']) : '',
            possuiCasaPropria: aRow['AG'] != null ? String(aRow['AG']) : '',
            
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
      getCountFromServer(collection(db, 'sales')).then(snap => setRecordCount(snap.data().count)).catch(() => {});
      mutate((key) => Array.isArray(key) && key[0] === 'sales-query', undefined, { revalidate: true });
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

      {canUpload && (
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
      )}

      {(canExport || canRestore) && (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Backup Card */}
        {canExport && (
        <div className="bg-white p-6 border border-slate-200 rounded-lg shadow-sm flex flex-col">
          <div className="flex items-center gap-3 mb-4 text-sky-700">
            <div className="bg-sky-100 p-3 rounded-full">
              <DownloadCloud size={24} />
            </div>
            <div>
              <h2 className="font-bold text-lg leading-tight">Exportar Backup</h2>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Rotina de Segurança</span>
            </div>
          </div>
          
          <p className="text-sm text-slate-600 mb-6 flex-1">
            Gera uma planilha contendo a união de todos os dados do sistema. Pode ser baixada de forma <b>absoluta</b> ou selecionando um período específico. Esta planilha garante que você possa restaurar o sistema em caso de crash.
          </p>

          <div className="flex items-end gap-3 p-4 bg-slate-50 border border-slate-200 rounded-md mb-6">
             <div className="flex flex-col flex-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 tracking-wider">A PARTIR DE (OPCIONAL)</label>
                <input 
                  type="date" 
                  value={backupStartDate} 
                  onChange={(e) => setBackupStartDate(e.target.value)}
                  className="w-full text-xs font-semibold border-slate-300 rounded shadow-sm p-1.5 focus:ring-sky-500 focus:border-sky-500 text-slate-700"
                />
             </div>
             <div className="flex flex-col flex-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 tracking-wider">ATÉ (OPCIONAL)</label>
                <input 
                  type="date" 
                  value={backupEndDate} 
                  onChange={(e) => setBackupEndDate(e.target.value)}
                  className="w-full text-xs font-semibold border-slate-300 rounded shadow-sm p-1.5 focus:ring-sky-500 focus:border-sky-500 text-slate-700"
                />
             </div>
          </div>
          
          <div className="flex items-center justify-between mt-auto">
            <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
              <DbIcon size={14}/> {recordCount !== null ? `${recordCount} registros na nuvem` : 'Lendo dados...'}
            </span>
            <button 
              onClick={handleBackup}
              disabled={loadingBackup || loadingUpload || recordCount === 0}
              className="bg-sky-600 text-white font-bold py-2.5 px-6 rounded-md shadow-sm transition-colors hover:bg-sky-700 disabled:opacity-50 flex items-center gap-2"
            >
              {loadingBackup ? 'Compilando...' : (backupStartDate || backupEndDate ? 'Baixar Período (.XLSX)' : 'Baixar Tudo (.XLSX)')}
            </button>
          </div>
        </div>
        )}

        {/* Restore Card */}
        {canRestore && (
        <div className="bg-amber-50 p-6 border border-amber-200 rounded-lg shadow-sm flex flex-col">
          <div className="flex items-center gap-3 mb-4 text-amber-700">
            <div className="bg-amber-100 p-3 rounded-full">
              <Upload size={24} />
            </div>
            <div>
              <h2 className="font-bold text-lg leading-tight">Restaurar do Backup</h2>
              <span className="text-xs font-semibold text-amber-600/80 uppercase tracking-widest">Recuperação de Dados</span>
            </div>
          </div>
          
          <p className="text-sm text-amber-800/80 mb-6 flex-1">
            Se houve um crash ou erro, selecione um arquivo de backup <b>InsightSales_xxxx.xlsx</b> previamente baixado para <b>recompor</b> os dados. A restauração irá sobrescrever ou recriar os registros correspondentes.
          </p>
          
          <div className={`p-4 border border-dashed rounded-lg flex flex-col gap-2 transition-colors mb-6 ${fileRestore ? 'border-amber-400 bg-amber-100/50' : 'border-amber-300 bg-white'}`}>
              <span className="font-semibold text-sm text-amber-900">Selecione o Arquivo de Backup (.xlsx)</span>
              <input 
                 type="file" accept=".xlsx, .xls"
                 onChange={(e) => setFileRestore(e.target.files?.[0] || null)}
                 className="text-xs cursor-pointer file:mr-4 file:rounded-md file:border-0 file:bg-amber-200 file:text-amber-800 file:px-4 file:py-2 file:text-xs file:font-bold hover:file:bg-amber-300"
              />
          </div>

          <div className="flex items-center justify-end mt-auto">
            <button 
              onClick={handleRestoreBackup}
              disabled={loadingBackup || loadingUpload || !fileRestore}
              className="bg-amber-600 outline-none text-white font-bold py-2.5 px-6 rounded-md shadow-sm transition-colors hover:bg-amber-700 disabled:opacity-50 flex items-center gap-2"
            >
              <Upload size={16}/> Compor Banco de Dados
            </button>
          </div>
        </div>
        )}
      </div>
      )}

      {/* Backup Manuais */}
      {(canExport || canRestore) && (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5">
        {canExport && (
        <div className="bg-white p-6 border border-slate-200 rounded-lg shadow-sm flex flex-col">
          <div className="flex items-center gap-3 mb-4 text-indigo-700">
            <div className="bg-indigo-100 p-3 rounded-full">
              <DownloadCloud size={24} />
            </div>
            <div>
              <h2 className="font-bold text-lg leading-tight">Backup Parcial: Somente Trabalhos Manuais</h2>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Aba Atendimentos</span>
            </div>
          </div>
          
          <p className="text-sm text-slate-600 mb-6 flex-1">
            Gera uma planilha inteligente contendo <b>apenas as cotas</b> cujos dados de preenchimento manual (Forma de pgto, Parcelas, Valores de retenção) foram modificados no sistema. Útil para extrair o esforço manual da equipe antes de limpar o banco e realizar uma reimportação absoluta.
          </p>

          <div className="flex flex-col md:flex-row gap-4 mb-6 p-4 bg-slate-50 rounded-lg border border-slate-100">
            <div className="flex-1">
              <label className="block text-xs font-bold text-slate-600 mb-1">Data Início (opcional)</label>
              <input type="date" value={manualBackupStartDate} onChange={(e) => setManualBackupStartDate(e.target.value)} className="w-full text-sm border-slate-300 rounded-md focus:ring-indigo-500 py-1.5 px-3" />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-bold text-slate-600 mb-1">Data Fim (opcional)</label>
              <input type="date" value={manualBackupEndDate} onChange={(e) => setManualBackupEndDate(e.target.value)} className="w-full text-sm border-slate-300 rounded-md focus:ring-indigo-500 py-1.5 px-3" />
            </div>
          </div>
          
          <div className="flex items-center justify-between mt-auto">
            <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
              <DbIcon size={14}/> {recordCount !== null ? `Pronto para rastrear em ${recordCount} cotas` : 'Lendo dados...'}
            </span>
            <button 
              onClick={handleManualDataExport}
              disabled={loadingManualBackup || loadingUpload || recordCount === 0}
              className="bg-indigo-600 text-white font-bold py-2.5 px-6 rounded-md shadow-sm transition-colors hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
            >
              {loadingManualBackup ? 'Gerando...' : 'Exportar Trabalhos Manuais (.XLSX)'}
            </button>
          </div>
        </div>
        )}

        {canRestore && (
        <div className="bg-indigo-50 p-6 border border-indigo-200 rounded-lg shadow-sm flex flex-col">
          <div className="flex items-center gap-3 mb-4 text-indigo-700">
            <div className="bg-indigo-100 p-3 rounded-full">
              <Upload size={24} />
            </div>
            <div>
              <h2 className="font-bold text-lg leading-tight">Injeção Inteligente de Trabalhos Manuais</h2>
              <span className="text-xs font-semibold text-indigo-600/80 uppercase tracking-widest">Merge Automático</span>
            </div>
          </div>
          
          <p className="text-sm text-indigo-800/80 mb-6 flex-1">
            Reinjeta os dados manuais na nuvem após uma nova carga ou faxina no sistema. O motor usa inferência (Localizador, CPF, Nome) para colar seus dados manuais nas novas linhas importadas que tiverem IDs diferentes.
          </p>
          
          <div className={`p-4 border border-dashed rounded-lg flex flex-col gap-2 transition-colors mb-6 ${fileManualRestore ? 'border-indigo-400 bg-indigo-100/50' : 'border-indigo-300 bg-white'}`}>
              <span className="font-semibold text-sm text-indigo-900">Arquivo de Trabalhos Manuais (.xlsx)</span>
              <input 
                 type="file" accept=".xlsx, .xls"
                 onChange={(e) => setFileManualRestore(e.target.files?.[0] || null)}
                 className="text-xs cursor-pointer file:mr-4 file:rounded-md file:border-0 file:bg-indigo-200 file:text-indigo-800 file:px-4 file:py-2 file:text-xs file:font-bold hover:file:bg-indigo-300"
              />
          </div>

          <div className="flex flex-col md:flex-row gap-4 mb-6 p-4 bg-indigo-100/50 rounded-lg border border-indigo-200">
            <div className="flex-1">
              <label className="block text-xs font-bold text-indigo-900 mb-1">Injetar a partir de (opcional)</label>
              <input type="date" value={manualRestoreStartDate} onChange={(e) => setManualRestoreStartDate(e.target.value)} className="w-full text-sm border-indigo-300 rounded-md focus:ring-indigo-500 py-1.5 px-3 bg-white" />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-bold text-indigo-900 mb-1">Injetar até (opcional)</label>
              <input type="date" value={manualRestoreEndDate} onChange={(e) => setManualRestoreEndDate(e.target.value)} className="w-full text-sm border-indigo-300 rounded-md focus:ring-indigo-500 py-1.5 px-3 bg-white" />
            </div>
          </div>

          <div className="flex items-center justify-end mt-auto">
            <button 
              onClick={handleManualDataRestore}
              disabled={loadingManualBackup || loadingUpload || !fileManualRestore}
              className="bg-indigo-600 outline-none text-white font-bold py-2.5 px-6 rounded-md shadow-sm transition-colors hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
            >
              <Upload size={16}/> Injetar Dados Manuais Seguros
            </button>
          </div>
        </div>
        )}
      </div>
      )}

      {/* Info Card */}
      {canUpload && (
        <div className="bg-emerald-50 p-6 border border-emerald-100 rounded-lg mt-5 shadow-sm flex flex-col">
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
      )}

      {/* Danger Zone */}
      {canDelete && (
      <div className="border border-red-200 bg-white rounded-lg p-6 shadow-sm mt-2 flex flex-col gap-4">
         <div>
          <h2 className="text-red-700 font-bold mb-1 flex items-center gap-2"><Trash2 size={18}/> Zona de Perigo (Exclusão)</h2>
           <p className="text-sm text-slate-500 max-w-3xl">Apaga permanentemente os dados. Se você não selecionar datas, <b>TODO O BANCO DE DADOS SERÁ DESTRUÍDO</b>.</p>
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
      )}

      {successMsg && (
        <div className="fixed bottom-5 right-5 z-50 bg-emerald-100 text-emerald-800 p-4 rounded-md shadow-lg flex items-center gap-2 font-semibold text-sm transition-opacity">
          <CheckCircle size={18} className="text-emerald-600" />
          {successMsg}
        </div>
      )}
    </div>
  );
}
