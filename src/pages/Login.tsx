import { useState, useEffect } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { LogIn } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  // Redirect automatically if logged in
  useEffect(() => {
    if (currentUser) {
      navigate('/');
    }
  }, [currentUser, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // Navigation is handled by the useEffect above
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError('E-mail ou senha incorretos. Verifique a digitação.');
      } else if (err.code === 'auth/operation-not-allowed') {
        setError('O login por E-mail/Senha não foi ativado no painel do Firebase. Volte lá e ative a chavinha, não esqueça de clicar em Save!');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Muitas tentativas falhas. Aguarde um minuto e tente novamente.');
      } else {
        setError(err.message || 'Falha ao conectar no banco de dados.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-full items-center justify-center bg-slate-50 font-sans">
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-8 text-center text-2xl font-extrabold">
          INSIGHT<span className="text-sky-500">SALES</span>
        </div>
        
        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          {error && <div className="rounded bg-red-100 p-3 text-xs font-semibold text-red-700 text-center">{error}</div>}
          
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-600">E-mail</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-md border border-slate-300 p-2 text-sm focus:border-sky-500 focus:outline-none"
              required 
            />
          </div>
          
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-600">Senha</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-md border border-slate-300 p-2 text-sm focus:border-sky-500 focus:outline-none"
              required 
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="mt-4 flex items-center justify-center gap-2 rounded-md bg-sky-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-sky-700 disabled:opacity-50"
          >
            {loading ? 'Entrando...' : <><LogIn size={16} /> Entrar</>}
          </button>
        </form>
      </div>
    </div>
  );
}
