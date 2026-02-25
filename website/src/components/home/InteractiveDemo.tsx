import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

type ViewMode = 'gui' | 'cli';
type DemoId = 'hero' | 'photos' | 'headings';

interface DemoConfig {
  label: string;
  cli: {
    command: string;
    lines: { text: string; delay: number }[];
  };
  gui: {
    prompt: string;
    lines: { text: string; delay: number }[];
  };
}

const demoConfigs: Record<DemoId, DemoConfig> = {
  hero: {
    label: 'Generate hero section',
    cli: {
      command: 'bricks generate section "modern hero with video background" --page 1460',
      lines: [
        { text: '● Generating section via Claude Code...', delay: 1000 },
        { text: '  ├─ Analyzing page structure...', delay: 400 },
        { text: '  ├─ Applying tokens: --primary, --space-xl', delay: 350 },
        { text: '  ├─ Using classes: fr-hero, section--l, bg--primary-dark', delay: 400 },
        { text: '  └─ Building 6 elements...', delay: 500 },
        { text: '', delay: 100 },
        { text: '  { "id": "sec-f7a1", "name": "section", "children": [', delay: 200 },
        { text: '    { "id": "div-c3b2", "name": "div", "label": "Video BG" },', delay: 150 },
        { text: '    { "id": "div-a8d4", "name": "div", "label": "Content Wrapper" },', delay: 150 },
        { text: '    { "id": "hdg-e2f5", "name": "heading", "tag": "h1" },', delay: 150 },
        { text: '    { "id": "txt-b1c6", "name": "text" },', delay: 150 },
        { text: '    { "id": "btn-d9e7", "name": "div", "label": "CTA Group" }', delay: 150 },
        { text: '  ]}', delay: 100 },
        { text: '', delay: 200 },
        { text: '✓ Pushed to page 1460. Snapshot #42 saved.', delay: 500 },
      ],
    },
    gui: {
      prompt: 'Generate a modern hero section with video background',
      lines: [
        { text: '● Connected to developer-portal (page 1460)', delay: 800 },
        { text: '⟩ Running Claude Code...', delay: 600 },
        { text: '  ├─ Analyzing page structure...', delay: 400 },
        { text: '  ├─ Applying design tokens...', delay: 350 },
        { text: '  ├─ Resolving 3 global classes...', delay: 400 },
        { text: '  └─ Building 6 elements...', delay: 500 },
        { text: '✓ Section generated → 6 elements', delay: 600 },
        { text: '✓ Pushed to page 1460. Snapshot #42 saved.', delay: 400 },
      ],
    },
  },
  photos: {
    label: 'Upload photos to gallery',
    cli: {
      command: 'bricks media upload ./photos/*.jpg && bricks generate section "photo gallery" --page 1460',
      lines: [
        { text: '● Uploading 8 images...', delay: 800 },
        { text: '  ├─ sunset-1.jpg → ID 2041', delay: 300 },
        { text: '  ├─ sunset-2.jpg → ID 2042', delay: 250 },
        { text: '  ├─ portrait-1.jpg → ID 2043', delay: 250 },
        { text: '  ├─ landscape-1.jpg → ID 2044', delay: 250 },
        { text: '  └─ ... 4 more uploaded', delay: 300 },
        { text: '✓ 8 images uploaded to media library', delay: 400 },
        { text: '', delay: 200 },
        { text: '● Generating gallery section...', delay: 800 },
        { text: '  ├─ Using uploaded images (IDs 2041-2048)', delay: 350 },
        { text: '  └─ Applying grid layout: grid--auto-4', delay: 350 },
        { text: '✓ Gallery with 8 images pushed to page 1460', delay: 500 },
      ],
    },
    gui: {
      prompt: 'Upload photos from ./photos/ and create a gallery section',
      lines: [
        { text: '● Uploading 8 images...', delay: 800 },
        { text: '  ├─ 8/8 uploaded to media library', delay: 600 },
        { text: '⟩ Generating gallery section...', delay: 800 },
        { text: '  ├─ Referencing 8 uploaded images', delay: 350 },
        { text: '  └─ Using grid--auto-4 layout', delay: 350 },
        { text: '✓ Gallery section → 10 elements', delay: 600 },
        { text: '✓ Pushed to page 1460', delay: 400 },
      ],
    },
  },
  headings: {
    label: 'Change heading colors',
    cli: {
      command: 'bricks search elements --type heading --json | bricks generate modify "change all heading colors to var(--primary)" --page 1460',
      lines: [
        { text: '● Searching for headings across all pages...', delay: 800 },
        { text: '  Found 12 headings across 4 pages', delay: 400 },
        { text: '', delay: 200 },
        { text: '● Modifying elements...', delay: 600 },
        { text: '  ├─ Home (page 1460): 4 headings updated', delay: 300 },
        { text: '  ├─ About (page 1462): 3 headings updated', delay: 300 },
        { text: '  ├─ Services (page 1465): 3 headings updated', delay: 300 },
        { text: '  └─ Contact (page 1470): 2 headings updated', delay: 300 },
        { text: '✓ Modified 12 elements across 4 pages', delay: 500 },
        { text: '✓ Snapshots saved for all modified pages', delay: 400 },
      ],
    },
    gui: {
      prompt: 'Find all headings and change their color to var(--primary)',
      lines: [
        { text: '● Searching all pages for headings...', delay: 800 },
        { text: '  Found 12 headings across 4 pages', delay: 400 },
        { text: '⟩ Applying color change...', delay: 600 },
        { text: '  ├─ 4 pages modified', delay: 300 },
        { text: '  └─ 12 headings → color: var(--primary)', delay: 300 },
        { text: '✓ 12 elements modified', delay: 500 },
        { text: '✓ Snapshots saved', delay: 400 },
      ],
    },
  },
};

export default function InteractiveDemo() {
  const [view, setView] = useState<ViewMode>('gui');
  const [activeDemo, setActiveDemo] = useState<DemoId>('hero');
  const [typedText, setTypedText] = useState('');
  const [visibleLines, setVisibleLines] = useState(0);
  const [phase, setPhase] = useState<'idle' | 'typing' | 'running' | 'done'>('idle');

  const config = demoConfigs[activeDemo];
  const script = view === 'cli' ? config.cli : config.gui;
  const textToType = view === 'cli' ? script.command : (script as typeof config.gui).prompt;
  const lines = script.lines;

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setTypedText('');
      setVisibleLines(0);
      setPhase('typing');

      // Type
      for (let i = 0; i <= textToType.length; i++) {
        if (cancelled) return;
        setTypedText(textToType.slice(0, i));
        await new Promise((r) => setTimeout(r, 20));
      }

      await new Promise((r) => setTimeout(r, 400));
      if (cancelled) return;
      setPhase('running');

      // Output
      let total = 0;
      for (let i = 0; i < lines.length; i++) {
        total += lines[i].delay;
        setTimeout(() => {
          if (!cancelled) setVisibleLines((v) => v + 1);
        }, total);
      }

      setTimeout(() => {
        if (!cancelled) setPhase('done');
      }, total + 500);
    };

    run();
    return () => { cancelled = true; };
  }, [activeDemo, view]);

  return (
    <div>
      {/* View toggle */}
      <div className="flex justify-center mb-6">
        <div className="inline-flex items-center rounded-lg border border-white/10 bg-white/[0.03] p-1">
          {(['gui', 'cli'] as ViewMode[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`relative px-5 py-2 text-sm font-medium rounded-md transition-colors ${
                view === v ? 'text-gray-900' : 'text-gray-400 hover:text-white'
              }`}
            >
              {view === v && (
                <motion.div
                  layoutId="demo-toggle-bg"
                  className="absolute inset-0 bg-yellow-400 rounded-md"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <span className="relative z-10 uppercase">{v}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Demo buttons */}
      <div className="flex flex-wrap justify-center gap-3 mb-6">
        {(Object.keys(demoConfigs) as DemoId[]).map((id) => (
          <button
            key={id}
            onClick={() => setActiveDemo(id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeDemo === id
                ? 'bg-yellow-400/10 text-yellow-400 border border-yellow-400/30'
                : 'text-gray-400 border border-white/10 hover:border-white/20 hover:text-white'
            }`}
          >
            {demoConfigs[id].label}
          </button>
        ))}
      </div>

      {/* Terminal / GUI window */}
      <div className="rounded-xl border border-white/10 bg-[#0d0d12]/95 backdrop-blur-sm overflow-hidden shadow-2xl">
        {/* Title bar */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/5 bg-white/[0.02]">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/70" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
            <div className="w-3 h-3 rounded-full bg-green-500/70" />
          </div>
          <span className="text-xs text-gray-500 ml-2 font-mono">
            {view === 'cli' ? 'Terminal' : 'Agent to Bricks — GUI'}
          </span>
        </div>

        {/* Content */}
        <div className="p-5 min-h-[300px] font-mono text-xs leading-relaxed">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${activeDemo}-${view}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {/* Command / Prompt */}
              <div className="flex items-start gap-2">
                <span className={view === 'cli' ? 'text-green-400' : 'text-yellow-400'}>
                  {view === 'cli' ? '$' : '⟩'}
                </span>
                <span className="text-gray-200 break-all">
                  {typedText}
                  {phase === 'typing' && (
                    <motion.span
                      className="inline-block w-1.5 h-3.5 bg-gray-400 ml-0.5 align-middle"
                      animate={{ opacity: [1, 0] }}
                      transition={{ duration: 0.5, repeat: Infinity }}
                    />
                  )}
                </span>
              </div>

              {/* Output lines */}
              {phase !== 'typing' && (
                <div className="mt-3 space-y-0">
                  {lines.slice(0, visibleLines).map((line, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className={
                        line.text.startsWith('✓')
                          ? 'text-green-400'
                          : line.text.startsWith('●') || line.text.startsWith('⟩')
                            ? 'text-yellow-400'
                            : line.text.includes('"id"') || line.text.includes('"name"')
                              ? 'text-blue-300/80'
                              : 'text-gray-500'
                      }
                    >
                      {line.text || '\u00A0'}
                    </motion.div>
                  ))}
                </div>
              )}

              {/* Done indicator */}
              {phase === 'done' && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mt-3 flex items-center gap-2"
                >
                  <span className={view === 'cli' ? 'text-green-400' : 'text-yellow-400'}>
                    {view === 'cli' ? '$' : '⟩'}
                  </span>
                  <motion.span
                    className="inline-block w-1.5 h-3.5 bg-gray-400"
                    animate={{ opacity: [1, 0] }}
                    transition={{ duration: 0.6, repeat: Infinity }}
                  />
                </motion.div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
