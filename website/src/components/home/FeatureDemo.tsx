import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface DemoScript {
  command: string;
  lines: { text: string; delay: number }[];
}

const demos: Record<string, DemoScript> = {
  generate: {
    command: 'bricks generate section "A pricing table with three tiers" --page 1460',
    lines: [
      { text: '● Generating via Claude Code...', delay: 800 },
      { text: '  ├─ Reading design tokens...', delay: 400 },
      { text: '  ├─ Applying classes: fr-pricing, grid--auto-3', delay: 400 },
      { text: '  └─ Building 12 elements...', delay: 500 },
      { text: '✓ Generated section with 3 pricing cards', delay: 600 },
      { text: '✓ Pushed to page 1460. Snapshot #41 saved.', delay: 400 },
    ],
  },
  agent: {
    command: 'bricks agent context --format prompt',
    lines: [
      { text: '● Loading site context...', delay: 600 },
      { text: '  ├─ 47 global classes (32 ACSS, 15 custom)', delay: 300 },
      { text: '  ├─ 12 design tokens', delay: 250 },
      { text: '  ├─ 8 templates', delay: 250 },
      { text: '  └─ 24 element types', delay: 250 },
      { text: '✓ Context exported (4.2 KB)', delay: 400 },
      { text: '  Ready for Claude Code, Codex, or any agent.', delay: 300 },
    ],
  },
  search: {
    command: 'bricks search elements --class fr-hero --json',
    lines: [
      { text: '● Searching across 24 pages...', delay: 600 },
      { text: '  Found 6 matches:', delay: 400 },
      { text: '  ├─ Home (page 1460) → section#a7f3', delay: 200 },
      { text: '  ├─ About (page 1462) → section#b2c1', delay: 200 },
      { text: '  ├─ Services (page 1465) → section#d4e8', delay: 200 },
      { text: '  ├─ Contact (page 1470) → section#f1a9', delay: 200 },
      { text: '  ├─ Blog (page 1480) → section#c3d7', delay: 200 },
      { text: '  └─ Portfolio (page 1485) → section#e5f2', delay: 200 },
      { text: '✓ 6 elements with class fr-hero', delay: 400 },
    ],
  },
  templates: {
    command: 'bricks compose hero-cali feature-havana --push 1460',
    lines: [
      { text: '● Composing 2 templates...', delay: 600 },
      { text: '  ├─ hero-cali: 4 elements, dark gradient', delay: 350 },
      { text: '  └─ feature-havana: 8 elements, 3-column grid', delay: 350 },
      { text: '● Resolving classes for target site...', delay: 400 },
      { text: '  ├─ Mapped 6 global classes', delay: 250 },
      { text: '  └─ Applied style profile', delay: 250 },
      { text: '✓ 12 elements composed and pushed to page 1460', delay: 500 },
    ],
  },
};

function MiniTerminal({ demoKey }: { demoKey: string }) {
  const demo = demos[demoKey];
  const [typedCmd, setTypedCmd] = useState('');
  const [visibleLines, setVisibleLines] = useState(0);
  const [phase, setPhase] = useState<'typing' | 'running' | 'done'>('typing');

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setTypedCmd('');
      setVisibleLines(0);
      setPhase('typing');

      // Type command
      for (let i = 0; i <= demo.command.length; i++) {
        if (cancelled) return;
        setTypedCmd(demo.command.slice(0, i));
        await new Promise((r) => setTimeout(r, 20));
      }

      await new Promise((r) => setTimeout(r, 300));
      if (cancelled) return;
      setPhase('running');

      // Show output
      let total = 0;
      for (let i = 0; i < demo.lines.length; i++) {
        total += demo.lines[i].delay;
        setTimeout(() => {
          if (!cancelled) setVisibleLines((v) => v + 1);
        }, total);
      }

      setTimeout(() => {
        if (!cancelled) setPhase('done');
      }, total + 500);

      // Restart
      setTimeout(() => {
        if (!cancelled) run();
      }, total + 4000);
    };

    run();
    return () => { cancelled = true; };
  }, [demoKey]);

  return (
    <div className="rounded-lg border border-white/5 bg-black/40 p-3 font-mono text-[11px] leading-relaxed h-[160px] overflow-hidden">
      <div className="flex items-start gap-1.5">
        <span className="text-green-400 shrink-0">$</span>
        <span className="text-gray-300 break-all">
          {typedCmd}
          {phase === 'typing' && (
            <motion.span
              className="inline-block w-1.5 h-3 bg-gray-400 ml-0.5 align-middle"
              animate={{ opacity: [1, 0] }}
              transition={{ duration: 0.5, repeat: Infinity }}
            />
          )}
        </span>
      </div>
      {phase !== 'typing' && (
        <div className="mt-1.5 space-y-0">
          {demo.lines.slice(0, visibleLines).map((line, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={
                line.text.startsWith('✓')
                  ? 'text-green-400'
                  : line.text.startsWith('●')
                    ? 'text-yellow-400'
                    : 'text-gray-500'
              }
            >
              {line.text}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

const features = [
  {
    key: 'generate',
    title: 'Natural language to Bricks elements',
    copy: 'Tell it what you want. The AI writes Bricks elements that use your design tokens, your global classes, and your responsive settings. Not generic output -- output that fits your site.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
      </svg>
    ),
  },
  {
    key: 'agent',
    title: 'Bring your own agent',
    copy: 'Claude Code, Codex, OpenCode, whatever you like. The CLI exports your site context so any AI tool can read your classes, tokens, and templates.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-2.04a4.5 4.5 0 00-1.242-7.244l-4.5-4.5a4.5 4.5 0 00-6.364 6.364L4.25 8.25" />
      </svg>
    ),
  },
  {
    key: 'search',
    title: 'Cross-site intelligence',
    copy: 'Find every hero section, pricing table, or class usage across your entire site. Pull color palettes and spacing tokens. The AI works with the full picture.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
      </svg>
    ),
  },
  {
    key: 'templates',
    title: 'Templates and style profiles',
    copy: 'Learn templates from pages you already like. Compose multiple sections into new pages. Style profiles keep the output consistent with your design system.',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.429 9.75L2.25 12l4.179 2.25m0-4.5l5.571 3 5.571-3m-11.142 0L2.25 7.5 12 2.25l9.75 5.25-4.179 2.25m0 0L12 12.75 6.429 9.75m11.142 0l4.179 2.25L12 17.25 2.25 12l4.179-2.25" />
      </svg>
    ),
  },
];

export default function FeatureShowcase() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {features.map((feature) => (
        <div
          key={feature.key}
          className="rounded-xl border border-white/5 bg-white/[0.02] p-6 hover:border-white/10 transition-colors"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="text-yellow-400">{feature.icon}</div>
            <h3 className="text-white font-semibold">{feature.title}</h3>
          </div>
          <p className="text-gray-400 text-sm leading-relaxed mb-4">{feature.copy}</p>
          <MiniTerminal demoKey={feature.key} />
        </div>
      ))}
    </div>
  );
}
