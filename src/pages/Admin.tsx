import { useState } from 'react';
import { createSecondaryUser } from '../lib/firebase';
import { UserPlus, CheckCircle } from 'lucide-react';

export default function Admin() {
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  
  // User Form
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('analyst');

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccessMsg('');
    try {
        await createSecondaryUser(email, password, role);
        setSuccessMsg(`Usuário ${email} criado com sucesso!`);
        setEmail('');
        setPassword('');
    } catch (error: any) {
        alert("Erro ao criar usuário: " + error.message);
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="flex-1 overflow-auto p-5 gap-5 flex flex-col h-full font-sans">
      <div className="bg-white p-6 border border-slate-200 rounded-lg shadow-sm flex-1">
        <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
           <UserPlus size={18} />
           Criar Usuário
        </h2>
        
        <form onSubmit={handleCreateUser} className="flex flex-col gap-4 max-w-sm">
           <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-600">E-mail</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} required className="input-field" />
           </div>
           
           <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-600">Senha</label>
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)} required minLength={6} className="input-field" />
           </div>
           
           <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-600">Nível de Acesso (Perfil)</label>
            <select value={role} onChange={e=>setRole(e.target.value)} required className="input-field cursor-pointer">
                <option value="analyst">Analista de Pós-vendas</option>
                <option value="viewer">Usuário Padrão (Visualizador)</option>
                <option value="admin">Administrador</option>
            </select>
           </div>
           
           <button disabled={loading} type="submit" className="bg-slate-900 text-white font-semibold flex items-center justify-center py-2.5 rounded hover:bg-slate-800 transition-colors mt-2 text-sm">
               Criar Acesso
           </button>
        </form>
      </div>

      {successMsg && (
        <div className="fixed bottom-5 right-5 bg-emerald-100 text-emerald-800 p-4 rounded-md shadow-lg flex items-center gap-2 font-semibold text-sm">
          <CheckCircle size={18} className="text-emerald-600" />
          {successMsg}
        </div>
      )}
    </div>
  );
}
