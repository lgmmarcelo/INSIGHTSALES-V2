import { useState, useEffect } from 'react';
import { createSecondaryUser, db } from '../lib/firebase';
import { collection, addDoc, getDocs, doc, deleteDoc } from 'firebase/firestore';
import { UserPlus, CheckCircle, Shield, Key, Trash2 } from 'lucide-react';
import { AccessProfile } from '../types';
import { useAuth } from '../context/AuthContext';

const PERMISSIONS = [
  { id: 'view_atendimentos', label: 'Visualizar Atendimentos' },
  { id: 'edit_atendimentos', label: 'Registrar Atendimentos (Cancelamentos / Retenção)' },
  { id: 'override_atendimentos', label: 'Editar Atendimentos Efetivados (Gerência/Supervisão)' },
  { id: 'clear_atendimentos', label: 'Limpar Dados de Atendimentos Lançados' },
  { id: 'view_retencao', label: 'Visualizar Relatório de Retenção' },
  { id: 'db_upload', label: 'Subir planilhas de Contratos e Atendimentos' },
  { id: 'db_export', label: 'Exportar Backup' },
  { id: 'db_restore', label: 'Restaurar do Backup' },
  { id: 'db_delete', label: 'Excluir o Banco de Dados' },
  { id: 'view_usuarios', label: 'Configuração de Usuários' },
  { id: 'view_perfis', label: 'Configuração de Perfis de Acesso' },
];

export default function Admin() {
  const { userRole, userPermissions } = useAuth();
  const canViewUsers = userRole === 'admin' || userPermissions.includes('view_usuarios');
  const canViewProfiles = userRole === 'admin' || userPermissions.includes('view_perfis');

  const [activeTab, setActiveTab] = useState<'users' | 'profiles'>(
     canViewUsers ? 'users' : 'profiles'
  );

  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  
  // Custom Confirmation
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleteTargetType, setDeleteTargetType] = useState<'user'|'profile'|null>(null);

  // User Form
  const [SystemUsers, setSystemUsers] = useState<any[]>([]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('analyst');
  
  // Custom Profiles
  const [profiles, setProfiles] = useState<AccessProfile[]>([]);
  const [newProfileName, setNewProfileName] = useState('');
  const [newProfilePerms, setNewProfilePerms] = useState<string[]>([]);

  useEffect(() => {
     fetchProfiles();
     fetchUsers();
  }, []);

  const fetchProfiles = async () => {
      try {
          const snap = await getDocs(collection(db, 'access_profiles'));
          const pData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AccessProfile));
          setProfiles(pData);
      } catch (err) {
          console.error("Erro ao puxar perfis", err);
      }
  };

  const fetchUsers = async () => {
      try {
          const snap = await getDocs(collection(db, 'users'));
          const uData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setSystemUsers(uData);
      } catch (err) {
          console.error("Erro ao puxar usuarios", err);
      }
  };

  const requestDelete = (id: string, type: 'user'|'profile') => {
      setConfirmDeleteId(id);
      setDeleteTargetType(type);
  };

  const executeDelete = async () => {
      if (!confirmDeleteId || !deleteTargetType) return;
      
      try {
          if (deleteTargetType === 'user') {
              await deleteDoc(doc(db, 'users', confirmDeleteId));
              setSuccessMsg("Usuário removido com sucesso.");
              fetchUsers();
          } else if (deleteTargetType === 'profile') {
              await deleteDoc(doc(db, 'access_profiles', confirmDeleteId));
              setSuccessMsg("Perfil removido com sucesso.");
              fetchProfiles();
          }
      } catch(err: any) {
          alert("Erro ao remover: " + err.message);
      } finally {
          setConfirmDeleteId(null);
          setDeleteTargetType(null);
      }
  };

  const handleDeleteUser = async (userId: string) => {
      requestDelete(userId, 'user');
  };

  const handleDeleteProfile = async (profileId: string) => {
      requestDelete(profileId, 'profile');
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccessMsg('');
    try {
        await createSecondaryUser(email, password, role);
        setSuccessMsg(`Usuário ${email} criado com sucesso!`);
        setEmail('');
        setPassword('');
        fetchUsers();
    } catch (error: any) {
        alert("Erro ao criar usuário: " + error.message);
    } finally {
        setLoading(false);
    }
  };

  const handleCreateProfile = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newProfileName.trim() || newProfilePerms.length === 0) {
          alert('Preencha o nome do perfil e selecione pelo menos uma permissão.');
          return;
      }
      
      setLoading(true);
      setSuccessMsg('');
      try {
          const newProf = {
              name: newProfileName,
              permissions: newProfilePerms
          };
          await addDoc(collection(db, 'access_profiles'), newProf);
          setSuccessMsg(`Perfil "${newProfileName}" criado com sucesso!`);
          setNewProfileName('');
          setNewProfilePerms([]);
          fetchProfiles();
      } catch(err: any) {
          alert("Erro ao criar perfil: " + err.message);
      } finally {
          setLoading(false);
      }
  };

  const togglePermission = (permId: string) => {
      setNewProfilePerms(prev => 
          prev.includes(permId) ? prev.filter(p => p !== permId) : [...prev, permId]
      );
  };

  return (
    <div className="flex-1 overflow-auto p-5 gap-5 flex flex-col h-full font-sans">
      
      <div className="flex border-b border-slate-200">
        {canViewUsers && (
          <button 
             onClick={() => setActiveTab('users')}
             className={`py-3 px-6 font-semibold text-sm flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'users' ? 'border-sky-600 text-sky-700' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}
          >
            <UserPlus size={16} /> Cadastro de Usuários
          </button>
        )}
        {canViewProfiles && (
          <button 
             onClick={() => setActiveTab('profiles')}
             className={`py-3 px-6 font-semibold text-sm flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'profiles' ? 'border-sky-600 text-sky-700' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}
          >
            <Shield size={16} /> Perfis de Acesso
          </button>
        )}
      </div>

      {activeTab === 'users' && canViewUsers && (
      <div className="bg-white p-6 border border-slate-200 rounded-lg shadow-sm flex-1">
        <h2 className="font-bold text-lg mb-4 flex items-center gap-2 text-slate-800">
           <UserPlus size={18} className="text-sky-600" />
           Criar Novo Usuário
        </h2>
        
        <form onSubmit={handleCreateUser} className="flex flex-col gap-4 max-w-sm">
           <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-600">E-mail do Usuário</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} required className="input-field" placeholder="exemplo@empresa.com" />
           </div>
           
           <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-600">Senha Provisória</label>
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)} required minLength={6} className="input-field" placeholder="Mínimo 6 caracteres" />
           </div>
           
           <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-600">Nível de Acesso (Perfil)</label>
            <select value={role} onChange={e=>setRole(e.target.value)} required className="input-field cursor-pointer">
                <option value="admin">Administrador (Total)</option>
                <option value="analyst">Analista de Pós-vendas</option>
                <option value="viewer">Usuário Padrão (Visualizador)</option>
                <optgroup label="Perfis Customizados">
                   {profiles.map(p => (
                       <option key={p.id} value={p.id}>{p.name}</option>
                   ))}
                </optgroup>
            </select>
           </div>
           
           <button disabled={loading} type="submit" className="bg-sky-600 text-white font-semibold flex items-center justify-center py-2.5 rounded hover:bg-sky-700 transition-colors mt-2 text-sm shadow-sm">
               Registrar Usuário
           </button>
        </form>

         <div className="mt-8 pt-8 border-t border-slate-200">
             <h3 className="font-bold text-sm uppercase tracking-wider text-slate-500 mb-3">Usuários Existentes</h3>
             {SystemUsers.length === 0 ? (
                 <p className="text-sm text-slate-400 italic">Nenhum usuário cadastrado.</p>
             ) : (
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                     {SystemUsers.map(u => {
                         const profileName = profiles.find(p => p.id === u.role)?.name || (u.role === 'admin' ? 'Administrador' : u.role === 'analyst' ? 'Analista' : u.role === 'viewer' ? 'Visualizador' : u.role);
                         return (
                         <div key={u.id} className="border border-slate-200 rounded-md p-4 bg-white shadow-sm flex flex-col gap-2 relative group hover:border-red-200 transition-colors">
                             <button
                                onClick={() => handleDeleteUser(u.id)}
                                className="absolute top-3 right-3 text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Excluir Usuário"
                             >
                                <Trash2 size={16} />
                             </button>
                             <div className="font-bold text-slate-800 text-sm pr-6 break-all">{u.email}</div>
                             <div className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                                 <Shield size={12} className="text-sky-600"/> {profileName}
                             </div>
                         </div>
                     )})}
                 </div>
             )}
         </div>
      </div>
      )}

      {activeTab === 'profiles' && canViewProfiles && (
      <div className="bg-white p-6 border border-slate-200 rounded-lg shadow-sm flex-1 flex flex-col gap-8">
        
        {/* CREATE PROFILE FORM */}
        <div>
            <h2 className="font-bold text-lg mb-4 flex items-center gap-2 text-slate-800">
               <Key size={18} className="text-sky-600" />
               Criar Perfil de Acesso
            </h2>
            
            <form onSubmit={handleCreateProfile} className="flex flex-col gap-6 max-w-2xl bg-slate-50 p-5 rounded-md border border-slate-200">
               <div className="flex flex-col gap-1">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Nome do Perfil</label>
                <input type="text" value={newProfileName} onChange={e=>setNewProfileName(e.target.value)} required className="input-field max-w-sm" placeholder="Ex: Financeiro Sênior" />
               </div>
               
               <div className="flex flex-col gap-3">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Permissões (Módulos Liberados)</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                   {PERMISSIONS.map(p => (
                       <label key={p.id} className="flex items-start gap-2 cursor-pointer group">
                           <input 
                              type="checkbox" 
                              checked={newProfilePerms.includes(p.id)}
                              onChange={() => togglePermission(p.id)}
                              className="mt-0.5 w-4 h-4 text-sky-600 rounded border-slate-300 focus:ring-sky-500"
                           />
                           <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900 transition-colors">{p.label}</span>
                       </label>
                   ))}
                </div>
               </div>
               
               <div className="pt-2">
                   <button disabled={loading} type="submit" className="bg-slate-900 text-white font-semibold flex items-center justify-center py-2 px-6 rounded hover:bg-slate-800 transition-colors text-sm shadow-sm">
                       Salvar Perfil
                   </button>
               </div>
            </form>
        </div>

        {/* LIST EXISTING PROFILES */}
        <div>
             <h3 className="font-bold text-sm uppercase tracking-wider text-slate-500 mb-3">Perfis Existentes</h3>
             {profiles.length === 0 ? (
                 <p className="text-sm text-slate-400 italic">Nenhum perfil customizado recém-criado.</p>
             ) : (
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                     {profiles.map(p => (
                         <div key={p.id} className="border border-slate-200 rounded-md p-4 bg-white shadow-sm flex flex-col gap-2 relative group hover:border-red-200 transition-colors">
                             <button
                                onClick={() => handleDeleteProfile(p.id!)}
                                className="absolute top-3 right-3 text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Excluir Perfil"
                             >
                                <Trash2 size={16} />
                             </button>
                             <div className="font-bold text-slate-800 flex items-center gap-2 pr-6 break-all">
                                 <Shield size={14} className="text-emerald-600"/> {p.name}
                             </div>
                             <div className="flex flex-wrap gap-1 mt-1">
                                 {p.permissions.map(perm => (
                                     <span key={perm} className="bg-slate-100 text-slate-600 text-[10px] font-semibold px-2 py-0.5 rounded">
                                         {PERMISSIONS.find(o => o.id === perm)?.label || perm}
                                     </span>
                                 ))}
                             </div>
                         </div>
                     ))}
                 </div>
             )}
        </div>

      </div>
      )}

      {confirmDeleteId && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-lg p-6 max-w-sm w-full shadow-xl">
                  <h3 className="font-bold text-lg text-slate-800 mb-2">Confirmação de Exclusão</h3>
                  <p className="text-slate-600 text-sm mb-6">
                      Deseja realmente remover excluir permanentemente este {deleteTargetType === 'user' ? 'usuário' : 'perfil'} do sistema?
                  </p>
                  <div className="flex gap-3 justify-end">
                      <button onClick={() => {setConfirmDeleteId(null); setDeleteTargetType(null)}} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-md transition-colors">
                          Cancelar
                      </button>
                      <button onClick={executeDelete} className="px-4 py-2 text-sm font-semibold bg-red-600 text-white hover:bg-red-700 rounded-md transition-colors shadow-sm">
                          Excluir
                      </button>
                  </div>
              </div>
          </div>
      )}

      {successMsg && (
        <div className="fixed bottom-5 right-5 bg-emerald-100 border border-emerald-200 text-emerald-800 p-4 rounded-md shadow-lg flex items-center gap-2 font-semibold text-sm z-50">
          <CheckCircle size={18} className="text-emerald-600" />
          {successMsg}
        </div>
      )}
    </div>
  );
}
