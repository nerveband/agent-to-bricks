import { useRef, useEffect } from 'react';

const rows = [
  { feature: 'AI Provider', other: 'Locked to their API', atb: 'Bring your own' },
  { feature: 'Pricing', other: 'Monthly subscription', atb: 'Free & open source' },
  { feature: 'CSS Output', other: 'Inline styles, code soup', atb: 'Respects your classes and ACSS' },
  { feature: 'Workflow', other: 'Their interface only', atb: 'CLI, GUI, or API' },
  { feature: 'Safety', other: 'Hope nothing breaks', atb: 'Snapshots on every push, one-click rollback' },
  { feature: 'Automation', other: 'Not possible', atb: 'Chain commands, cron, CI/CD' },
  { feature: 'Templates', other: 'Their templates', atb: 'Create, import, generate your own' },
  { feature: 'Data Privacy', other: 'Sent to their servers', atb: 'Your machine, your keys' },
  { feature: 'Tool Integration', other: 'Standalone plugin only', atb: 'Orchestrate with WP-CLI, email, docs, and more' },
];

export default function Differentiator() {
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add('active');
        });
      },
      { threshold: 0.15 }
    );
    sectionRef.current?.querySelectorAll('.reveal, .stagger-children').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={sectionRef} className="section-spotlight py-20 px-4 sm:px-6 lg:px-8 w-full max-w-5xl mx-auto">
      <div className="text-center reveal mb-12">
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-ui-fg" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          Not another AI WordPress plugin.
        </h2>
        <p className="mt-4 text-lg text-ui-muted">See how Agent to Bricks is different.</p>
      </div>

      <div className="glass-base rounded-2xl border border-subtle overflow-hidden reveal">
        {/* Header row */}
        <div className="grid grid-cols-3 border-b border-subtle">
          <div className="p-4 text-xs font-semibold uppercase tracking-[0.15em] text-ui-subtle">Feature</div>
          <div className="p-4 text-xs font-semibold uppercase tracking-[0.15em] text-ui-subtle border-l border-subtle">Other AI Tools</div>
          <div className="p-4 text-xs font-semibold uppercase tracking-[0.15em] text-accent-yellow border-l border-subtle">Agent to Bricks</div>
        </div>

        {/* Data rows */}
        <div className="stagger-children">
          {rows.map((row, i) => (
            <div key={row.feature} className={`grid grid-cols-3 ${i < rows.length - 1 ? 'border-b border-subtle' : ''}`}>
              <div className="p-4 text-sm font-medium text-ui-fg flex items-center gap-2">
                {row.feature}
              </div>
              <div className="p-4 text-sm text-red-400/60 border-l border-subtle flex items-center gap-2">
                <span className="text-red-400/40">{'\u2717'}</span>
                {row.other}
              </div>
              <div className="p-4 text-sm text-accent-green border-l border-subtle flex items-center gap-2">
                <span className="text-accent-green">{'\u2713'}</span>
                {row.atb}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
