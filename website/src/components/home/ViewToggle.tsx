import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import GuiMockup from './GuiMockup';
import CliMockup from './CliMockup';

export default function ViewToggle() {
  const [view, setView] = useState<'gui' | 'cli'>('gui');

  return (
    <div>
      {/* Toggle switch */}
      <div className="flex justify-center mb-6">
        <div className="inline-flex items-center rounded-lg border border-white/10 bg-white/[0.03] p-1">
          <button
            onClick={() => setView('gui')}
            className={`relative px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
              view === 'gui' ? 'text-gray-900' : 'text-gray-400 hover:text-white'
            }`}
          >
            {view === 'gui' && (
              <motion.div
                layoutId="toggle-bg"
                className="absolute inset-0 bg-yellow-400 rounded-md"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
            <span className="relative z-10">GUI</span>
          </button>
          <button
            onClick={() => setView('cli')}
            className={`relative px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
              view === 'cli' ? 'text-gray-900' : 'text-gray-400 hover:text-white'
            }`}
          >
            {view === 'cli' && (
              <motion.div
                layoutId="toggle-bg"
                className="absolute inset-0 bg-yellow-400 rounded-md"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
            <span className="relative z-10">CLI</span>
          </button>
        </div>
      </div>

      {/* Mockup area */}
      <div className="relative">
        <AnimatePresence mode="wait">
          {view === 'gui' ? (
            <motion.div
              key="gui"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
            >
              <GuiMockup />
            </motion.div>
          ) : (
            <motion.div
              key="cli"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
            >
              <CliMockup />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
