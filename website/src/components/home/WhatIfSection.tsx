import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Scenario {
  label: string;
  prompt: string;
  lines: { text: string; delay: number }[];
}

const scenarios: Scenario[] = [
  {
    label: 'Site-wide rebrand',
    prompt: 'Rebrand the site: swap all colors, fonts, and button styles to the new guidelines',
    lines: [
      { text: '\u25cf Scanning 35 pages for styled elements...', delay: 800 },
      { text: '  Found 214 elements across 35 pages', delay: 400 },
      { text: '\u25cf Updating colors: #1a365d \u2192 #2563eb...', delay: 600 },
      { text: '  \u251c\u2500 Homepage: 24 elements updated', delay: 300 },
      { text: '  \u251c\u2500 About: 18 elements updated', delay: 250 },
      { text: '  \u251c\u2500 Services: 31 elements updated', delay: 250 },
      { text: '  \u251c\u2500 Pricing: 22 elements updated', delay: 250 },
      { text: '  \u2514\u2500 ...31 more pages', delay: 300 },
      { text: '\u25cf Swapping font: Inter \u2192 Space Grotesk...', delay: 500 },
      { text: '  Applied to 142 text elements', delay: 300 },
      { text: '\u2713 214 elements rebranded across 35 pages. Snapshots saved.', delay: 500 },
    ],
  },
  {
    label: 'Landing page',
    prompt: 'Build a full landing page: hero, features, pricing table, testimonials, FAQ, and CTA',
    lines: [
      { text: '\u25cf Pulling design tokens and ACSS classes...', delay: 800 },
      { text: '  Loaded 186 utility classes, 24 design tokens', delay: 400 },
      { text: '\u25cf Converting 6 sections to Bricks elements...', delay: 600 },
      { text: '  \u251c\u2500 Hero: headline, subtext, 2 CTA buttons', delay: 300 },
      { text: '  \u251c\u2500 Features: 3-column grid with icons', delay: 250 },
      { text: '  \u251c\u2500 Pricing: 3-tier comparison table (12 rows)', delay: 300 },
      { text: '  \u251c\u2500 Testimonials: carousel with 4 reviews', delay: 250 },
      { text: '  \u251c\u2500 FAQ: accordion with 8 items', delay: 250 },
      { text: '  \u2514\u2500 CTA: banner with email capture', delay: 250 },
      { text: '\u25cf Resolved 47/47 classes to global IDs', delay: 400 },
      { text: '\u2713 Pushed 68 elements to page 84. Snapshot saved.', delay: 500 },
    ],
  },
  {
    label: 'Bulk update',
    prompt: 'Replace the testimonials section on all 20 client pages with the new 3-card layout',
    lines: [
      { text: '\u25cf Searching for testimonial sections...', delay: 800 },
      { text: '  Found testimonials on 20 pages', delay: 400 },
      { text: '\u25cf Loading template: testimonials-3-card...', delay: 500 },
      { text: '\u25cf Replacing sections with snapshots...', delay: 600 },
      { text: '  \u251c\u2500 Page 42 (Acme Corp): swapped, 12 elements', delay: 250 },
      { text: '  \u251c\u2500 Page 58 (Archway Digital): swapped, 12 elements', delay: 250 },
      { text: '  \u251c\u2500 Page 71 (Beacon Labs): swapped, 12 elements', delay: 250 },
      { text: '  \u2514\u2500 ...17 more pages', delay: 300 },
      { text: '\u2713 20 pages updated. 20 snapshots saved for rollback.', delay: 500 },
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
