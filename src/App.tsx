/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Settings, LogOut, ClipboardList, Database, Users, Store } from "lucide-react";
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
import { cn } from './lib/utils';
import { MapPin, Wallet } from 'lucide-react';

function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode, allowedRoles?: string[] }) {
  const { currentUser, userRole, loading } = useAuth();
  
  if (loading) return <div className="flex h-screen items-center justify-center">Carregando...</div>;
  if (!currentUser) return <Navigate to="/login" replace />;
  if (allowedRoles && userRole && !allowedRoles.includes(userRole)) {
    return <div className="flex h-screen items-center justify-center">Acesso negado para o seu perfil ({userRole}).</div>;
  }
  
  return <>{children}</>;
}

function MainLayout({ children }: { children: React.ReactNode }) {
  const { currentUser, userRole, logout } = useAuth();
  const location = useLocation();

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Equipe', path: '/equipe', icon: Users },
    { name: 'Sala', path: '/salas', icon: Store },
    { name: 'Captação', path: '/pontos', icon: MapPin },
    { name: 'Renda', path: '/renda', icon: Wallet },
    { name: 'Atendimentos', path: '/atendimentos', icon: ClipboardList },
  ];

  if (userRole === 'admin') {
    navItems.push({ name: 'Configurações', path: '/admin', icon: Settings });
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
          <ProtectedRoute allowedRoles={['admin']}>
            <MainLayout><Admin /></MainLayout>
          </ProtectedRoute>
        } />

        <Route path="/database" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <MainLayout><DatabaseManagement /></MainLayout>
          </ProtectedRoute>
        } />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
