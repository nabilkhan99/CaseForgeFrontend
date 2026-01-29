import { forwardRef } from 'react';

interface AuthInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label: string;
    icon?: 'email' | 'lock' | 'user' | 'shield';
    error?: string;
}

const iconPaths: Record<string, React.ReactNode> = {
    email: (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    ),
    lock: (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    ),
    user: (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    ),
    shield: (
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    ),
};

const AuthInput = forwardRef<HTMLInputElement, AuthInputProps>(
    ({ label, icon, error, className = '', ...props }, ref) => {
        return (
            <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-300">
                    {label}
                </label>
                <div className="relative">
                    {icon && (
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                {iconPaths[icon]}
                            </svg>
                        </div>
                    )}
                    <input
                        ref={ref}
                        className={`
                            w-full px-4 py-3 
                            ${icon ? 'pl-12' : ''} 
                            bg-slate-900/50 border border-slate-700/50 rounded-lg 
                            text-white placeholder-slate-500 
                            focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 
                            transition-all
                            ${error ? 'border-red-500/50 focus:ring-red-500/50' : ''}
                            ${className}
                        `}
                        {...props}
                    />
                </div>
                {error && (
                    <p className="text-red-400 text-xs">{error}</p>
                )}
            </div>
        );
    }
);

AuthInput.displayName = 'AuthInput';

export default AuthInput;
