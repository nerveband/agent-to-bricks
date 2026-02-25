import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const tools = [
  { name: 'Claude Code', active: true },
  { name: 'generate', active: false },
  { name: 'search', active: false },
  { name: 'templates', active: false },
  { name: 'site push', active: false },
];

const promptText = 'Generate a dark hero section with a CTA button and gradient background';

const terminalLines = [
  { text: '● Connected to site: developer-portal (ID: 1460)', delay: 800 },
  { text: '⟩ Generating section with Claude Code...', delay: 1200 },
  { text: '  ├─ Analyzing design tokens...', delay: 300 },
  { text: '  ├─ Applying global classes: fr-hero, dark-gradient', delay: 400 },
  { text: '  ├─ Building 4 elements...', delay: 500 },
  { text: '  └─ Responsive settings applied', delay: 300 },
  { text: '✓ Section generated → 4 elements', delay: 600 },
  { text: '✓ Pushed to page 1460. Snapshot #38 saved.', delay: 400 },
];

export default function GuiMockup() {
  const [typedPrompt, setTypedPrompt] = useState('');
  const [visibleLines, setVisibleLines] = useState<number>(0);
  const [phase, setPhase] = useState<'typing' | 'running' | 'done'>('typing');

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      // Typing phase
      for (let i = 0; i <= promptText.length; i++) {
        if (cancelled) return;
        setTypedPrompt(promptText.slice(0, i));
        await new Promise((r) => setTimeout(r, 35));
      }

      await new Promise((r) => setTimeout(r, 500));
      if (cancelled) return;
      setPhase('running');

      // Terminal output phase
      let total = 0;
      for (let i = 0; i < terminalLines.length; i++) {
        total += terminalLines[i].delay;
        setTimeout(() => {
          if (!cancelled) setVisibleLines((v) => v + 1);
        }, total);
      }

      setTimeout(() => {
        if (!cancelled) setPhase('done');
      }, total + 1000);

      // Restart loop
      setTimeout(() => {
        if (cancelled) return;
        setTypedPrompt('');
        setVisibleLines(0);
        setPhase('typing');
        run();
      }, total + 5000);
    };

    run();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="rounded-xl border border-white/10 bg-[#0f0c29]/90 backdrop-blur-sm overflow-hidden shadow-2xl">
      {/* Title bar */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/5 bg-white/[0.02]">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500/70" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
          <div className="w-3 h-3 rounded-full bg-green-500/70" />
        </div>
        <span className="text-xs text-gray-500 ml-2 font-mono">Agent to Bricks — GUI</span>
      </div>

      <div className="flex h-[280px] sm:h-[320px]">
        {/* Sidebar */}
        <div className="w-40 border-r border-white/5 bg-white/[0.01] p-3 hidden sm:block">
          <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">Tools</p>
          <div className="space-y-1">
            {tools.map((tool) => (
              <div
                key={tool.name}
                className={`text-xs px-2 py-1.5 rounded ${
                  tool.active
                    ? 'bg-yellow-400/10 text-yellow-400 border border-yellow-400/20'
                    : 'text-gray-500 hover:text-gray-400'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  {tool.active && (
                    <motion.span
                      className="w-1.5 h-1.5 rounded-full bg-yellow-400"
                      animate={{ opacity: [1, 0.3, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    />
                  )}
                  {tool.name}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Main area */}
        <div className="flex-1 flex flex-col">
          {/* Terminal output */}
          <div className="flex-1 p-4 overflow-hidden font-mono text-xs leading-relaxed">
            <AnimatePresence>
              {terminalLines.slice(0, visibleLines).map((line, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2 }}
                  className={
                    line.text.startsWith('✓')
                      ? 'text-green-400'
                      : line.text.startsWith('●')
                        ? 'text-yellow-400'
                        : 'text-gray-400'
                  }
                >
                  {line.text}
                </motion.div>
              ))}
            </AnimatePresence>
            {phase === 'running' && visibleLines < terminalLines.length && (
              <motion.span
                className="inline-block w-2 h-4 bg-yellow-400/60"
                animate={{ opacity: [1, 0] }}
                transition={{ duration: 0.6, repeat: Infinity }}
              />
            )}
          </div>

          {/* Prompt pane */}
          <div className="border-t border-white/5 p-3 bg-white/[0.02]">
            <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
              <span className="text-yellow-400 text-xs">⟩</span>
              <span className="text-sm text-gray-300 flex-1">
                {typedPrompt}
                {phase === 'typing' && (
                  <motion.span
                    className="inline-block w-0.5 h-4 bg-yellow-400 ml-0.5 align-middle"
                    animate={{ opacity: [1, 0] }}
                    transition={{ duration: 0.5, repeat: Infinity }}
                  />
                )}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
