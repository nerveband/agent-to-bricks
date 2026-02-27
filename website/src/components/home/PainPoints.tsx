import { useRef, useEffect } from 'react';

const painPoints = [
  {
    icon: 'ph ph-arrows-clockwise',
    title: 'Bulk updates are manual',
    desc: 'Changing heading colors across 20 pages? Open each one. Find the element. Edit. Save. Repeat. That\'s an afternoon gone.',
  },
  {
    icon: 'ph ph-upload-simple',
    title: 'Media upload is tedious',
    desc: 'Drag files from your desktop to WordPress media, then manually insert them into elements one by one. Every. Single. Time.',
  },
  {
    icon: 'ph ph-lock-key',
    title: 'Other AI tools lock you in',
    desc: 'Existing AI plugins charge monthly, force their templates, and don\'t respect your existing styles. You\'re locked into their way of doing things.',
  },
  {
    icon: 'ph ph-columns',
    title: 'Styles stay siloed',
    desc: 'Want to copy a style from one page to another? Screenshot it, recreate it manually. There\'s no "apply this everywhere."',
  },
];

export default function PainPoints() {
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('active');
          }
        });
      },
      { threshold: 0.15 }
    );

    const section = sectionRef.current;
    if (section) {
      section.querySelectorAll('.reveal, .stagger-children').forEach((el) => {
        observer.observe(el);
      });
    }

    return () => observer.disconnect();
  }, []);

  return (
    <section ref={sectionRef} className="section-spotlight py-20 px-4 sm:px-6 lg:px-8 w-full max-w-6xl mx-auto">
      <div className="text-center reveal">
        <h2
          className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-ui-fg"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          Bricks Builder is powerful.
          <br />
          <span className="text-ui-muted">Managing it at scale isn't.</span>
        </h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-12 stagger-children">
        {painPoints.map((point) => (
          <div
            key={point.title}
            className="glass-base tilt-card p-6 rounded-xl border border-subtle"
          >
            <i className={`${point.icon} text-2xl text-accent-yellow`} aria-hidden="true" />
            <h3
              className="font-semibold text-lg text-ui-fg mt-4"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              {point.title}
            </h3>
            <p className="text-sm text-ui-muted mt-2 leading-relaxed">
              {point.desc}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
