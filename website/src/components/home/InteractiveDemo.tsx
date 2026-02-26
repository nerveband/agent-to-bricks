import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

type ViewMode = 'gui' | 'cli';
type DemoId = 'styles' | 'docs' | 'media';

interface CliConfig {
  command: string;
  lines: { text: string; delay: number }[];
}

const cliConfigs: Record<DemoId, CliConfig> = {
  styles: {
    command: 'bricks search --type heading | bricks modify --style "color: var(--primary)" --push',
    lines: [
      { text: '● Searching for headings across all pages...', delay: 800 },
      { text: '  Found 47 headings across 20 pages', delay: 400 },
      { text: '● Modifying styles...', delay: 600 },
      { text: '  ├─ Homepage: 8 headings updated', delay: 250 },
      { text: '  ├─ About: 6 headings updated', delay: 200 },
      { text: '  ├─ Services: 12 headings updated', delay: 200 },
      { text: '  └─ ...17 more pages', delay: 250 },
      { text: '● Pushing changes...', delay: 500 },
      { text: '✓ 47 headings updated across 20 pages', delay: 400 },
      { text: '✓ Snapshots saved for all modified pages', delay: 300 },
    ],
  },
  docs: {
    command: 'cat brief.md | bricks generate section --page 1460 --push',
    lines: [
      { text: '● Reading input from stdin...', delay: 600 },
      { text: '  Detected: markdown document (2.4kb)', delay: 400 },
      { text: '● Generating section via AI...', delay: 800 },
      { text: '  ├─ Extracted: headline, 3 features, CTA', delay: 350 },
      { text: '  ├─ Applying style profile: default', delay: 300 },
      { text: '  └─ Building 8 Bricks elements...', delay: 400 },
      { text: '● Pushing to page 1460...', delay: 500 },
      { text: '✓ Section generated and pushed to Homepage', delay: 400 },
      { text: '✓ Snapshot #47 saved', delay: 300 },
    ],
  },
  media: {
    command: 'bricks media upload ./photos/*.jpg && bricks generate gallery --images latest --push',
    lines: [
      { text: '● Uploading 6 images...', delay: 700 },
      { text: '  ├─ sunset-1.jpg → ID 2041', delay: 200 },
      { text: '  ├─ sunset-2.jpg → ID 2042', delay: 180 },
      { text: '  ├─ portrait-1.jpg → ID 2043', delay: 180 },
      { text: '  └─ ...3 more uploaded', delay: 250 },
      { text: '✓ 6 images uploaded to media library', delay: 400 },
      { text: '● Generating gallery section...', delay: 700 },
      { text: '  ├─ Layout: 3-column masonry grid', delay: 300 },
      { text: '  └─ Lightbox: enabled', delay: 250 },
      { text: '✓ Gallery with 6 images pushed to page', delay: 400 },
    ],
  },
};

const demoLabels: Record<DemoId, string> = {
  styles: 'Bulk style update',
  docs: 'Content from documents',
  media: 'Multi-page media upload',
};

function CliOutput({ demoId }: { demoId: DemoId }) {
  const config = cliConfigs[demoId];
  const [typedText, setTypedText] = useState('');
  const [visibleLines, setVisibleLines] = useState(0);
  const [phase, setPhase] = useState<'typing' | 'running' | 'done'>('typing');
  const cancelRef = useRef(false);

  useEffect(() => {
    cancelRef.current = false;
    setTypedText('');
    setVisibleLines(0);
    setPhase('typing');

    const run = async () => {
      for (let i = 0; i <= config.command.length; i++) {
        if (cancelRef.current) return;
        setTypedText(config.command.slice(0, i));
        await new Promise((r) => setTimeout(r, 18));
      }
      await new Promise((r) => setTimeout(r, 400));
      if (cancelRef.current) return;
      setPhase('running');

      let total = 0;
      for (let i = 0; i < config.lines.length; i++) {
        total += config.lines[i].delay;
        const idx = i;
        setTimeout(() => {
          if (!cancelRef.current) setVisibleLines(idx + 1);
        }, total);
      }
      setTimeout(() => {
        if (!cancelRef.current) setPhase('done');
      }, total + 400);
    };
    run();
    return () => { cancelRef.current = true; };
  }, [demoId]);

  const getColor = (text: string) => {
    if (text.startsWith('✓')) return 'text-accent-green font-medium';
    if (text.startsWith('●')) return 'text-accent-yellow';
    return 'text-ui-muted';
  };

  return (
    <div className="p-5 font-mono text-xs leading-relaxed min-h-[300px]">
      <div className="flex items-start gap-2 mb-2">
        <span className="text-accent-green font-bold">$</span>
        <span className="text-ui-fg break-all">
          {phase === 'typing' ? typedText : config.command}
          {phase === 'typing' && (
            <motion.span className="inline-block w-1.5 h-3.5 ml-0.5 align-middle bg-ui-muted" animate={{ opacity: [1, 0] }} transition={{ duration: 0.5, repeat: Infinity }} />
          )}
        </span>
      </div>
      {phase !== 'typing' && (
        <div className="mt-3 space-y-0.5">
          {config.lines.slice(0, visibleLines).map((line, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className={getColor(line.text)}>
              {line.text}
            </motion.div>
          ))}
        </div>
      )}
      {phase === 'done' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 flex items-center gap-2">
          <span className="text-accent-green font-bold">$</span>
          <motion.span className="inline-block w-1.5 h-3.5 bg-ui-muted" animate={{ opacity: [1, 0] }} transition={{ duration: 0.6, repeat: Infinity }} />
        </motion.div>
      )}
    </div>
  );
}

function GuiStylesDemo() {
  return (
    <div className="flex min-h-[300px]">
      <div className="w-[150px] shrink-0 border-r border-subtle p-3 bg-black/20 flex flex-col gap-1">
        <div className="text-[9px] uppercase tracking-[0.15em] text-ui-subtle font-medium mb-2">Styles</div>
        {['heading-xl', 'heading-lg', 'body-text', 'caption'].map((s, i) => (
          <div key={s} className={`text-[11px] px-2 py-1 rounded ${i === 0 ? 'bg-accent-yellow/10 text-accent-yellow border border-accent-yellow/20 font-medium' : 'text-ui-muted'}`}>{s}</div>
        ))}
      </div>
      <div className="flex-1 flex flex-col p-4">
        <div className="glass-input rounded-lg p-2.5 flex items-center gap-2 flex-wrap text-sm mb-3">
          <span className="text-ui-fg text-xs">Apply</span>
          <span className="inline-flex items-center px-2 py-0.5 rounded bg-accent-yellow/15 border border-accent-yellow/25 text-accent-yellow text-[11px] font-mono font-medium">@style:heading-xl</span>
          <span className="text-ui-fg text-xs">globally</span>
        </div>
        <div className="text-[9px] uppercase tracking-[0.15em] text-ui-subtle font-medium mb-2">Visual Diff</div>
        <div className="space-y-2 flex-1">
          {['Homepage h1', 'About h1', 'Services h1', 'Blog h1'].map((item) => (
            <div key={item} className="flex items-center gap-3 text-[11px]">
              <span className="text-ui-muted w-20 shrink-0">{item}</span>
              <span className="text-red-400/70 line-through">#333333</span>
              <span className="text-ui-subtle">&rarr;</span>
              <span className="text-accent-yellow font-mono">var(--primary)</span>
            </div>
          ))}
        </div>
        <button className="mt-3 self-end px-4 py-2 rounded-lg bg-accent-yellow text-black text-xs font-semibold spring-btn shadow-[var(--shadow-glow)]">
          Push Changes
        </button>
      </div>
    </div>
  );
}

function GuiDocsDemo() {
  return (
    <div className="flex flex-col min-h-[300px] p-4">
      <div className="flex items-center gap-3 p-4 rounded-lg border border-dashed border-subtle bg-[var(--white-glass)] mb-4">
        <div className="w-10 h-10 rounded-lg bg-red-500/20 border border-red-500/30 flex items-center justify-center text-red-400 text-lg">
          <i className="ph ph-file-pdf"></i>
        </div>
        <div>
          <div className="text-sm text-ui-fg font-medium">product-brief.pdf</div>
          <div className="text-[10px] text-ui-muted">2.4 KB &mdash; Uploaded</div>
        </div>
        <span className="ml-auto text-accent-green text-xs">&check; Parsed</span>
      </div>
      <div className="text-[9px] uppercase tracking-[0.15em] text-ui-subtle font-medium mb-2">Generated Structure</div>
      <div className="flex-1 space-y-2 mb-4">
        {[
          { icon: 'ph-layout', label: 'Hero Section', desc: 'Headline + CTA button' },
          { icon: 'ph-squares-four', label: 'Feature Grid', desc: '3 columns with icons' },
          { icon: 'ph-currency-dollar', label: 'Pricing Table', desc: '3 tiers: Basic, Pro, Enterprise' },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[var(--white-glass)] border border-subtle">
            <i className={`ph ${item.icon} text-accent-yellow text-base`}></i>
            <div>
              <div className="text-xs text-ui-fg font-medium">{item.label}</div>
              <div className="text-[10px] text-ui-muted">{item.desc}</div>
            </div>
          </div>
        ))}
      </div>
      <button className="self-end px-4 py-2 rounded-lg bg-accent-yellow text-black text-xs font-semibold spring-btn shadow-[var(--shadow-glow)]">
        Push to Homepage
      </button>
    </div>
  );
}

function GuiMediaDemo() {
  const colors = ['#E57373', '#64B5F6', '#81C784', '#FFB74D', '#BA68C8', '#4DD0E1'];
  return (
    <div className="flex flex-col min-h-[300px] p-4">
      <div className="glass-input rounded-lg p-2.5 flex items-center gap-2 flex-wrap text-sm mb-4">
        <span className="text-ui-fg text-xs">Build gallery on</span>
        <span className="inline-flex items-center px-2 py-0.5 rounded bg-accent-yellow/15 border border-accent-yellow/25 text-accent-yellow text-[11px] font-mono font-medium">@page:Gallery</span>
      </div>
      <div className="text-[9px] uppercase tracking-[0.15em] text-ui-subtle font-medium mb-2">Uploaded Images</div>
      <div className="grid grid-cols-6 gap-2 mb-4">
        {colors.map((c, i) => (
          <div key={i} className="aspect-square rounded-lg border border-subtle" style={{ background: c, opacity: 0.7 }} />
        ))}
      </div>
      <div className="text-[9px] uppercase tracking-[0.15em] text-ui-subtle font-medium mb-2">Gallery Preview</div>
      <div className="grid grid-cols-3 gap-1.5 flex-1 mb-4">
        {colors.map((c, i) => (
          <div key={i} className="rounded-md border border-subtle" style={{ background: c, opacity: 0.5, minHeight: '48px' }} />
        ))}
      </div>
      <button className="self-end px-4 py-2 rounded-lg bg-accent-yellow text-black text-xs font-semibold spring-btn shadow-[var(--shadow-glow)]">
        Build Gallery
      </button>
    </div>
  );
}

const guiComponents: Record<DemoId, React.ReactNode> = {
  styles: <GuiStylesDemo />,
  docs: <GuiDocsDemo />,
  media: <GuiMediaDemo />,
};

export default function InteractiveDemo() {
  const [view, setView] = useState<ViewMode>('gui');
  const [activeDemo, setActiveDemo] = useState<DemoId>('styles');

  return (
    <div>
      {/* View toggle */}
      <div className="flex justify-center mb-6">
        <div className="inline-flex items-center rounded-lg border border-subtle pill-glass p-1" role="tablist">
          {(['gui', 'cli'] as ViewMode[]).map((v) => (
            <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)}
              className={`relative px-5 py-2 text-sm font-medium rounded-md transition-colors ${view === v ? 'text-black' : 'text-ui-muted hover:text-ui-fg'}`}>
              {view === v && (
                <motion.div layoutId="demo-toggle-bg" className="absolute inset-0 bg-accent-yellow rounded-md" transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
              )}
              <span className="relative z-10 uppercase">{v}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Demo buttons */}
      <div className="flex flex-wrap justify-center gap-3 mb-6">
        {(Object.keys(demoLabels) as DemoId[]).map((id) => (
          <button key={id} onClick={() => setActiveDemo(id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeDemo === id ? 'bg-accent-yellow/10 text-accent-yellow border border-accent-yellow/30' : 'text-ui-muted border border-subtle hover:border-base hover:text-ui-fg'
            }`}>
            {demoLabels[id]}
          </button>
        ))}
      </div>

      {/* Output window */}
      <div className="glass-base relative overflow-hidden rounded-2xl border border-subtle shadow-2xl">
        <div className="noise rounded-2xl" />
        {/* Title bar */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-subtle white-glass relative z-10">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-[#FF5F56] border border-[#E0443E]" />
            <div className="w-3 h-3 rounded-full bg-[#FFBD2E] border border-[#DEA123]" />
            <div className="w-3 h-3 rounded-full bg-[#27C93F] border border-[#1AAB29]" />
          </div>
          <span className="text-xs text-ui-muted ml-2 font-mono">
            {view === 'cli' ? 'Terminal' : 'Agent to Bricks — GUI'}
          </span>
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          <motion.div key={`${activeDemo}-${view}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="relative z-10">
            {view === 'cli' ? (
              <>
                <div className="absolute inset-0 scanlines opacity-15 pointer-events-none z-0" />
                <CliOutput demoId={activeDemo} />
              </>
            ) : (
              guiComponents[activeDemo]
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
