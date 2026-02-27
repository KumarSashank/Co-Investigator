'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

export default function ThemeToggle() {
    const [mounted, setMounted] = useState(false);
    const { theme, setTheme } = useTheme();

    // useEffect only runs on the client, so now we can safely show the UI
    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return (
            <button className="w-8 h-8 rounded-lg flex items-center justify-center opacity-50" disabled>
                <span className="text-sm">...</span>
            </button>
        );
    }

    const isDark = theme === 'dark';

    return (
        <button
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:scale-110 active:scale-95 border border-[var(--border-default)]"
            style={{
                background: 'var(--bg-input)',
                color: isDark ? 'var(--accent-amber)' : 'var(--text-primary)',
            }}
            title={`Switch to ${isDark ? 'Light' : 'Dark'} Mode`}
        >
            {isDark ? '☀️' : '🌙'}
        </button>
    );
}
