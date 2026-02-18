'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';

export default function SettingsPage() {
    const router = useRouter();
    const supabase = createClient();
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    // Form state
    const [fullName, setFullName] = useState('');
    const [examDate, setExamDate] = useState('');

    useEffect(() => {
        supabase.auth.getUser().then(({ data: { user } }) => {
            setUser(user);
            setFullName(user?.user_metadata?.full_name || '');
            setExamDate(user?.user_metadata?.exam_date || '');
            setLoading(false);
        });
    }, [supabase.auth]);

    const handleSave = async () => {
        setSaving(true);
        setSaved(false);
        try {
            await supabase.auth.updateUser({
                data: {
                    full_name: fullName,
                    exam_date: examDate,
                },
            });
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch (error) {
            console.error('Error saving settings:', error);
        } finally {
            setSaving(false);
        }
    };

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        router.push('/');
        router.refresh();
    };

    if (loading) {
        return (
            <main className="flex-1 bg-dashboard-gradient flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
            </main>
        );
    }

    return (
        <main className="flex-1 bg-dashboard-gradient overflow-y-auto relative">
            {/* Background blobs */}
            <div className="absolute top-[-10%] right-[-5%] w-[600px] h-[600px] bg-purple-600/5 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-10%] left-[10%] w-[500px] h-[500px] bg-blue-600/5 rounded-full blur-[100px] pointer-events-none" />

            <div className="max-w-2xl mx-auto px-8 py-10 relative z-10">
                {/* Header */}
                <header className="mb-10">
                    <h1 className="text-3xl font-black text-white tracking-tight">Settings</h1>
                    <p className="text-gray-400 text-sm mt-2">Manage your account preferences</p>
                </header>

                {/* Profile Section */}
                <section className="glass-card rounded-2xl p-6 mb-6">
                    <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-6 flex items-center gap-2">
                        <span className="material-symbols-outlined text-purple-400" style={{ fontSize: '18px' }}>person</span>
                        Profile
                    </h2>

                    <div className="space-y-5">
                        {/* Avatar + Email (read-only) */}
                        <div className="flex items-center gap-4 pb-5 border-b border-white/5">
                            <div className="h-14 w-14 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xl ring-2 ring-white/10">
                                {fullName?.charAt(0)?.toUpperCase() || '?'}
                            </div>
                            <div>
                                <p className="text-white font-bold">{fullName || 'User'}</p>
                                <p className="text-gray-500 text-sm">{user?.email}</p>
                            </div>
                        </div>

                        {/* Full Name */}
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                                Full Name
                            </label>
                            <input
                                type="text"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-all text-sm"
                                placeholder="Your full name"
                            />
                        </div>
                    </div>
                </section>

                {/* Exam Section */}
                <section className="glass-card rounded-2xl p-6 mb-6">
                    <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-6 flex items-center gap-2">
                        <span className="material-symbols-outlined text-purple-400" style={{ fontSize: '18px' }}>event</span>
                        Exam Preparation
                    </h2>

                    <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                            SCA Exam Date
                        </label>
                        <input
                            type="date"
                            value={examDate}
                            onChange={(e) => setExamDate(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-all text-sm [color-scheme:dark]"
                        />
                        <p className="text-xs text-gray-500 mt-2">
                            Set your exam date to see a countdown on your dashboard.
                        </p>
                    </div>
                </section>

                {/* Save Button */}
                <div className="flex items-center gap-4 mb-10">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-8 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold text-sm hover:shadow-lg hover:shadow-purple-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                    {saved && (
                        <span className="flex items-center gap-1.5 text-emerald-400 text-sm font-medium animate-pulse">
                            <span className="material-symbols-outlined text-sm">check_circle</span>
                            Saved successfully
                        </span>
                    )}
                </div>

                {/* Danger Zone */}
                <section className="glass-card rounded-2xl p-6 border-red-500/20">
                    <h2 className="text-sm font-bold text-red-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>warning</span>
                        Account
                    </h2>
                    <button
                        onClick={handleSignOut}
                        className="flex items-center gap-2 px-6 py-3 rounded-xl border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-all text-sm font-medium"
                    >
                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>logout</span>
                        Sign Out
                    </button>
                </section>
            </div>
        </main>
    );
}
