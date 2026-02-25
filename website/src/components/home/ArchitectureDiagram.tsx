import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const nodes = [
  { id: 'wp', label: 'WordPress + Bricks', icon: '🌐', x: 0 },
  { id: 'plugin', label: 'Plugin', icon: '🧩', x: 1 },
  { id: 'cli', label: 'CLI', icon: '⌨️', x: 2 },
  { id: 'gui', label: 'GUI', icon: '🖥️', x: 3 },
  { id: 'agent', label: 'Your AI Agent', icon: '✦', x: 4 },
];

const connections = [
  { from: 'wp', to: 'plugin' },
  { from: 'plugin', to: 'cli' },
  { from: 'cli', to: 'gui' },
  { from: 'cli', to: 'agent' },
];

const steps = [
  {
    title: 'Install the plugin',
    highlight: ['wp', 'plugin'],
    activeConnections: ['wp-plugin'],
    caption:
      'A WordPress plugin connects your Bricks site to the outside world via a secure REST API.',
  },
  {
    title: 'Connect the CLI',
    highlight: ['plugin', 'cli'],
    activeConnections: ['plugin-cli'],
    caption:
      'The CLI talks to your plugin. Pull pages, push changes, search elements — all from your terminal.',
  },
  {
    title: 'Open the GUI (or don\'t)',
    highlight: ['cli', 'gui'],
    activeConnections: ['cli-gui'],
    caption:
      'The desktop app wraps the CLI with a visual interface. Or skip it entirely and work in your own terminal.',
  },
  {
    title: 'Bring your AI agent',
    highlight: ['wp', 'plugin', 'cli', 'gui', 'agent'],
    activeConnections: ['wp-plugin', 'plugin-cli', 'cli-gui', 'cli-agent'],
    caption:
      'Point any AI coding agent at your site. It uses the CLI to understand your design system and make changes.',
  },
];

export default function ArchitectureDiagram() {
  const [activeStep, setActiveStep] = useState(0);
  const [autoPlay, setAutoPlay] = useState(true);

  useEffect(() => {
    if (!autoPlay) return;
    const timer = setInterval(() => {
      setActiveStep((s) => (s + 1) % steps.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [autoPlay]);

  const step = steps[activeStep];

  const handleStepClick = (i: number) => {
    setActiveStep(i);
    setAutoPlay(false);
  };

  return (
    <div className="space-y-8">
      {/* Diagram */}
      <div className="relative">
        {/* Desktop: horizontal layout */}
        <div className="hidden sm:flex items-center justify-between gap-2 px-4">
          {nodes.map((node, i) => {
            const isActive = step.highlight.includes(node.id);
            return (
              <div key={node.id} className="flex items-center flex-1">
                {/* Node */}
                <motion.div
                  animate={{
                    scale: isActive ? 1.05 : 1,
                    borderColor: isActive ? 'rgba(250, 204, 21, 0.6)' : 'rgba(255, 255, 255, 0.1)',
                  }}
                  transition={{ duration: 0.4 }}
                  className="relative flex flex-col items-center gap-2 rounded-xl border bg-white/[0.03] backdrop-blur-sm px-4 py-4 min-w-[100px] z-10"
                >
                  {isActive && (
                    <motion.div
                      className="absolute inset-0 rounded-xl bg-yellow-400/5"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    />
                  )}
                  <span className="text-2xl">{node.icon}</span>
                  <span
                    className={`text-xs font-medium text-center leading-tight transition-colors duration-300 ${
                      isActive ? 'text-yellow-400' : 'text-gray-500'
                    }`}
                  >
                    {node.label}
                  </span>
                </motion.div>

                {/* Connection line */}
                {i < nodes.length - 1 && (
                  <div className="flex-1 h-px relative mx-1">
                    <div className="absolute inset-0 border-t border-dashed border-white/10" />
                    {/* Active connection overlay */}
                    {(() => {
                      const connKey = `${nodes[i].id}-${nodes[i + 1].id}`;
                      const isConnActive = step.activeConnections.includes(connKey);
                      return isConnActive ? (
                        <motion.div
                          className="absolute inset-0 border-t-2 border-yellow-400/60"
                          initial={{ scaleX: 0 }}
                          animate={{ scaleX: 1 }}
                          transition={{ duration: 0.6, delay: 0.2 }}
                          style={{ transformOrigin: 'left' }}
                        />
                      ) : null;
                    })()}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Mobile: vertical layout */}
        <div className="sm:hidden space-y-3 px-4">
          {nodes.map((node) => {
            const isActive = step.highlight.includes(node.id);
            return (
              <motion.div
                key={node.id}
                animate={{
                  borderColor: isActive ? 'rgba(250, 204, 21, 0.6)' : 'rgba(255, 255, 255, 0.1)',
                }}
                className="flex items-center gap-3 rounded-lg border bg-white/[0.03] px-4 py-3"
              >
                <span className="text-xl">{node.icon}</span>
                <span
                  className={`text-sm font-medium transition-colors duration-300 ${
                    isActive ? 'text-yellow-400' : 'text-gray-500'
                  }`}
                >
                  {node.label}
                </span>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Caption */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeStep}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.3 }}
          className="text-center px-4"
        >
          <p className="text-sm font-semibold text-yellow-400 mb-2">{step.title}</p>
          <p className="text-gray-400 text-sm sm:text-base max-w-xl mx-auto">{step.caption}</p>
        </motion.div>
      </AnimatePresence>

      {/* Step dots */}
      <div className="flex items-center justify-center gap-2">
        {steps.map((_, i) => (
          <button
            key={i}
            onClick={() => handleStepClick(i)}
            className={`w-2 h-2 rounded-full transition-all duration-300 ${
              i === activeStep
                ? 'bg-yellow-400 w-6'
                : 'bg-white/20 hover:bg-white/40'
            }`}
            aria-label={`Step ${i + 1}: ${steps[i].title}`}
          />
        ))}
      </div>
    </div>
  );
}
