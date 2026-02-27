import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Scenario {
  label: string;
  prompt: string;
  lines: { text: string; delay: number }[];
}

const scenarios: Scenario[] = [
  {
    label: 'Client requests',
    prompt: 'Check my email for the latest client changes and implement them on the site',
    lines: [
      { text: '\u25cf Reading inbox via gmail-cli...', delay: 800 },
      { text: '  Found email from client: 6 requested changes', delay: 400 },
      { text: '\u25cf Pulling affected pages via bricks cli...', delay: 600 },
      { text: '  \u251c\u2500 Page 42 (Homepage): loaded', delay: 250 },
      { text: '  \u251c\u2500 Page 58 (About): loaded', delay: 250 },
      { text: '  \u251c\u2500 Page 71 (Services): loaded', delay: 250 },
      { text: '\u25cf Implementing changes across 3 pages...', delay: 500 },
      { text: '  \u251c\u2500 Homepage: updated hero headline + CTA text', delay: 300 },
      { text: '  \u251c\u2500 About: swapped team photo, updated bio', delay: 300 },
      { text: '  \u2514\u2500 Services: added new pricing tier', delay: 300 },
      { text: '\u2713 All 6 changes applied. Snapshots saved for rollback.', delay: 500 },
    ],
  },
  {
    label: 'Content placement',
    prompt: 'Take these 20 testimonials and place them across the site, styled to match each page',
    lines: [
      { text: '\u25cf Parsing 20 testimonials from input...', delay: 800 },
      { text: '  Categorized: 8 product, 6 service, 6 general', delay: 400 },
      { text: '\u25cf Analyzing page layouts for placement...', delay: 600 },
      { text: '  \u251c\u2500 Homepage: 3-card grid after hero', delay: 300 },
      { text: '  \u251c\u2500 Services: sidebar quotes per service', delay: 250 },
      { text: '  \u251c\u2500 About: full-width carousel', delay: 250 },
      { text: '  \u2514\u2500 Pricing: inline social proof badges', delay: 250 },
      { text: '\u25cf Inserting testimonials styled to match each page...', delay: 500 },
      { text: '  Resolved 12 ACSS classes for consistent styling', delay: 300 },
      { text: '\u2713 20 testimonials placed across 4 pages. Snapshots saved.', delay: 500 },
    ],
  },
  {
    label: 'Page migration',
    prompt: 'Migrate the starter theme homepage to Bricks on my staging site, matching the design',
    lines: [
      { text: '\u25cf Fetching source page content...', delay: 800 },
      { text: '  Parsed: 8 sections, 42 elements', delay: 400 },
      { text: '\u25cf Mapping to Bricks components...', delay: 600 },
      { text: '  \u251c\u2500 Hero \u2192 bricks-section + heading + buttons', delay: 300 },
      { text: '  \u251c\u2500 Features \u2192 3-column grid with icons', delay: 250 },
      { text: '  \u251c\u2500 Testimonials \u2192 carousel with cards', delay: 250 },
      { text: '  \u2514\u2500 ...5 more sections mapped', delay: 250 },
      { text: '\u25cf Resolving classes to ACSS equivalents...', delay: 500 },
      { text: '\u25cf Uploading 6 images to media library...', delay: 400 },
      { text: '\u2713 42 elements pushed to staging. Design match verified.', delay: 500 },
    ],
  },
];

export default function WhatIfSection() {
  const [activeIdx, setActiveIdx] = useState(0);
  const [typedText, setTypedText] = useState('');
  const [visibleLines, setVisibleLines] = useState(0);
  const [phase, setPhase] = useState<'typing' | 'running' | 'done'>('typing');
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef(false);

  // Visibility observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true);
      },
      { threshold: 0.2 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  // Run animation for active scenario
  useEffect(() => {
    if (!isVisible) return;
    cancelRef.current = false;
    const scenario = scenarios[activeIdx];
    const timeouts: ReturnType<typeof setTimeout>[] = [];

    const delay = (ms: number) =>
      new Promise<void>((resolve) => {
        const id = setTimeout(resolve, ms);
        timeouts.push(id);
      });

    const run = async () => {
      setTypedText('');
      setVisibleLines(0);
      setPhase('typing');

      // Type the prompt
      for (let i = 0; i <= scenario.prompt.length; i++) {
        if (cancelRef.current) return;
        setTypedText(scenario.prompt.slice(0, i));
        await delay(25);
      }

      await delay(400);
      if (cancelRef.current) return;
      setPhase('running');

      // Show output lines sequentially
      for (let i = 0; i < scenario.lines.length; i++) {
        await delay(scenario.lines[i].delay);
        if (cancelRef.current) return;
        setVisibleLines(i + 1);
      }

      await delay(400);
      if (cancelRef.current) return;
      setPhase('done');

      // Auto-advance after done
      await delay(3000);
      if (cancelRef.current) return;
      setActiveIdx((prev) => (prev + 1) % scenarios.length);
    };

    run();
    return () => {
      cancelRef.current = true;
      timeouts.forEach(clearTimeout);
    };
  }, [activeIdx, isVisible]);

  // Reveal animation
  useEffect(() => {
    if (!sectionRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add('active');
        });
      },
      { threshold: 0.15 }
    );
    sectionRef.current.querySelectorAll('.reveal').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const getLineColor = (text: string) => {
    if (text.startsWith('\u2713')) return 'text-accent-green font-medium';
    if (text.startsWith('\u25cf')) return 'text-accent-yellow';
    if (text.includes('\u251c\u2500') || text.includes('\u2514\u2500')) return 'text-ui-muted';
    return 'text-ui-fg opacity-80';
  };

  return (
    <section
      ref={sectionRef}
      className="section-spotlight py-20 px-4 sm:px-6 lg:px-8 w-full max-w-5xl mx-auto"
      id="how-it-works"
    >
      <div className="text-center reveal mb-12">
        <h2
          className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-ui-fg"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          What if one command could{' '}
          <span className="text-accent-yellow drop-shadow-[0_0_15px_rgba(250,204,21,0.4)]">
            do what takes an hour?
          </span>
        </h2>
      </div>

      {/* Terminal mockup */}
      <div className="glass-base relative overflow-hidden rounded-2xl border border-subtle shadow-2xl">
        <div className="noise rounded-2xl" />

        {/* Title bar */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-subtle white-glass relative z-10">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-[#FF5F56] border border-[#E0443E]" />
            <div className="w-3 h-3 rounded-full bg-[#FFBD2E] border border-[#DEA123]" />
            <div className="w-3 h-3 rounded-full bg-[#27C93F] border border-[#1AAB29]" />
          </div>
          <span className="text-xs text-ui-muted ml-2 font-mono">Agent to Bricks</span>
        </div>

        {/* Scenario tabs */}
        <div className="flex gap-1 px-4 py-2 border-b border-subtle relative z-10">
          {scenarios.map((s, i) => (
            <button
              key={s.label}
              onClick={() => {
                cancelRef.current = true;
                setTimeout(() => setActiveIdx(i), 10);
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-[color,background-color,border-color] ${
                activeIdx === i
                  ? 'text-accent-yellow bg-accent-yellow/10 border border-accent-yellow/20'
                  : 'text-ui-muted hover:text-ui-fg'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Terminal content */}
        <div className="relative z-10 p-6 h-[340px] overflow-y-auto font-mono text-xs leading-relaxed">
          <div className="absolute inset-0 scanlines opacity-15 pointer-events-none z-0" />
          <AnimatePresence initial={false}>
            <motion.div
              key={activeIdx}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, position: 'absolute', inset: 0 }}
              transition={{ duration: 0.15 }}
              className="relative z-10"
            >
              {/* Prompt line */}
              <div className="flex items-start gap-2 mb-3">
                <span className="text-accent-yellow font-bold drop-shadow-[0_0_4px_rgba(250,204,21,0.3)]">
                  {'>'}
                </span>
                <span className="text-ui-fg">
                  {phase === 'typing' ? typedText : scenarios[activeIdx].prompt}
                  {phase === 'typing' && (
                    <motion.span
                      className="inline-block w-1.5 h-3.5 ml-0.5 align-middle bg-accent-yellow shadow-[var(--shadow-glow)]"
                      animate={{ opacity: [1, 0] }}
                      transition={{ duration: 0.5, repeat: Infinity }}
                    />
                  )}
                </span>
              </div>

              {/* Output lines */}
              {phase !== 'typing' && (
                <div className="space-y-0.5 mt-2">
                  {scenarios[activeIdx].lines.slice(0, visibleLines).map((line, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.15 }}
                      className={getLineColor(line.text)}
                    >
                      {line.text}
                    </motion.div>
                  ))}
                </div>
              )}

              {/* Done cursor */}
              {phase === 'done' && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mt-3 flex items-center gap-2"
                >
                  <span className="text-accent-yellow font-bold">{'>'}</span>
                  <motion.span
                    className="inline-block w-1.5 h-3.5 bg-accent-yellow shadow-[var(--shadow-glow)]"
                    animate={{ opacity: [1, 0] }}
                    transition={{ duration: 0.6, repeat: Infinity }}
                  />
                </motion.div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Progress dots */}
        <div className="flex justify-center gap-2 pb-4 relative z-10">
          {scenarios.map((_, i) => (
            <div
              key={i}
              className={`w-1.5 h-1.5 rounded-full transition-[background-color,box-shadow] ${
                activeIdx === i ? 'bg-accent-yellow shadow-[var(--shadow-glow)]' : 'bg-ui-subtle'
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
