# Agent Guide

This repository contains reusable GitHub workflows, versioned utility actions, and deprecated
legacy composite actions maintained by the Core Services team. Read [README.md](README.md) for
the repository map, consumer guidance, and migration context.

## Commands

- Install dependencies: `npm ci`
- Run all non-mutating checks: `npm run ci`
- Run tests in watch mode: `npm run watch`
- Fix lint issues: `npm run lint-fix`
- Fix formatting issues: `npm run format-fix`

## Change Expectations

- Keep external actions pinned to immutable commit SHAs.
- Preserve workflow and action inputs, outputs, permissions, and environment contracts unless a
  breaking change is explicitly requested.
- Add the appropriate version label and update component changelogs when required by
  [VERSIONING.md](VERSIONING.md). Use `version:untracked` only for changes outside versioned
  component behavior.
- Run `npm run ci` before handing off changes.

## Safety

Changes to unversioned workflows and legacy actions can affect consumers immediately. Deployment,
Terraform, and AWS-oriented workflows may modify live infrastructure when invoked with real
credentials. Review targets, inputs, permissions, and secrets carefully; do not run deployment or
cleanup workflows as local validation.
