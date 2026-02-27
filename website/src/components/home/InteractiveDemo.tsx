import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

type ViewMode = 'gui' | 'cli';
type DemoId = 'content' | 'docs' | 'media';

interface CliConfig {
  command: string;
  lines: { text: string; delay: number }[];
}

const cliConfigs: Record<DemoId, CliConfig> = {
  content: {
    command: 'bricks pull 42 | bricks modify --add-section testimonials.html --position after:hero --push',
    lines: [
      { text: '● Pulling page 42 (Homepage)...', delay: 800 },
      { text: '  Parsed: 6 sections, 34 elements', delay: 400 },
      { text: '● Reading testimonials.html...', delay: 600 },
      { text: '  Parsed: 1 section, 8 elements', delay: 300 },
      { text: '● Resolving global classes...', delay: 500 },
      { text: '  ├─ section--testimonials → acss_import_section__testimonials', delay: 300 },
      { text: '  └─ 4 more classes resolved', delay: 250 },
      { text: '● Inserting after hero section...', delay: 400 },
      { text: '● Pushing to page 42...', delay: 400 },
      { text: '✓ Section inserted. Snapshot saved.', delay: 300 },
    ],
  },
  docs: {
    command: 'bricks convert html landing-page.html --push 1460 --snapshot',
    lines: [
      { text: '● Reading landing-page.html...', delay: 600 },
      { text: '  Parsed: 4 sections, 22 elements', delay: 400 },
      { text: '● Resolving global classes...', delay: 800 },
      { text: '  ├─ section--l → acss_import_section__l', delay: 350 },
      { text: '  ├─ bg--primary-dark → acss_import_bg__primary_dark', delay: 300 },
      { text: '  └─ 6 more classes resolved', delay: 400 },
      { text: '● Snapshot created: snap_20260225_093015', delay: 500 },
      { text: '● Pushing to page 1460...', delay: 400 },
      { text: '✓ 22 elements pushed to Homepage', delay: 400 },
    ],
  },
  media: {
    command: 'bricks media upload ./photos/*.jpg',
    lines: [
      { text: '● Uploading 6 images...', delay: 700 },
      { text: '  ├─ sunset-1.jpg → ID 2041', delay: 200 },
      { text: '  ├─ sunset-2.jpg → ID 2042', delay: 180 },
      { text: '  ├─ portrait-1.jpg → ID 2043', delay: 180 },
      { text: '  ├─ portrait-2.jpg → ID 2044', delay: 180 },
      { text: '  ├─ landscape-1.jpg → ID 2045', delay: 180 },
      { text: '  └─ landscape-2.jpg → ID 2046', delay: 200 },
      { text: '✓ 6 images uploaded to media library', delay: 400 },
      { text: '✓ Image IDs: 2041-2046', delay: 300 },
    ],
  },
};

const demoLabels: Record<DemoId, string> = {
  content: 'Content orchestration',
  docs: 'HTML to Bricks',
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
    const timeouts: ReturnType<typeof setTimeout>[] = [];

    const delay = (ms: number) =>
      new Promise<void>((resolve) => {
        const id = setTimeout(resolve, ms);
        timeouts.push(id);
      });

    const run = async () => {
      for (let i = 0; i <= config.command.length; i++) {
        if (cancelRef.current) return;
        setTypedText(config.command.slice(0, i));
        await delay(18);
      }
      await delay(400);
      if (cancelRef.current) return;
      setPhase('running');

      for (let i = 0; i < config.lines.length; i++) {
        await delay(config.lines[i].delay);
        if (cancelRef.current) return;
        setVisibleLines(i + 1);
      }
      await delay(400);
      if (cancelRef.current) return;
      setPhase('done');
    };
    run();
    return () => {
      cancelRef.current = true;
      timeouts.forEach(clearTimeout);
    };
  }, [demoId]);

  const getColor = (text: string) => {
    if (text.startsWith('✓')) return 'text-accent-green font-medium';
    if (text.startsWith('●')) return 'text-accent-yellow';
    return 'text-ui-muted';
  };

  return (
    <div className="p-5 font-mono text-xs leading-relaxed h-[300px] overflow-y-auto">
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

function GuiContentDemo() {
  return (
    <div className="flex flex-col min-h-[300px] p-4">
      <div className="glass-input rounded-lg p-2.5 flex items-center gap-2 flex-wrap text-sm mb-4">
        <span className="text-ui-fg text-xs">Add</span>
        <span className="inline-flex items-center px-2 py-0.5 rounded bg-accent-yellow/15 border border-accent-yellow/25 text-accent-yellow text-[11px] font-mono font-medium">@template:testimonials</span>
        <span className="text-ui-fg text-xs">to</span>
        <span className="inline-flex items-center px-2 py-0.5 rounded bg-accent-yellow/15 border border-accent-yellow/25 text-accent-yellow text-[11px] font-mono font-medium">@page:Homepage</span>
        <span className="text-ui-fg text-xs">after the hero</span>
      </div>
      <div className="text-[9px] uppercase tracking-[0.15em] text-ui-subtle font-medium mb-2">Section Preview</div>
      <div className="flex-1 space-y-2 mb-4">
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[var(--white-glass)] border border-subtle opacity-50">
          <i className="ph ph-layout text-ui-muted text-base" aria-hidden="true"></i>
          <div>
            <div className="text-xs text-ui-muted font-medium">Hero Section</div>
            <div className="text-[10px] text-ui-subtle">Existing — headline + CTA</div>
          </div>
        </div>
        <div className="flex items-center gap-1 justify-center text-accent-yellow text-[10px]">
          <i className="ph ph-arrow-down text-sm" aria-hidden="true"></i>
          <span className="font-medium">Inserting here</span>
          <i className="ph ph-arrow-down text-sm" aria-hidden="true"></i>
        </div>
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-accent-yellow/10 border border-accent-yellow/25">
          <i className="ph ph-quotes text-accent-yellow text-base" aria-hidden="true"></i>
          <div>
            <div className="text-xs text-accent-yellow font-medium">Testimonials</div>
            <div className="text-[10px] text-ui-muted">3-card grid — styled to match page</div>
          </div>
          <span className="ml-auto text-accent-green text-[10px] font-medium">New</span>
        </div>
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[var(--white-glass)] border border-subtle opacity-50">
          <i className="ph ph-squares-four text-ui-muted text-base" aria-hidden="true"></i>
          <div>
            <div className="text-xs text-ui-muted font-medium">Features Grid</div>
            <div className="text-[10px] text-ui-subtle">Existing — 3 columns with icons</div>
          </div>
        </div>
      </div>
      <button className="self-end px-4 py-2 rounded-lg bg-accent-yellow text-black text-xs font-semibold spring-btn shadow-[var(--shadow-glow)]">
        Insert Section
      </button>
    </div>
  );
}

function GuiDocsDemo() {
  return (
    <div className="flex flex-col min-h-[300px] p-4">
      <div className="flex items-center gap-3 p-4 rounded-lg border border-dashed border-subtle bg-[var(--white-glass)] mb-4">
        <div className="w-10 h-10 rounded-lg bg-red-500/20 border border-red-500/30 flex items-center justify-center text-red-400 text-lg">
          <i className="ph ph-file-pdf" aria-hidden="true"></i>
        </div>
        <div>
          <div className="text-sm text-ui-fg font-medium">product-brief.pdf</div>
          <div className="text-[10px] text-ui-muted">2.4 KB &mdash; Uploaded</div>
        </div>
        <span className="ml-auto text-accent-green text-xs">{'\u2713'} Parsed</span>
      </div>
      <div className="text-[9px] uppercase tracking-[0.15em] text-ui-subtle font-medium mb-2">Generated Structure</div>
      <div className="flex-1 space-y-2 mb-4">
        {[
          { icon: 'ph-layout', label: 'Hero Section', desc: 'Headline + CTA button' },
          { icon: 'ph-squares-four', label: 'Feature Grid', desc: '3 columns with icons' },
          { icon: 'ph-currency-dollar', label: 'Pricing Table', desc: '3 tiers: Basic, Pro, Enterprise' },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[var(--white-glass)] border border-subtle">
            <i className={`ph ${item.icon} text-accent-yellow text-base`} aria-hidden="true"></i>
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
  const photos = [
    'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=120&h=120&fit=crop',
    'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=120&h=120&fit=crop',
    'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=120&h=120&fit=crop',
    'https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?w=120&h=120&fit=crop',
    'https://images.unsplash.com/photo-1433086966358-54859d0ed716?w=120&h=120&fit=crop',
    'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=120&h=120&fit=crop',
  ];
  const galleryPhotos = [
    'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=160&h=100&fit=crop',
    'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=160&h=100&fit=crop',
    'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=160&h=100&fit=crop',
    'https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?w=160&h=100&fit=crop',
    'https://images.unsplash.com/photo-1433086966358-54859d0ed716?w=160&h=100&fit=crop',
    'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=160&h=100&fit=crop',
  ];
  return (
    <div className="flex flex-col min-h-[300px] p-4">
      <div className="glass-input rounded-lg p-2.5 flex items-center gap-2 flex-wrap text-sm mb-4">
        <span className="text-ui-fg text-xs">Build gallery on</span>
        <span className="inline-flex items-center px-2 py-0.5 rounded bg-accent-yellow/15 border border-accent-yellow/25 text-accent-yellow text-[11px] font-mono font-medium">@page:Gallery</span>
      </div>
      <div className="text-[9px] uppercase tracking-[0.15em] text-ui-subtle font-medium mb-2">Uploaded Images</div>
      <div className="grid grid-cols-6 gap-2 mb-4">
        {photos.map((src, i) => (
          <img key={i} src={src} alt="" width="120" height="120" loading="lazy" decoding="async" className="aspect-square rounded-lg border border-subtle object-cover" />
        ))}
      </div>
      <div className="text-[9px] uppercase tracking-[0.15em] text-ui-subtle font-medium mb-2">Gallery Preview</div>
      <div className="grid grid-cols-3 gap-1.5 flex-1 mb-4">
        {galleryPhotos.map((src, i) => (
          <img key={i} src={src} alt="" width="160" height="100" loading="lazy" decoding="async" className="rounded-md border border-subtle object-cover w-full" style={{ minHeight: '48px' }} />
        ))}
      </div>
      <button className="self-end px-4 py-2 rounded-lg bg-accent-yellow text-black text-xs font-semibold spring-btn shadow-[var(--shadow-glow)]">
        Build Gallery
      </button>
    </div>
  );
}

const guiComponents: Record<DemoId, React.ReactNode> = {
  content: <GuiContentDemo />,
  docs: <GuiDocsDemo />,
  media: <GuiMediaDemo />,
};

export default function InteractiveDemo() {
  const [view, setView] = useState<ViewMode>('gui');
  const [activeDemo, setActiveDemo] = useState<DemoId>('content');

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
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-[color,background-color,border-color] ${
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
        <AnimatePresence initial={false}>
          <motion.div key={`${activeDemo}-${view}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, position: 'absolute' as const, inset: 0 }} transition={{ duration: 0.15 }} className="relative z-10">
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
