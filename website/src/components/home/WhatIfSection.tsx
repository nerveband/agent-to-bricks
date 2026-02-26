import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Scenario {
  label: string;
  prompt: string;
  lines: { text: string; delay: number }[];
}

const scenarios: Scenario[] = [
  {
    label: 'Style update',
    prompt: 'Change all heading colors to brand blue',
    lines: [
      { text: '\u25cf Scanning 20 pages for headings...', delay: 800 },
      { text: '  Found 47 heading elements', delay: 400 },
      { text: '\u25cf Applying color: var(--primary)...', delay: 600 },
      { text: '  \u251c\u2500 Homepage: 8 headings updated', delay: 300 },
      { text: '  \u251c\u2500 About: 6 headings updated', delay: 250 },
      { text: '  \u251c\u2500 Services: 12 headings updated', delay: 250 },
      { text: '  \u2514\u2500 ...11 more pages', delay: 300 },
      { text: '\u2713 47 headings updated. Snapshots saved.', delay: 500 },
    ],
  },
  {
    label: 'Media upload',
    prompt: 'Upload these 12 photos and build a gallery',
    lines: [
      { text: '\u25cf Uploading 12 images...', delay: 800 },
      { text: '  \u251c\u2500 sunset-01.jpg \u2192 ID 2041', delay: 300 },
      { text: '  \u251c\u2500 sunset-02.jpg \u2192 ID 2042', delay: 250 },
      { text: '  \u2514\u2500 ...10 more uploaded', delay: 300 },
      { text: '\u25cf Generating gallery section...', delay: 600 },
      { text: '  \u251c\u2500 Using masonry layout (4 columns)', delay: 300 },
      { text: '  \u2514\u2500 Applying lightbox interaction', delay: 300 },
      { text: '\u2713 Gallery with 12 images live on page.', delay: 500 },
    ],
  },
  {
    label: 'Generate from docs',
    prompt: 'Reference this PDF and build a landing page',
    lines: [
      { text: '\u25cf Reading document: product-brief.pdf', delay: 800 },
      { text: '  \u251c\u2500 Extracted: headline, features, pricing', delay: 400 },
      { text: '  \u251c\u2500 Detected tone: professional, minimal', delay: 350 },
      { text: '\u25cf Generating landing page...', delay: 600 },
      { text: '  \u251c\u2500 Hero with headline + CTA', delay: 300 },
      { text: '  \u251c\u2500 3-column feature grid', delay: 250 },
      { text: '  \u2514\u2500 Pricing table with 3 tiers', delay: 300 },
      { text: '\u2713 Landing page pushed to draft.', delay: 500 },
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

    const run = async () => {
      setTypedText('');
      setVisibleLines(0);
      setPhase('typing');

      // Type the prompt
      for (let i = 0; i <= scenario.prompt.length; i++) {
        if (cancelRef.current) return;
        setTypedText(scenario.prompt.slice(0, i));
        await new Promise((r) => setTimeout(r, 25));
      }

      await new Promise((r) => setTimeout(r, 400));
      if (cancelRef.current) return;
      setPhase('running');

      // Show output lines
      let total = 0;
      for (let i = 0; i < scenario.lines.length; i++) {
        total += scenario.lines[i].delay;
        const lineIdx = i;
        setTimeout(() => {
          if (!cancelRef.current) setVisibleLines(lineIdx + 1);
        }, total);
      }

      setTimeout(() => {
        if (!cancelRef.current) setPhase('done');
      }, total + 400);

      // Auto-advance after done
      setTimeout(() => {
        if (!cancelRef.current) {
          setActiveIdx((prev) => (prev + 1) % scenarios.length);
        }
      }, total + 3000);
    };

    run();
    return () => {
      cancelRef.current = true;
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
          What if you could just{' '}
          <span className="text-accent-yellow drop-shadow-[0_0_15px_rgba(250,204,21,0.4)]">
            talk to your website?
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
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
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
        <div className="relative z-10 p-6 min-h-[280px] font-mono text-xs leading-relaxed">
          <div className="absolute inset-0 scanlines opacity-15 pointer-events-none z-0" />
          <AnimatePresence mode="wait">
            <motion.div
              key={activeIdx}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
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
              className={`w-1.5 h-1.5 rounded-full transition-all ${
                activeIdx === i ? 'bg-accent-yellow shadow-[var(--shadow-glow)]' : 'bg-ui-subtle'
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
