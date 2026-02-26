---
title: Philosophy
description: Why Agent to Bricks exists and what it's trying to be
---

I built Agent to Bricks because the tools I wanted didn't exist.

AI coding agents like Claude Code and Codex are writing code that's genuinely good. But they had no way to talk to a Bricks site. No access to your classes, your tokens, your element tree. And the WordPress-specific AI tools that do exist come with monthly subscriptions that stack on top of everything else you're already paying for.

So I wrote a bridge.

## The problem

If you're building sites with Bricks and Automatic.css, you've set up a real design system. You have utility classes, design tokens, spacing scales, color palettes, component templates. It's a well-organized system. And then AI comes along and ignores all of it.

The AI website builders don't know about your ACSS classes. They don't know that `section--l` means something on your site. They generate their own CSS, their own class names, their own structure. The output looks generic because it _is_ generic.

On the other side, AI coding tools like Claude Code are good at following instructions and writing code that matches a specification. If you give Claude Code your class list, your design tokens, and clear instructions, it'll write HTML that uses them correctly. But there was no good way to get that information to the AI, and no good way to get the AI's output into Bricks.

Agent to Bricks fills that gap. The plugin exposes your site's design system as an API. The CLI converts HTML to Bricks elements and resolves class names to global class IDs. The `agent context` command packages everything into a format LLMs understand. Now any AI coding tool can read your site, generate matching content, and push it live.

## What this is

Agent to Bricks is a bridge between AI coding tools and Bricks Builder. That's the whole thing.

It's not an AI website builder. It doesn't host an AI model. It doesn't generate content on its own (the `/generate` endpoint is a convenience wrapper, but the real workflow is using external AI tools through the CLI). It's infrastructure that connects two systems that should be able to talk to each other but couldn't before.

It's also a passion project. I use Bricks and ACSS for my own client work, and I wanted better tools. I figured other people in the community probably wanted the same thing.

## On the subscription treadmill

Every few weeks a new AI-powered WordPress plugin launches. The demo looks great. Then the pricing page: $29/month, $49/month, $99/month for the agency tier. That's on top of hosting, Bricks, ACSS, Frames, and whatever else you're already running. The costs stack and they never stop stacking.

Some tools offer lifetime deals. I've bought a few. Half stopped getting meaningful updates within a year. The other half pivoted to something else. Plugin fatigue is real, and LTD fatigue might be worse.

What most of these tools are selling is a thin wrapper around the same LLM APIs everyone has access to. The prompting, the API calls, the JSON manipulation -- none of that needs to be a SaaS. It can run on your own machine, with your own API keys, for the cost of the tokens you actually use.

## Open source values

The whole project is GPL-3.0. Plugin, CLI, GUI -- all of it. There's no "pro" tier, no feature gating, no telemetry, no vendor lock-in. Your API keys stay on your server. Your content stays in your WordPress database. The CLI is a static binary with no phone-home.

Your machine, your keys, your workflow. No cloud service in the middle. No usage tracking. No subscription.

## Bring your own agent

I didn't want to build another AI coding tool. There are already good ones: Claude Code, Codex, OpenCode, and whatever comes next. What was missing was the Bricks-specific layer -- the part that understands elements, classes, tokens, and how to push changes back to WordPress.

Agent to Bricks provides that layer. You bring whatever AI tool you prefer. The CLI gives it the context and commands it needs to work with your site. When a better AI tool comes out next month, you can switch to it without changing anything about your Bricks workflow.

## The hope for native support

Honestly, the best outcome would be for Bricks to build AI features natively. Thomas and the Bricks team have a deep understanding of the builder's architecture. They could do things at a lower level than a plugin can. If Bricks ships a native AI assistant that understands the element model, the class system, and the design token pipeline, that would be better than anything a third-party plugin can provide.

Until that happens, this project covers the ground. And if native support does arrive, the work here -- the API design, the element validation, the HTML conversion, the class resolution -- still has value as patterns that transfer.

## A gift to the community

I've been part of the Bricks and ACSS community for a while. I've learned from it, built my business on it, and benefited from other people sharing their work. Agent to Bricks is my way of giving back.

If it saves you time, great. If it sparks ideas for something better, also great. If Bricks ships native AI and this project becomes unnecessary, that would be the best outcome of all.

-- [Ashraf Ali](https://ashrafali.net)
