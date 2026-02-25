import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const command = 'bricks generate section "dark hero with gradient and CTA" --push 1460';

const outputLines = [
  { text: '● Connecting to developer-portal...', delay: 600 },
  { text: '● Generating section via Claude Code...', delay: 1000 },
  { text: '', delay: 200 },
  { text: '  {', delay: 200 },
  { text: '    "id": "sec-a7f3",', delay: 150 },
  { text: '    "name": "section",', delay: 150 },
  { text: '    "children": [', delay: 150 },
  { text: '      { "id": "div-b2c1", "name": "div", "label": "Hero Wrapper" },', delay: 150 },
  { text: '      { "id": "hdg-e4d9", "name": "heading", "tag": "h1" },', delay: 150 },
  { text: '      { "id": "btn-f8a2", "name": "div", "label": "CTA Button" }', delay: 150 },
  { text: '    ]', delay: 100 },
  { text: '  }', delay: 100 },
  { text: '', delay: 200 },
  { text: '✓ Generated 4 elements with global classes: fr-hero, dark-gradient', delay: 500 },
  { text: '✓ Pushed to page 1460', delay: 400 },
  { text: '✓ Snapshot #38 saved', delay: 300 },
];

export default function CliMockup() {
  const [typedCmd, setTypedCmd] = useState('');
  const [visibleLines, setVisibleLines] = useState<number>(0);
  const [phase, setPhase] = useState<'prompt' | 'typing' | 'running' | 'done'>('prompt');

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      // Initial pause
      await new Promise((r) => setTimeout(r, 800));
      if (cancelled) return;
      setPhase('typing');

      // Type command
      for (let i = 0; i <= command.length; i++) {
        if (cancelled) return;
        setTypedCmd(command.slice(0, i));
        await new Promise((r) => setTimeout(r, 25));
      }

      await new Promise((r) => setTimeout(r, 400));
      if (cancelled) return;
      setPhase('running');

      // Show output lines
      let total = 0;
      for (let i = 0; i < outputLines.length; i++) {
        total += outputLines[i].delay;
        setTimeout(() => {
          if (!cancelled) setVisibleLines((v) => v + 1);
        }, total);
      }

      setTimeout(() => {
        if (!cancelled) setPhase('done');
      }, total + 800);

      // Restart
      setTimeout(() => {
        if (cancelled) return;
        setTypedCmd('');
        setVisibleLines(0);
        setPhase('prompt');
        run();
      }, total + 5000);
    };

    run();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="rounded-xl border border-white/10 bg-[#0d0d12]/95 backdrop-blur-sm overflow-hidden shadow-2xl">
      {/* Title bar */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/5 bg-white/[0.02]">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500/70" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
          <div className="w-3 h-3 rounded-full bg-green-500/70" />
        </div>
        <span className="text-xs text-gray-500 ml-2 font-mono">Terminal</span>
      </div>

      {/* Terminal body */}
      <div className="p-4 h-[280px] sm:h-[320px] overflow-hidden font-mono text-xs leading-relaxed">
        {/* Command line */}
        <div className="flex items-start gap-2">
          <span className="text-green-400 shrink-0">$</span>
          <span className="text-gray-200">
            {typedCmd}
            {(phase === 'typing' || phase === 'prompt') && (
              <motion.span
                className="inline-block w-2 h-4 bg-gray-300 ml-0.5 align-middle"
                animate={{ opacity: [1, 0] }}
                transition={{ duration: 0.6, repeat: Infinity }}
              />
            )}
          </span>
        </div>

        {/* Output */}
        {phase !== 'prompt' && phase !== 'typing' && (
          <div className="mt-3 space-y-0">
            <AnimatePresence>
              {outputLines.slice(0, visibleLines).map((line, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.15 }}
                  className={
                    line.text.startsWith('✓')
                      ? 'text-green-400'
                      : line.text.startsWith('●')
                        ? 'text-yellow-400'
                        : line.text.startsWith('  ')
                          ? 'text-blue-300/80'
                          : 'text-gray-400'
                  }
                >
                  {line.text || '\u00A0'}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* New prompt after done */}
        {phase === 'done' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-2 flex items-center gap-2"
          >
            <span className="text-green-400">$</span>
            <motion.span
              className="inline-block w-2 h-4 bg-gray-300"
              animate={{ opacity: [1, 0] }}
              transition={{ duration: 0.6, repeat: Infinity }}
            />
          </motion.div>
        )}
      </div>
    </div>
  );
}
