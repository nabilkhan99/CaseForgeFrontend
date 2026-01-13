'use client';

import { useState, useEffect, useRef } from 'react';
import { heroChatMessages } from '@/lib/landing/mock-data';

interface ChatMessage {
    role: 'doctor' | 'patient';
    text: string;
}

export default function HeroChatSimulation() {
    const [displayedMessages, setDisplayedMessages] = useState<ChatMessage[]>([]);
    const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
    const [currentCharIndex, setCurrentCharIndex] = useState(0);
    const [isTyping, setIsTyping] = useState(true);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (currentMessageIndex >= heroChatMessages.length) {
            // Reset and loop
            const timeout = setTimeout(() => {
                setDisplayedMessages([]);
                setCurrentMessageIndex(0);
                setCurrentCharIndex(0);
                setIsTyping(true);
            }, 3000);
            return () => clearTimeout(timeout);
        }

        const currentMessage = heroChatMessages[currentMessageIndex];

        if (currentCharIndex < currentMessage.text.length) {
            // Type one character
            const timeout = setTimeout(() => {
                setDisplayedMessages((prev) => {
                    const newMessages = [...prev];
                    if (newMessages.length <= currentMessageIndex) {
                        newMessages.push({ role: currentMessage.role, text: '' });
                    }
                    newMessages[currentMessageIndex] = {
                        role: currentMessage.role,
                        text: currentMessage.text.slice(0, currentCharIndex + 1),
                    };
                    return newMessages;
                });
                setCurrentCharIndex((prev) => prev + 1);
            }, 15);
            return () => clearTimeout(timeout);
        } else {
            // Move to next message after a pause
            const timeout = setTimeout(() => {
                setCurrentMessageIndex((prev) => prev + 1);
                setCurrentCharIndex(0);
            }, 1500);
            return () => clearTimeout(timeout);
        }
    }, [currentMessageIndex, currentCharIndex]);

    useEffect(() => {
        if (containerRef.current) {
            containerRef.current.scrollTop = containerRef.current.scrollHeight;
        }
    }, [displayedMessages]);

    return (
        <div
            ref={containerRef}
            className="p-4 space-y-4 overflow-y-auto h-full"
        >
            {displayedMessages.map((msg, index) => (
                <div
                    key={index}
                    className={`flex gap-3 ${msg.role === 'doctor' ? 'flex-row-reverse' : ''}`}
                >
                    {msg.role === 'doctor' ? (
                        <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                            DR
                        </div>
                    ) : (
                        <div className="w-6 h-6 rounded-full bg-slate-700 shrink-0 ring-2 ring-green-500 flex items-center justify-center overflow-hidden">
                            <span className="material-symbols-outlined text-slate-400 text-sm">
                                person
                            </span>
                        </div>
                    )}
                    <div
                        className={`p-3 rounded-2xl text-xs ${msg.role === 'doctor'
                                ? 'bg-primary/20 text-slate-200 rounded-tr-none'
                                : 'bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700'
                            }`}
                    >
                        {msg.text}
                        {index === displayedMessages.length - 1 && isTyping && (
                            <span className="inline-block w-1 h-3 bg-white/50 ml-1 animate-pulse" />
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}
