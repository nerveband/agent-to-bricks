import { useRef, useEffect } from 'react';

function FeatureList({ items }: { items: string[] }) {
  return (
    <ul className="mt-6 space-y-3">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-3 text-sm text-ui-muted">
          <span className="text-accent-yellow mt-0.5 shrink-0">&#10003;</span>
          {item}
        </li>
      ))}
    </ul>
  );
}

function CliMockup() {
  return (
    <div className="glass-base rounded-xl border border-subtle overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-subtle white-glass">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-[#FF5F56]" />
          <div className="w-2.5 h-2.5 rounded-full bg-[#FFBD2E]" />
          <div className="w-2.5 h-2.5 rounded-full bg-[#27C93F]" />
        </div>
        <span className="text-[10px] text-ui-subtle ml-2 font-mono">Terminal</span>
      </div>
      <div className="p-5 font-mono text-xs leading-relaxed">
        <div className="text-ui-fg">
          <span className="text-accent-green font-bold">$</span> bricks search --type heading --all-pages --json \
        </div>
        <div className="text-ui-fg ml-4">| bricks modify --style &quot;color: var(--primary)&quot; \</div>
        <div className="text-ui-fg ml-4">| bricks push --all</div>
        <div className="mt-3 space-y-1">
          <div className="text-accent-yellow">&#9679; Searching... found 47 headings</div>
          <div className="text-accent-yellow">&#9679; Modifying... applied to 47 elements</div>
          <div className="text-accent-yellow">&#9679; Pushing... 20 pages updated</div>
          <div className="text-accent-green font-medium mt-1">&#10003; Pipeline complete. 3 snapshots saved.</div>
        </div>
      </div>
    </div>
  );
}

function GuiMockup() {
  return (
    <div className="glass-base rounded-xl border border-subtle overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-subtle white-glass">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-[#FF5F56]" />
          <div className="w-2.5 h-2.5 rounded-full bg-[#FFBD2E]" />
          <div className="w-2.5 h-2.5 rounded-full bg-[#27C93F]" />
        </div>
        <span className="text-[10px] text-ui-subtle ml-2 font-mono">Agent to Bricks &mdash; GUI</span>
      </div>
      <div className="flex min-h-[280px]">
        {/* Sidebar */}
        <div className="w-[140px] shrink-0 border-r border-subtle p-3 flex flex-col gap-1 bg-black/20">
          <div className="text-[9px] uppercase tracking-[0.15em] text-ui-subtle font-medium mb-2">Resources</div>
          {['Pages', 'Colors', 'Styles'].map((tab, i) => (
            <button
              key={tab}
              className={`text-left text-xs px-2 py-1.5 rounded-md transition-colors ${
                i === 0 ? 'bg-[rgba(250,204,21,0.1)] text-accent-yellow font-medium border border-[rgba(250,204,21,0.2)]' : 'text-ui-muted hover:text-ui-fg'
              }`}
            >
              {tab}
            </button>
          ))}
          <div className="mt-4 text-[9px] uppercase tracking-[0.15em] text-ui-subtle font-medium mb-2">Templates</div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] px-2 py-1 rounded bg-[rgba(250,204,21,0.05)] border border-[rgba(250,204,21,0.1)] text-accent-yellow truncate">Bulk Style Update</span>
            <span className="text-[10px] px-2 py-1 rounded bg-[var(--white-glass)] border border-subtle text-ui-muted truncate">Gallery Builder</span>
          </div>
        </div>

        {/* Main area */}
        <div className="flex-1 flex flex-col">
          {/* Prompt input */}
          <div className="p-4 border-b border-subtle">
            <div className="glass-input rounded-lg p-3 flex items-center gap-2 flex-wrap text-sm">
              <span className="text-ui-fg">Apply style to</span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[rgba(250,204,21,0.15)] border border-[rgba(250,204,21,0.25)] text-accent-yellow text-xs font-mono font-medium">
                @page:Homepage
              </span>
              <span className="text-ui-fg">headings</span>
              <span className="ml-auto">
                <span className="w-6 h-6 rounded bg-accent-yellow flex items-center justify-center text-black text-xs">&uarr;</span>
              </span>
            </div>
            {/* Autocomplete dropdown */}
            <div className="mt-1 glass-base rounded-lg border border-subtle p-2 flex flex-col gap-0.5">
              <div className="px-2 py-1.5 rounded bg-[rgba(250,204,21,0.1)] text-xs text-accent-yellow font-mono">@page:About</div>
              <div className="px-2 py-1.5 rounded text-xs text-ui-muted font-mono hover:bg-[var(--white-glass)]">@page:Services</div>
              <div className="px-2 py-1.5 rounded text-xs text-ui-muted font-mono hover:bg-[var(--white-glass)]">@page:Contact</div>
            </div>
          </div>

          {/* Color swatches */}
          <div className="px-4 py-3 border-b border-subtle">
            <div className="text-[9px] uppercase tracking-[0.15em] text-ui-subtle font-medium mb-2">Site Colors</div>
            <div className="flex gap-2">
              {[
                { name: 'primary', color: '#2563EB' },
                { name: 'secondary', color: '#7C3AED' },
                { name: 'accent', color: '#FACC15' },
                { name: 'neutral', color: '#6B7280' },
              ].map((c) => (
                <div key={c.name} className="flex items-center gap-1.5">
                  <div className="w-4 h-4 rounded-full border border-subtle" style={{ background: c.color }} />
                  <span className="text-[10px] text-ui-muted">{c.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Status bar */}
          <div className="mt-auto px-4 py-2 border-t border-subtle flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-accent-green" />
            <span className="text-[10px] font-mono text-ui-muted">Connected: mysite.com</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function TemplateMockup() {
  const templates = [
    { name: 'SaaS Hero', gradient: 'from-blue-600 to-purple-600' },
    { name: 'Photo Gallery', gradient: 'from-amber-500 to-orange-600' },
    { name: 'Pricing Table', gradient: 'from-emerald-500 to-teal-600' },
  ];

  return (
    <div className="glass-base rounded-xl border border-subtle overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-subtle white-glass">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-[#FF5F56]" />
          <div className="w-2.5 h-2.5 rounded-full bg-[#FFBD2E]" />
          <div className="w-2.5 h-2.5 rounded-full bg-[#27C93F]" />
        </div>
        <span className="text-[10px] text-ui-subtle ml-2 font-mono">Template Browser</span>
      </div>
      <div className="p-4">
        <div className="glass-input rounded-lg px-3 py-2 text-xs text-ui-subtle mb-4">Search templates...</div>
        <div className="grid grid-cols-3 gap-3">
          {templates.map((t) => (
            <div key={t.name} className="flex flex-col gap-2">
              <div className={`h-20 rounded-lg bg-gradient-to-br ${t.gradient} opacity-80`} />
              <div className="text-xs font-medium text-ui-fg">{t.name}</div>
              <button className="text-[10px] px-2 py-1 rounded bg-[rgba(250,204,21,0.1)] text-accent-yellow border border-[rgba(250,204,21,0.2)] hover:bg-[rgba(250,204,21,0.2)] transition-colors">
                Use Template
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const pillars = [
  {
    label: 'CLI',
    title: 'Your workflow, your way',
    description: 'Chain commands together, pipe into other tools, automate with cron. Works with any AI agent \u2014 Claude Code, Codex, or your own.',
    features: [
      'Pipe and chain commands like Unix tools',
      'Bring any AI agent \u2014 Claude, Codex, OpenCode',
      'Automate with cron, CI/CD, or scripts',
      'Works alongside your existing dev tools',
    ],
    Mockup: CliMockup,
  },
  {
    label: 'GUI',
    title: 'Everything at your fingertips',
    description: "Tab directly into your site\u2019s pages, colors, styles, and images \u2014 all inline in the prompt. No more switching tabs to copy values.",
    features: [
      '@mention pages, colors, components inline',
      'Save and reuse prompt templates',
      'Multi-site management \u2014 switch instantly',
      'Multiple concurrent sessions',
      'Visual preview before pushing changes',
    ],
    Mockup: GuiMockup,
  },
  {
    label: 'Templates',
    title: 'Build your design system',
    description: 'Download starter templates, create your own from existing pages, or generate new ones with AI. Style profiles keep your brand consistent.',
    features: [
      'Download, create, or AI-generate templates',
      'Style profiles enforce brand consistency',
      'Export and share with your team',
      'Apply templates across multiple pages',
    ],
    Mockup: TemplateMockup,
  },
];

export default function FeaturePillars() {
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add('active');
        });
      },
      { threshold: 0.1 }
    );
    sectionRef.current?.querySelectorAll('.reveal').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={sectionRef} className="py-20 px-4 sm:px-6 lg:px-8 w-full max-w-6xl mx-auto" id="features">
      {pillars.map((pillar, idx) => (
        <div
          key={pillar.label}
          className={`section-spotlight reveal flex flex-col lg:flex-row items-center gap-12 ${
            idx % 2 === 1 ? 'lg:flex-row-reverse' : ''
          } ${idx > 0 ? 'mt-24' : ''}`}
        >
          {/* Text side */}
          <div className="flex-1 min-w-0">
            <span className="text-xs font-mono font-semibold uppercase tracking-[0.2em] text-accent-yellow">
              {pillar.label}
            </span>
            <h3
              className="text-2xl sm:text-3xl font-bold text-ui-fg mt-2"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              {pillar.title}
            </h3>
            <p className="text-ui-muted mt-3 leading-relaxed">{pillar.description}</p>
            <FeatureList items={pillar.features} />
          </div>

          {/* Mockup side */}
          <div className="flex-1 min-w-0 w-full">
            <pillar.Mockup />
          </div>
        </div>
      ))}
    </section>
  );
}
