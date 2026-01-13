'use client';

import { useState, useRef, useEffect } from 'react';
import { getChatResponse } from '@/lib/landing/mock-data';

interface Message {
    role: 'user' | 'patient';
    text: string;
}

export default function InteractiveDemoSection() {
    const [messages, setMessages] = useState<Message[]>([
        {
            role: 'patient',
            text: "Doctor, I'm really worried about these headaches. They just won't go away.",
        },
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage = input.trim();
        setInput('');
        setMessages((prev) => [...prev, { role: 'user', text: userMessage }]);
        setIsLoading(true);

        // Simulate API delay
        await new Promise((r) => setTimeout(r, 600 + Math.random() * 800));

        const response = await getChatResponse(userMessage);
        setMessages((prev) => [...prev, { role: 'patient', text: response }]);
        setIsLoading(false);
    };

    useEffect(() => {
        if (containerRef.current) {
            containerRef.current.scrollTop = containerRef.current.scrollHeight;
        }
    }, [messages]);

    return (
        <section id="demo" className="py-24 bg-[#0f172a] relative overflow-hidden">
            {/* Background Gradient */}
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1/3 h-full bg-gradient-to-l from-primary/10 to-transparent pointer-events-none" />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col lg:flex-row items-center gap-16">
                {/* Left Content */}
                <div className="lg:w-1/2">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-900/30 border border-blue-800 mb-6">
                        <span className="material-symbols-outlined text-blue-400 text-sm">
                            psychology
                        </span>
                        <span className="text-xs font-semibold text-blue-300 uppercase">
                            Advanced Natural Language Processing
                        </span>
                    </div>

                    <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
                        Talk naturally.
                        <br />
                        They respond clinically.
                    </h2>

                    <p className="text-slate-400 text-lg mb-8 leading-relaxed">
                        Our AI patients don&apos;t just follow a script. They react to your
                        tone, your phrasing, and your clinical line of questioning. Test
                        your skills on breaking bad news, exploring ICE, and safety netting.
                    </p>

                    <ul className="space-y-4">
                        <li className="flex items-start gap-3">
                            <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center mt-1">
                                <span className="material-symbols-outlined text-green-500 text-sm">
                                    check
                                </span>
                            </div>
                            <p className="text-slate-300">Recognises empathy and cues.</p>
                        </li>
                        <li className="flex items-start gap-3">
                            <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center mt-1">
                                <span className="material-symbols-outlined text-green-500 text-sm">
                                    check
                                </span>
                            </div>
                            <p className="text-slate-300">
                                Provides specific feedback on your phrasing post-consultation.
                            </p>
                        </li>
                    </ul>
                </div>

                {/* Right - Interactive Demo */}
                <div className="lg:w-1/2 w-full">
                    <div className="bg-[#1e293b] rounded-2xl border border-slate-700 shadow-2xl overflow-hidden max-w-md mx-auto relative group">
                        <div className="absolute -inset-0.5 bg-gradient-to-r from-primary to-blue-400 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-500" />

                        <div className="relative bg-[#1e293b] rounded-2xl">
                            {/* Header */}
                            <div className="bg-slate-800 px-4 py-3 flex items-center justify-between border-b border-slate-700 rounded-t-2xl">
                                <span className="text-sm font-semibold text-slate-300">
                                    Interactive Demo
                                </span>
                                <div className="flex gap-1">
                                    <span className="w-2 h-2 rounded-full bg-slate-600" />
                                    <span className="w-2 h-2 rounded-full bg-slate-600" />
                                </div>
                            </div>

                            {/* Chat Container */}
                            <div className="p-6 h-[400px] flex flex-col">
                                <div
                                    ref={containerRef}
                                    className="flex-1 space-y-4 mb-4 overflow-y-auto"
                                >
                                    {messages.map((msg, index) => (
                                        <div
                                            key={index}
                                            className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''
                                                } animate-fade-in-up`}
                                        >
                                            {msg.role === 'user' ? (
                                                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                                                    DR
                                                </div>
                                            ) : (
                                                <div className="w-8 h-8 rounded-full bg-slate-700 shrink-0 ring-1 ring-green-500 flex items-center justify-center">
                                                    <span className="material-symbols-outlined text-slate-400 text-sm">
                                                        person
                                                    </span>
                                                </div>
                                            )}
                                            <div
                                                className={`p-3 rounded-2xl text-sm ${msg.role === 'user'
                                                        ? 'bg-primary/20 text-slate-200 rounded-tr-none'
                                                        : 'bg-slate-700/50 text-slate-200 rounded-tl-none'
                                                    }`}
                                            >
                                                {msg.text}
                                            </div>
                                        </div>
                                    ))}

                                    {isLoading && (
                                        <div className="flex gap-3">
                                            <div className="w-8 h-8 rounded-full bg-slate-700 shrink-0 ring-1 ring-green-500 flex items-center justify-center">
                                                <span className="material-symbols-outlined text-slate-400 text-sm">
                                                    person
                                                </span>
                                            </div>
                                            <div className="p-3 rounded-2xl rounded-tl-none bg-slate-700/50 text-slate-200 text-sm">
                                                <span className="inline-flex gap-1">
                                                    <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" />
                                                    <span
                                                        className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"
                                                        style={{ animationDelay: '0.1s' }}
                                                    />
                                                    <span
                                                        className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"
                                                        style={{ animationDelay: '0.2s' }}
                                                    />
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Input */}
                                <div className="relative group/input">
                                    <div className="absolute -inset-0.5 bg-gradient-to-r from-primary to-blue-400 rounded-lg blur opacity-20 group-hover/input:opacity-50 transition duration-500" />
                                    <div className="relative flex gap-2">
                                        <input
                                            type="text"
                                            value={input}
                                            onChange={(e) => setInput(e.target.value)}
                                            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                                            placeholder="Type a question to ask the patient..."
                                            className="w-full bg-[#0f172a] border border-slate-600 rounded-lg py-3 px-4 text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none"
                                        />
                                        <button
                                            onClick={handleSend}
                                            disabled={isLoading}
                                            className="bg-primary hover:bg-primary-hover text-white rounded-lg px-4 flex items-center justify-center transition-colors disabled:opacity-50"
                                        >
                                            <span className="material-symbols-outlined">send</span>
                                        </button>
                                    </div>
                                </div>

                                <div className="text-center mt-3">
                                    <p className="text-[10px] text-slate-500 uppercase tracking-widest">
                                        Live AI Interaction Preview
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
