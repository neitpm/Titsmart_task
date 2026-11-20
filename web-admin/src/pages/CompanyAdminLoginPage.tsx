import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, Key, Lock, User } from 'lucide-react';
import { platformAuthClient } from '../services/platformAuthClient';
import { saveSession, useAuthStore } from '../services/authStore';

export const CompanyAdminLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const loginProduct = useAuthStore((state) => state.login);
  const [email, setEmail] = useState('admin@daiphuc.vn');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (!email.trim() || !password) { setError('Vui lòng nhập đầy đủ email và mật khẩu.'); return; }
    setLoading(true);
    const { error: authError } = await platformAuthClient.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (!authError) {
      const { data: platformUser } = await platformAuthClient.auth.getUser();
      const companyRole = platformUser.user?.user_metadata?.company_role;
      const platformUserData = platformUser.user;
      if (platformUserData) {
        const appUser = {
          id: platformUserData.id,
          username: platformUserData.user_metadata?.name || platformUserData.email || email.trim(),
          name: platformUserData.user_metadata?.name || platformUserData.email || email.trim(),
          role: companyRole === 'company_admin' ? 'admin' : 'staff',
          title: companyRole === 'company_admin' ? 'Company Admin' : 'Nhân viên',
          email: platformUserData.email || email.trim(), phone: '', projectCodes: [], permissions: [],
          companyId: platformUserData.user_metadata?.company_id || '', companyRole: companyRole || 'member', platformRole: 'user',
        } as any;
        saveSession(appUser);
        useAuthStore.setState({ user: appUser });
      }
      navigate(companyRole === 'company_admin' ? '/company-admin' : '/', { replace: true });
      return;
    }
    const productResult = await loginProduct(email.trim(), password);
    if (productResult.ok) navigate('/', { replace: true });
    else setError('Email hoặc mật khẩu không đúng.');
  };

  return <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-slate-50 px-4 py-10"><div className="w-full max-w-4xl overflow-hidden rounded-[2rem] border border-slate-100 bg-white shadow-xl"><div className="h-1 bg-gradient-to-r from-blue-400 to-primary" /><div className="flex flex-col gap-12 p-8 md:flex-row md:p-12"><div className="flex flex-1 flex-col justify-center"><div className="mb-4 flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-sm"><img src="/logo.png" alt="WorkCore" className="h-full w-full object-contain" /></div><h1 className="text-3xl font-extrabold tracking-tight text-primary">WORKCORE</h1><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Company App</p><h2 className="mt-8 text-xl font-extrabold text-slate-900">Đăng nhập hệ thống</h2><p className="mt-2 text-sm font-medium text-slate-500">Đăng nhập để sử dụng ứng dụng hoặc cấu hình công ty.</p></div><div className="flex-1"><form onSubmit={submit} className="space-y-5"><label className="block text-sm font-bold text-slate-600">Email đăng nhập<div className="relative mt-2"><User className="absolute left-4 top-3.5 text-slate-400" size={20} /><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-3.5 pl-11 pr-4 text-slate-900 focus:border-primary focus:outline-none" /></div></label><label className="block text-sm font-bold text-slate-600">Mật khẩu<div className="relative mt-2"><Key className="absolute left-4 top-3.5 text-slate-400" size={20} /><input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-3.5 pl-11 pr-12 text-slate-900 focus:border-primary focus:outline-none" /><button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-3.5 text-slate-400">{showPassword ? <EyeOff size={20} /> : <Eye size={20} />}</button></div></label>{error && <div className="flex items-start gap-3 rounded-xl border border-red-100 bg-red-50 p-3.5 text-sm font-semibold text-red-600"><Lock size={18} />{error}</div>}<button disabled={loading} className="w-full rounded-xl bg-primary py-4 font-bold text-white hover:bg-[#001a54] disabled:opacity-70"><span className="flex items-center justify-center gap-2">{loading ? 'Đang đăng nhập...' : 'Đăng nhập vào hệ thống'}<ArrowRight size={18} /></span></button></form></div></div></div></div>;
};
