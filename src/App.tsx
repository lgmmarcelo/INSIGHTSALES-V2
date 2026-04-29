/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Settings, LogOut, ClipboardList, Database, Users, Store, MapPin, Wallet, ShieldCheck } from "lucide-react";
import { useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Atendimentos from './pages/Atendimentos';
import Equipe from './pages/Equipe';
import Salas from './pages/Salas';
import PontosCaptacao from './pages/PontosCaptacao';
import Renda from './pages/Renda';
import Admin from './pages/Admin';
import DatabaseManagement from './pages/Database';
import RelatorioRetencao from './pages/RelatorioRetencao';
import { cn } from './lib/utils';

function BackupAlert() {
  const { userRole } = useAuth();
  const [showAlert, setShowAlert] = useState(false);

  useEffect(() => {
    // Only warn admins and analysts about backups
    if (userRole === 'admin' || userRole === 'analyst') {
       const todayStr = new Date().toLocaleDateString('pt-BR');
       const lastAlert = localStorage.getItem('lastBackupAlertDate');
       if (lastAlert !== todayStr) {
           setShowAlert(true);
       }
    }
  }, [userRole]);

  if (!showAlert) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex mt-0 items-center justify-center p-4">
      <div className="bg-white rounded-lg p-6 max-w-sm w-full shadow-2xl">
        <h3 className="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2">
           <Database size={20} className="text-sky-600" />
           Lembrete de Segurança
        </h3>
        <p className="text-sm text-slate-600 mb-6">Esta é a sua primeira sessão do dia. É altamente recomendável realizar o download do banco de dados (Backup Físico) para garantir a integridade da plataforma.</p>
        <div className="flex justify-end gap-3 w-full">
          <button onClick={() => {
             localStorage.setItem('lastBackupAlertDate', new Date().toLocaleDateString('pt-BR'));
             setShowAlert(false);
          }} className="text-sm px-4 py-2 font-semibold text-slate-500 hover:bg-slate-100 rounded transition-colors">Mais Tarde</button>
          
          <Link to="/database" onClick={() => {
             localStorage.setItem('lastBackupAlertDate', new Date().toLocaleDateString('pt-BR'));
             setShowAlert(false);
          }} className="bg-sky-600 hover:bg-sky-700 transition-colors font-semibold text-white px-4 py-2 rounded text-sm min-w-max flex items-center justify-center">Fazer Backup</Link>
        </div>
      </div>
    </div>
  );
}

function ProtectedRoute({ children, allowedRoles, requiredAnyPermission }: { children: React.ReactNode, allowedRoles?: string[], requiredAnyPermission?: string[] }) {
  const { currentUser, userRole, userPermissions, loading } = useAuth();
  
  if (loading) return <div className="flex h-screen items-center justify-center">Carregando...</div>;
  if (!currentUser) return <Navigate to="/login" replace />;
  if (userRole === 'admin') return <>{children}</>;

  if (allowedRoles && userRole && !allowedRoles.includes(userRole) && !requiredAnyPermission) {
    return <div className="flex h-screen items-center justify-center">Acesso negado para o seu perfil ({userRole}).</div>;
  }

  if (requiredAnyPermission && requiredAnyPermission.length > 0) {
     const hasPerm = requiredAnyPermission.some(p => userPermissions.includes(p));
     if (!hasPerm) {
         return <div className="flex h-screen items-center justify-center">Acesso negado: você não tem as permissões necessárias.</div>;
     }
  }
  
  return <>{children}</>;
}

function MainLayout({ children }: { children: React.ReactNode }) {
  const { currentUser, userRole, userPermissions, logout } = useAuth();
  const location = useLocation();

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Equipe', path: '/equipe', icon: Users },
    { name: 'Sala', path: '/salas', icon: Store },
    { name: 'Captação', path: '/pontos', icon: MapPin },
    { name: 'Renda', path: '/renda', icon: Wallet },
    { name: 'Atendimentos', path: '/atendimentos', icon: ClipboardList },
  ];

  if (userRole === 'admin' || userPermissions.includes('edit_atendimentos') || userPermissions.includes('view_retencao')) {
    navItems.push({ name: 'Retenção', path: '/retencao', icon: ShieldCheck });
  }

  if (userRole === 'admin' || userPermissions.includes('view_usuarios') || userPermissions.includes('view_perfis')) {
    navItems.push({ name: 'Configurações', path: '/admin', icon: Settings });
  }

  if (userRole === 'admin' || userPermissions.some(p => ['db_upload', 'db_export', 'db_restore', 'db_delete'].includes(p))) {
    navItems.push({ name: 'Dados', path: '/database', icon: Database });
  }

  return (
    <div className="flex h-screen font-sans">
      <aside className="w-[220px] bg-slate-900 text-white flex flex-col p-5 shrink-0 z-20">
        <div className="font-extrabold text-xl mb-8">
          INSIGHT<span className="text-sky-400">SALES</span>
        </div>
        
        <nav className="flex flex-col gap-2">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link key={item.path} to={item.path} className={cn(
                "flex items-center gap-2 p-2 px-3 rounded-md text-sm transition-colors",
                isActive ? "bg-white/10 opacity-100 font-semibold" : "opacity-70 hover:opacity-100 hover:bg-white/5"
              )}>
                <Icon size={16} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto pt-5 border-t border-white/10 flex flex-col gap-3">
          <div>
            <div className="text-xs font-semibold capitalize">{userRole || 'Usuário'}</div>
            <div className="text-[11px] opacity-60 truncate">{currentUser?.email}</div>
          </div>
          <button onClick={logout} className="flex items-center gap-2 text-xs opacity-70 hover:opacity-100 hover:text-red-400 transition-colors">
            <LogOut size={14} /> Sair
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden bg-slate-50 relative z-10 w-full">
        {children}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <BackupAlert />
      <Routes>
        <Route path="/login" element={<Login />} />
        
        <Route path="/" element={
          <ProtectedRoute>
            <MainLayout><Dashboard /></MainLayout>
          </ProtectedRoute>
        } />
        
        <Route path="/equipe" element={
          <ProtectedRoute>
            <MainLayout><Equipe /></MainLayout>
          </ProtectedRoute>
        } />

        <Route path="/salas" element={
          <ProtectedRoute>
            <MainLayout><Salas /></MainLayout>
          </ProtectedRoute>
        } />

        <Route path="/pontos" element={
          <ProtectedRoute>
            <MainLayout><PontosCaptacao /></MainLayout>
          </ProtectedRoute>
        } />
        
        <Route path="/renda" element={
          <ProtectedRoute>
            <MainLayout><Renda /></MainLayout>
          </ProtectedRoute>
        } />

        <Route path="/atendimentos" element={
          <ProtectedRoute>
            <MainLayout><Atendimentos /></MainLayout>
          </ProtectedRoute>
        } />
        
        <Route path="/admin" element={
          <ProtectedRoute requiredAnyPermission={['view_usuarios', 'view_perfis']}>
            <MainLayout><Admin /></MainLayout>
          </ProtectedRoute>
        } />

        <Route path="/database" element={
          <ProtectedRoute requiredAnyPermission={['db_upload', 'db_export', 'db_restore', 'db_delete']}>
            <MainLayout><DatabaseManagement /></MainLayout>
          </ProtectedRoute>
        } />

        <Route path="/retencao" element={
          <ProtectedRoute requiredAnyPermission={['edit_atendimentos', 'view_retencao']}>
            <MainLayout><RelatorioRetencao /></MainLayout>
          </ProtectedRoute>
        } />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
