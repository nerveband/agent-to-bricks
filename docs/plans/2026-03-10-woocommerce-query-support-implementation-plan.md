# WooCommerce And Query Support Implementation Plan

Date: 2026-03-10
Owner: Codex
Status: Proposed
Related: [Issue #3](https://github.com/nerveband/agent-to-bricks/issues/3)

## Summary

Issue `#3` asks for "Support for WooCommerce and query elements". That should not be implemented as a narrow one-off. The right shape is a first-class, machine-readable product surface across:

- plugin discovery and REST/Abilities contracts
- CLI discovery, search, validation, and site-aware helpers
- GUI mentions, context, and typed actions
- docs, template validation, and staging/sandbox test flows

The implementation should treat WooCommerce support and query support as related but distinct:

1. Query support: discover, inspect, search, validate, and reference Bricks elements that use query controls.
2. WooCommerce support: detect Woo on the site, surface Woo-aware element types and data, validate Woo template requirements, and give agents typed ways to reason about products and store templates.

## Current Baseline

This plan is based on live repo inspection plus testing against `ts-staging`.

### What `ts-staging` exposes today

- `bricks site info --format json` succeeds on `ts-staging` and reports Bricks `2.2`, plugin `2.0.0`, and WordPress `6.9.2`.
- `GET /site/element-types?include_controls=1` shows query-capable Bricks elements on staging:
  - `accordion`
  - `carousel`
  - `map`
  - `posts`
  - `slider`
- The `posts` element exposes a real `query` control schema.
- `ts-staging` currently shows no WooCommerce-specific Bricks element types such as:
  - `product-add-to-cart`
  - `woocommerce-notice`
  - `woocommerce-account-page`
- `ts-staging` currently shows no WooCommerce abilities in `/wp-json/wp-abilities/v1/abilities`.

### What the product already supports

- Plugin:
  - generic element CRUD
  - `site/element-types` discovery with optional control schemas
  - cross-site element search via `/search/elements`
  - Abilities registration for ATB-owned routes
- CLI:
  - `bricks search elements`
  - `bricks abilities ...`
  - template catalog/composition flows
- GUI:
  - `@loop` mention type already exists
  - `@loop` currently searches only `posts` elements
  - abilities are fetched and shown separately

### Current gaps and blockers observed during testing

These should be fixed before or as part of Wave 0 because they block a clean Woo/query rollout.

1. `bricks abilities list --json` fails on staging because the CLI assumes every `input_schema` is an object. Some abilities return `[]` for empty input schemas.
2. `bricks search elements --setting query --format json` fails because the CLI expects `parentId` to always be a string, while staging can return numeric `0`.
3. `bricks validate <template-export.json>` does not accept Bricks export files shaped like `bricksExport.content`, which is the format used by the proprietary Woo template corpus.
4. Query support in the GUI is narrower than the live Bricks model:
   - the GUI exposes `@loop`
   - it only searches `posts`
   - it does not surface other query-capable elements or query settings
5. Woo support in docs is aspirational today. The docs mention Woo abilities generically, but the product does not yet provide first-class Woo-aware discovery or workflows.

## Template Corpus Findings

The proprietary test corpus under `docs/test-data/templates/woo-*` contains real WooCommerce-oriented Bricks exports. The files demonstrate two important implementation cases:

### Woo-specific Bricks element types

- `product-add-to-cart`
- `woocommerce-notice`
- `woocommerce-account-page`

### Query-driven Woo patterns built with standard Bricks elements

- `woo-product-grid-alpha.json` uses a `block` with:
  - `hasLoop: true`
  - `query.objectType: "post"`
  - `query.post_type: ["product"]`

This means Woo support cannot be modeled only as "support Woo element types". It also needs query-aware inspection and validation for normal Bricks container/block structures that point their query settings at Woo post types.

## Product Principles

The implementation should follow the repo's standing philosophy:

- contract-first and machine-readable by default
- align with ShipTypes-style agent ergonomics
- preserve or improve the `agent-dx-cli-scale` score on every public surface
- no prose-only support for machine-meaningful capabilities
- graceful degradation when WooCommerce is not installed

## Product Goal

After implementation, an agent or user should be able to:

1. detect whether WooCommerce is installed and whether Woo-specific Bricks element types are available
2. discover every query-capable Bricks element type and its query schema
3. search the site for query-driven elements and inspect what they query
4. reference Woo products, categories, and query loops in the GUI
5. validate proprietary Woo template exports against the current site's capabilities before pushing
6. read enough machine context from the CLI/plugin to safely build or modify Woo pages

## Scope

### In scope

- Woo-aware discovery and validation
- query-capable element discovery and search
- GUI support for query and Woo references
- CLI support for query and Woo discovery
- template corpus validation against real Woo exports
- staging and sandbox validation workflows
- docs, guides, and compatibility messaging

### Out of scope for the first rollout

- full store operations parity for every Woo entity
- order fulfillment or payment workflows
- editing Woo business data exclusively through prose prompts without typed surfaces
- deep support for every third-party Woo extension

## Proposed Architecture

## 1. Plugin

The plugin should become the canonical source of truth for query-capable Bricks features and Woo capability detection.

### 1.1 New capability discovery surface

Add new read endpoints and matching Abilities:

- `GET /site/features`
  - returns installed feature flags and versions
  - includes `woocommerce.active`, `woocommerce.version`, `woocommerce.hpos`, and `abilities.available`
- `GET /site/query-elements`
  - lists every Bricks element type with a `query` control
  - includes element name, label, category, and whether the element currently exists on the site
- `GET /site/woocommerce`
  - returns Woo-specific status:
    - plugin active
    - product post type available
    - Woo-specific Bricks element types available
    - key taxonomies present (`product_cat`, `product_tag`, attributes if feasible)

Matching Abilities:

- `agent-bricks/get-site-features`
- `agent-bricks/list-query-element-types`
- `agent-bricks/get-woocommerce-status`

### 1.2 Query-aware site search

Extend search beyond generic element type matching.

Either add a dedicated endpoint or extend the current one with typed filters:

- `GET /search/elements`
  - new filters:
    - `has_query=true`
    - `query_object_type`
    - `query_post_type`
    - `query_taxonomy`
    - `query_dynamic_only`
- or add:
  - `GET /search/query-elements`

Response should include query metadata extracted from settings:

- `hasQuery`
- `queryObjectType`
- `queryPostTypes`
- `queryTaxonomies`
- `queryRaw`

This is required for:

- CLI query search
- GUI `@query`/`@loop` references
- doctor/validate preflights

### 1.3 Woo resource discovery

Expose stable, read-only Woo data that is useful for agent planning and prompt grounding.

Recommended first-wave endpoints:

- `GET /woo/products`
  - id, title, slug, status, sku, price, categories, tags
- `GET /woo/product-categories`
  - id, name, slug, count
- `GET /woo/product-tags`
  - id, name, slug, count

Matching Abilities:

- `agent-bricks/list-products`
- `agent-bricks/list-product-categories`
- `agent-bricks/list-product-tags`

If Woo or WordPress core later exposes equivalent abilities, ATB should still keep ATB-owned read surfaces for predictable agent context and cross-version stability.

### 1.4 Template compatibility preflight

Add site-aware template validation for proprietary and exported Bricks templates.

Recommended endpoint:

- `POST /templates/validate`

Input:

- template export JSON
- optional target site/page info

Output:

- required element types
- required plugin/features
- missing site capabilities
- unknown element types
- query usage summary
- Woo dependency summary

This should specifically detect dependencies like:

- `product-add-to-cart`
- `woocommerce-notice`
- `woocommerce-account-page`
- `query.post_type == product`

### 1.5 Validation model changes

- Stop relying on short static element allowlists for anything site-dependent.
- Use live `site/element-types` and `site/query-elements` data where possible.
- Keep static validation only as a fallback for offline use.

## 2. CLI

The CLI should expose Woo/query support as typed discovery and validation flows, not hidden JSON spelunking.

### 2.1 Wave 0 fixes

Fix existing live breakages first:

- allow Abilities schemas where `input_schema` is `[]`
- accept numeric or string `parentId` in element search results
- allow `bricks validate` to consume:
  - flat ATB `elements` files
  - Bricks export files under `bricksExport.content`

### 2.2 New CLI surfaces

Recommended commands:

- `bricks site features`
- `bricks site query-elements`
- `bricks woo status`
- `bricks woo products list`
- `bricks woo categories list`
- `bricks woo tags list`

Query-specific search:

- `bricks search elements --has-query`
- `bricks search elements --query-post-type product`
- `bricks search elements --query-object-type post`

Validation and compatibility:

- `bricks validate template-export.json`
  - auto-detect flat file vs Bricks export
- `bricks templates validate path/to/export.json`
  - prints compatibility summary
- `bricks templates requirements path/to/export.json`
  - explicit requirement report for scripts and CI

### 2.3 Agent context additions

Extend `bricks agent context` with optional sections:

- `woocommerce`
- `query-elements`

Content should include:

- whether Woo is active
- Woo element types available on the site
- available query-capable Bricks element types
- relevant taxonomies and product types

### 2.4 Machine-readability rules

All new commands must:

- support `--format json`
- have deterministic structured errors
- expose their flags in `bricks schema`
- be covered by schema validation and tests

## 3. GUI

The GUI already has the beginnings of this, but it is too narrow and too implicit.

### 3.1 Query references

Promote query support from `@loop` into a real query-aware feature.

Recommended changes:

- keep `@loop` for backward familiarity
- add `@query` as the primary concept
- source both from live query-capable search, not just `posts`

Search results should show:

- page name
- element label/type
- query target summary
  - example: `post_type=product`

### 3.2 Woo references

Add new mention/reference types:

- `@product`
- `@product-category`
- `@product-tag`
- optionally `@woo-page` for shop/account/cart/checkout if present

These should resolve to compact machine context, not prose blurbs.

### 3.3 Context composer

When Woo is active, the launch/session context should add:

- Woo availability summary
- query-capable element summary
- products/categories snapshot when relevant
- compatibility warnings when the target site lacks Woo but the user references Woo templates

### 3.4 Typed actions

Add typed Woo/query read actions to the GUI Actions surface:

- List query elements
- List products
- List product categories
- Validate template compatibility

PTY/manual mode can remain as fallback, but typed actions should be the default for discovery.

## 4. Documentation And Website

Docs should stop implying Woo support is already first-class when it is only indirectly possible.

### Required docs deliverables

- new guide: `WooCommerce support`
- new guide: `Working with query elements`
- compatibility table:
  - Bricks query-capable elements
  - Woo-specific Bricks element types
  - what requires Woo installed
- template compatibility guide
- clear note that Woo features degrade gracefully when Woo is absent

### Docs examples to include

- inspect query-capable elements
- search for query loops targeting `product`
- validate a Woo product grid export
- reference `@product` and `@query` in the GUI

## 5. Testing Strategy

`ts-staging` should remain the ATB regression ground, but it is not enough by itself because it currently lacks Woo.

### 5.1 Environment model

Use two environments:

1. `ts-staging`
   - baseline ATB regression environment
   - validates that Woo-aware features degrade safely when Woo is absent
2. dedicated Woo sandbox
   - either:
     - install Woo on `ts-staging`, or
     - spin up a local disposable WordPress + Bricks + Woo sandbox with seeded data

Recommendation: keep `ts-staging` as the non-Woo baseline and add a dedicated Woo sandbox so both paths are tested continuously.

### 5.2 Woo demo data

Seed the Woo sandbox with:

- sample products
- sample categories and tags
- at least one variable product
- product images
- account page content
- shop/archive content

### 5.3 Proprietary corpus testing

Use the proprietary Woo template corpus as a first-class private test asset:

- `woo-add-to-cart`
- `woo-dashboard`
- `woo-notice`
- `woo-product-card`
- `woo-product-grid`
- `woo-product-rating`

Private/local environments should run the full corpus.
Public clones should skip cleanly with documented env gates.

### 5.4 Test matrix

Plugin:

- Woo absent:
  - feature detection returns inactive
  - Woo routes return empty or capability-aware responses
  - query element routes still work
- Woo present:
  - Woo discovery returns products/categories/tags
  - Woo element types are detected if Bricks exposes them
  - template validation reports accurate requirements

CLI:

- Abilities list handles empty array schemas
- search handles numeric/string parent IDs
- validate auto-detects export shapes
- query search filters work
- Woo commands support JSON and stable errors

GUI:

- `@query` and `@loop` search live query-capable elements
- `@product` and taxonomy references work when Woo is active
- Woo-absent state shows clear empty state instead of silent omission
- typed actions work in both Woo-present and Woo-absent environments

Corpus:

- private Woo templates parse
- requirement extraction works
- compatibility reports are stable
- curated subset can be pushed to the Woo sandbox scratch pages and rolled back

## 6. Execution Plan

## Wave 0: Baseline fixes and environment setup

- Fix CLI Abilities schema decoding
- Fix CLI search result decoding for mixed parent ID types
- Teach validation/template tooling to read Bricks export format
- Finalize sandbox strategy:
  - `ts-staging` remains non-Woo baseline
  - add dedicated Woo sandbox with demo data

Exit gate:

- staging commands no longer crash on the live payloads already observed
- private corpus can be parsed locally without manual reshaping

## Wave 1: Plugin discovery and contracts

- Add `site/features`
- Add `site/query-elements`
- Add Woo status endpoint
- Add matching Abilities
- Extend search with query metadata

Exit gate:

- query-capable elements are machine-discoverable
- Woo presence/absence is machine-discoverable

## Wave 2: CLI surfaces

- add `site features`
- add `site query-elements`
- add `woo ...` read commands
- extend `search elements` for query filters
- add template requirements/compatibility commands

Exit gate:

- every new command has JSON mode and tests
- agent context can include Woo/query sections

## Wave 3: GUI support

- add `@query`
- broaden `@loop`
- add `@product`, `@product-category`, `@product-tag`
- add typed Woo/query Actions
- add Woo/query context sections and empty-state messaging

Exit gate:

- GUI can discover and reference live Woo/query context without terminal fallback

## Wave 4: Docs and release hardening

- publish Woo/query guides
- document private corpus workflow
- add staging + Woo sandbox gates to prompts/check/release docs if needed

Exit gate:

- docs match the shipped behavior
- public and private contributors both have a supported path

## Acceptance Criteria

This issue is complete when all of the following are true:

1. The plugin can explicitly report whether WooCommerce is active and what Woo/query capabilities are available.
2. The CLI can inspect query-capable elements and Woo resources through stable JSON commands.
3. The GUI can reference query elements and Woo entities directly.
4. Proprietary Woo Bricks exports can be validated without manual file reshaping.
5. Woo-aware template compatibility can be checked before a push.
6. Both Woo-present and Woo-absent environments are covered in automated or repeatable test flows.
7. The docs explain the feature clearly, including the private template corpus path for local-only testing.

## Recommended Default Product Decisions

Unless the user requests otherwise, use these defaults:

- treat Woo support as read-first for the initial rollout
- do not start with orders/coupons/refunds
- prioritize product, taxonomy, and template/query awareness first
- keep `ts-staging` as the non-Woo baseline and add a separate Woo sandbox
- keep the proprietary Woo template corpus local/private and skipped by default in public clones

## Immediate Next Step

Implement Wave 0 first. The current live CLI discovery/search bugs should be fixed before adding new Woo/query product surfaces, otherwise the rollout will stack new functionality on top of already-broken machine-readable paths.
