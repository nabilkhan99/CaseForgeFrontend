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
            className="p-4 space-y-3 overflow-y-auto h-full"
        >
            {displayedMessages.map((msg, index) => (
                <div
                    key={index}
                    className={`flex gap-2.5 ${msg.role === 'doctor' ? 'flex-row-reverse' : ''}`}
                >
                    {msg.role === 'doctor' ? (
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary/20 to-primary-light/20 flex items-center justify-center text-[9px] font-bold text-primary shrink-0">
                            DR
                        </div>
                    ) : (
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-amber-100 to-amber-200 shrink-0 flex items-center justify-center overflow-hidden">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="w-3.5 h-3.5 text-amber-700"
                            >
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                <circle cx="12" cy="7" r="4" />
                            </svg>
                        </div>
                    )}
                    <div
                        className={`p-3 rounded-2xl text-xs leading-relaxed text-body ${
                            msg.role === 'doctor'
                                ? 'bg-white border border-black/[0.04] shadow-elevation-1 rounded-tr-sm'
                                : 'bg-[rgba(180,83,9,0.05)] border border-[rgba(180,83,9,0.08)] rounded-tl-sm'
                        }`}
                    >
                        {msg.text}
                        {index === displayedMessages.length - 1 && isTyping && (
                            <span className="inline-block w-0.5 h-3.5 bg-primary ml-1 animate-pulse" />
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}
