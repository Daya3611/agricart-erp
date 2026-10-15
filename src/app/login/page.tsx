'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { Lock, Mail, ArrowRight, AlertTriangle } from 'lucide-react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const errorParam = searchParams.get('error');
    if (errorParam === 'account_inactive' || errorParam === 'deactivated') {
      setError('Your account is currently inactive or deactivated. Please contact your administrator.');
    } else if (errorParam === 'unauthorized') {
      setError('You must sign in to access this protected area.');
    }
  }, [searchParams]);

  const isSafeInternalUrl = (url: string | null): boolean => {
    if (!url) return false;
    // Disallow protocols (javascript:, http:, https:) and protocol-relative URLs (// or /\)
    if (!url.startsWith('/') || url.startsWith('//') || url.startsWith('/\\')) return false;
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(url)) return false;
    return true;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setLoading(true);
    setError(null);

    try {
      let idToken = '';

      // Authenticate with Firebase Client SDK if configured
      try {
        const userCred = await signInWithEmailAndPassword(auth, email, password);
        idToken = await userCred.user.getIdToken();
      } catch (clientAuthErr: any) {
        if (
          clientAuthErr.code === 'auth/invalid-credential' ||
          clientAuthErr.code === 'auth/wrong-password' ||
          clientAuthErr.code === 'auth/invalid-login-credentials'
        ) {
          setError('Invalid email or password. Please verify your credentials.');
          setLoading(false);
          return;
        } else if (clientAuthErr.code === 'auth/user-not-found') {
          setError('No account found for this email address. Please check your credentials.');
          setLoading(false);
          return;
        } else if (clientAuthErr.code === 'auth/user-disabled') {
          setError('This account has been disabled. Please contact your system administrator.');
          setLoading(false);
          return;
        } else if (clientAuthErr.code === 'auth/too-many-requests') {
          setError('Too many failed attempts. Please try again later.');
          setLoading(false);
          return;
        }
        // Fallback to server-side authentication verification
      }

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, idToken }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Invalid credentials. Please check your email and password.');
      }

      const rawReturnUrl = searchParams.get('returnUrl');
      let targetDestination = data.redirectUrl || '/staff/dashboard';

      // Check if returnUrl is a safe internal redirect and matches role scope
      if (isSafeInternalUrl(rawReturnUrl)) {
        const returnPath = rawReturnUrl as string;
        if (data.role === 'staff' && returnPath.startsWith('/staff')) {
          targetDestination = returnPath;
        } else if (data.role === 'manager' && (returnPath.startsWith('/manager') || returnPath.startsWith('/staff'))) {
          targetDestination = returnPath;
        } else if (
          (data.role === 'admin' || data.role === 'super_admin') &&
          (returnPath.startsWith('/admin') || returnPath.startsWith('/manager') || returnPath.startsWith('/staff'))
        ) {
          targetDestination = returnPath;
        }
      }

      router.push(targetDestination);
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Branding Header */}
        <div className="text-center space-y-3">
          <div className="relative mx-auto h-24 w-24 sm:h-28 sm:w-28 drop-shadow-sm">
            <Image
              src="/logo.png"
              alt="Agricart Farmers Producer Company Limited"
              width={112}
              height={112}
              priority
              className="h-full w-full object-contain"
            />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">
              AGRICART FPC
            </h1>
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
              Enterprise ERP & Management Portal
            </p>
          </div>
        </div>

        {/* Login Form Card */}
        <Card className="border-slate-200/80 shadow-md">
          <CardContent className="p-6 space-y-4">
            <h2 className="text-base font-bold text-slate-900 text-center border-b border-slate-100 pb-3">
              Sign In to Your Account
            </h2>

            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-900 rounded-xl text-xs font-bold flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-rose-600 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Official Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    type="email"
                    placeholder="user@agricartfpc.org"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 h-11 text-sm rounded-xl"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 h-11 text-sm rounded-xl"
                    required
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold h-11 rounded-xl text-sm"
              >
                {loading ? 'Authenticating...' : 'Sign In'} <ArrowRight className="h-4 w-4 ml-1.5" />
              </Button>
            </form>

            <div className="pt-2 text-center border-t border-slate-100">
              <p className="text-xs text-slate-500">
                Accounts are provisioned by system administrators. Contact your administrator if you need access.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Footer info */}
        <div className="text-center text-xs text-slate-500 space-y-1">
          <p className="font-semibold text-slate-700">Agricart Farmers Producer Company Ltd</p>

        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">Loading login...</div>}>
      <LoginFormContent />
    </Suspense>
  );
}
