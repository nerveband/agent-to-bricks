import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  X,
  Rocket,
  Stack,
  Lightning,
  Keyboard,
  Warning,
  Command,
} from "@phosphor-icons/react";

interface HelpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Section =
  | "getting-started"
  | "workflows"
  | "templates"
  | "shortcuts"
  | "troubleshooting";

export function HelpDialog({ open, onOpenChange }: HelpDialogProps) {
  const [section, setSection] = useState<Section>("getting-started");

  const SECTIONS: { key: Section; label: string; icon: React.ReactNode }[] = [
    {
      key: "getting-started",
      label: "Getting Started",
      icon: <Rocket size={16} />,
    },
    { key: "workflows", label: "Page Workflows", icon: <Stack size={16} /> },
    { key: "templates", label: "Templates", icon: <Lightning size={16} /> },
    { key: "shortcuts", label: "Shortcuts", icon: <Keyboard size={16} /> },
    {
      key: "troubleshooting",
      label: "Troubleshooting",
      icon: <Warning size={16} />,
    },
  ];

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 z-50 transition-opacity duration-300"
          style={{ background: "var(--surface-dark)", backdropFilter: "blur(20px)" }}
        />
        <Dialog.Content
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[560px] max-h-[80vh] overflow-hidden glass-base rounded-2xl border flex flex-col"
          style={{
            borderColor: "var(--border-subtle)",
            boxShadow: "var(--shadow-floating)",
          }}
        >
          <div
            className="flex items-center justify-between px-5 py-4 border-b white-glass"
            style={{ borderColor: "var(--border-subtle)" }}
          >
            <Dialog.Title
              className="text-[16px] font-semibold"
              style={{ color: "var(--fg)" }}
            >
              Help
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[var(--white-glass)] transition-colors"
                style={{ color: "var(--fg-muted)" }}
              >
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>

          <div className="flex flex-1 min-h-0" style={{ background: "var(--surface)" }}>
            <div
              className="w-[160px] border-r pill-glass p-3 space-y-1"
              style={{ borderColor: "var(--border-subtle)" }}
            >
              {SECTIONS.map((s) => {
                const isActiveSection = section === s.key;
                return (
                  <button
                    key={s.key}
                    onClick={() => setSection(s.key)}
                    className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg text-[13px] transition-colors ${
                      isActiveSection ? "settings-tab-active font-semibold" : "hover:bg-[var(--white-glass)]"
                    }`}
                    style={{
                      color: isActiveSection ? "var(--fg)" : "var(--fg-muted)",
                    }}
                  >
                    <span style={{ color: isActiveSection ? "var(--yellow)" : "var(--fg-subtle)" }}>
                      {s.icon}
                    </span>
                    {s.label}
                  </button>
                );
              })}
            </div>

            <div className="flex-1 p-5 overflow-y-auto">
              {section === "getting-started" && <GettingStarted />}
              {section === "workflows" && <PageWorkflows />}
              {section === "templates" && <Templates />}
              {section === "shortcuts" && <Shortcuts />}
              {section === "troubleshooting" && <Troubleshooting />}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function HelpSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3
        className="text-[15px] font-semibold mb-3"
        style={{ color: "var(--fg)" }}
      >
        {title}
      </h3>
      <div
        className="text-[13px] leading-relaxed space-y-3"
        style={{ color: "var(--fg-muted)" }}
      >
        {children}
      </div>
    </div>
  );
}

function CodeInline({ children }: { children: React.ReactNode }) {
  return (
    <code
      className="font-mono text-[12px] px-1.5 py-0.5 rounded white-glass border"
      style={{ borderColor: "var(--border-subtle)", color: "var(--yellow)" }}
    >
      {children}
    </code>
  );
}

function GettingStarted() {
  return (
    <HelpSection title="Getting Started">
      <p>
        Agent to Bricks lets you build WordPress pages with Bricks Builder
        using AI coding agents like Claude Code, Codex, and OpenCode.
      </p>
      <ol className="list-decimal list-inside space-y-2">
        <li>
          <strong style={{ color: "var(--fg)" }}>Connect your site</strong> — Go
          to Settings and enter your WordPress site URL and API key.
        </li>
        <li>
          <strong style={{ color: "var(--fg)" }}>Launch a coder</strong> — Click
          any installed tool in the sidebar to open a terminal session.
        </li>
        <li>
          <strong style={{ color: "var(--fg)" }}>Run your first pull</strong> —
          Use the Prompt Templates panel and click "Pull Page" to download a
          page&apos;s elements.
        </li>
      </ol>
      <p>
        Your API key can be found in the WordPress dashboard under{" "}
        <strong style={{ color: "var(--fg)" }}>
          Agent to Bricks &rarr; API Keys
        </strong>
        .
      </p>
    </HelpSection>
  );
}

function PageWorkflows() {
  return (
    <HelpSection title="Page Workflows">
      <p>
        The core workflow for building pages involves pulling, editing, and
        pushing page elements.
      </p>
      <div className="space-y-3">
        <div>
          <p>
            <strong style={{ color: "var(--fg)" }}>Pull</strong> — Downloads all
            elements from a Bricks page as JSON. This is your starting point.
          </p>
          <p>
            <CodeInline>bricks pull --page 1234</CodeInline>
          </p>
        </div>
        <div>
          <p>
            <strong style={{ color: "var(--fg)" }}>Push</strong> — Uploads your
            local changes back to the live page.
          </p>
          <p>
            <CodeInline>bricks push --page 1234</CodeInline>
          </p>
        </div>
        <div>
          <p>
            <strong style={{ color: "var(--fg)" }}>Snapshot</strong> — Saves a
            backup of the page before you make changes. Always snapshot first!
          </p>
          <p>
            <CodeInline>bricks snapshot create --page 1234</CodeInline>
          </p>
        </div>
        <div>
          <p>
            <strong style={{ color: "var(--fg)" }}>Rollback</strong> — Restores
            a page to a previous snapshot if something goes wrong.
          </p>
          <p>
            <CodeInline>
              bricks snapshot rollback --page 1234 --snapshot abc123
            </CodeInline>
          </p>
        </div>
        <div>
          <p>
            <strong style={{ color: "var(--fg)" }}>Generate</strong> — Uses AI
            to create new sections or entire pages from text descriptions.
          </p>
          <p>
            <CodeInline>
              bricks generate section --page 1234 --prompt "hero with CTA"
            </CodeInline>
          </p>
        </div>
        <div>
          <p>
            <strong style={{ color: "var(--fg)" }}>Convert</strong> — Transforms
            existing HTML files into Bricks elements.
          </p>
          <p>
            <CodeInline>bricks convert --input file.html --page 1234</CodeInline>
          </p>
        </div>
      </div>
    </HelpSection>
  );
}

function Templates() {
  return (
    <HelpSection title="Prompt Templates">
      <p>
        Templates are pre-built commands that you can run with one click from the
        Prompt Templates panel.
      </p>
      <ul className="list-disc list-inside space-y-1">
        <li>Click a template to expand it and fill in variables</li>
        <li>
          Variables like <CodeInline>{"{pageId}"}</CodeInline> are highlighted
          and prompted before running
        </li>
        <li>Click "Run" to inject the command into your active terminal</li>
      </ul>
      <p>
        <strong style={{ color: "var(--fg)" }}>Custom templates:</strong> Click
        the "New" button to create your own templates with custom commands and
        variables. Custom templates are saved to your config file.
      </p>
    </HelpSection>
  );
}

function Shortcuts() {
  return (
    <HelpSection title="Keyboard Shortcuts">
      <div className="space-y-2">
        {[
          { label: "Toggle sidebar", keys: ["B"] },
          { label: "Toggle context panel", keys: ["I"] },
          { label: "New session", keys: ["N"] },
          { label: "Focus terminal", keys: ["Escape (standalone)"] },
        ].map((s) => (
          <div key={s.label} className="flex items-center justify-between">
            <span style={{ color: "var(--fg)" }}>{s.label}</span>
            <kbd
              className="flex items-center gap-0.5 text-[12px] font-mono px-2 py-1 rounded-md pill-glass border"
              style={{
                borderColor: "var(--border-subtle)",
                color: "var(--fg-muted)",
              }}
            >
              {s.keys[0] !== "Escape (standalone)" && (
                <Command size={12} />
              )}
              {s.keys[0]}
            </kbd>
          </div>
        ))}
      </div>
    </HelpSection>
  );
}

function Troubleshooting() {
  return (
    <HelpSection title="Troubleshooting">
      <div className="space-y-4">
        <div>
          <p>
            <strong style={{ color: "var(--fg)" }}>
              Tool not found
            </strong>
          </p>
          <p>
            Make sure the CLI tool is installed and in your PATH. Try running{" "}
            <CodeInline>which claude</CodeInline> or{" "}
            <CodeInline>which codex</CodeInline> in a regular terminal.
          </p>
        </div>
        <div>
          <p>
            <strong style={{ color: "var(--fg)" }}>
              API key invalid
            </strong>
          </p>
          <p>
            Check that your API key starts with <CodeInline>atb_</CodeInline> and
            hasn&apos;t expired. Generate a new one from WordPress &rarr; Agent to
            Bricks &rarr; API Keys.
          </p>
        </div>
        <div>
          <p>
            <strong style={{ color: "var(--fg)" }}>
              Connection refused
            </strong>
          </p>
          <p>
            Verify your site URL is correct and the Agent to Bricks plugin is
            activated. The REST API endpoint{" "}
            <CodeInline>/wp-json/agent-bricks/v1/</CodeInline> must be
            accessible.
          </p>
        </div>
        <div>
          <p>
            <strong style={{ color: "var(--fg)" }}>
              Terminal not responding
            </strong>
          </p>
          <p>
            Press <CodeInline>Escape</CodeInline> to refocus the terminal. If the
            process has ended, start a new session by clicking a tool in the
            sidebar.
          </p>
        </div>
      </div>
    </HelpSection>
  );
}
