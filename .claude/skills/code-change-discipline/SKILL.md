---
name: code-change-discipline
description: >
  The discipline for writing or changing code: First Make it Work, then Make
  it Right, then Follow Practice. Use when the user runs
  /code-change-discipline or asks for these principles.
---

# code-change-discipline

Every time you are asked to make a change follow:

- First Make it Work.
- Then Make it Right.
- Follow Practice

# First Make it Work

## Laziness Protocol

- One decision lives in one place.
- Ship the smallest edit that solves the problem.

## Foundational Thinking

- Get the data shape right before you write the logic.
- Do first whatever helps every later phase.
- If a concurrent writer would matter, do not share state.

## TDD

- Write the failing test before you change the code.
- See it fail for the reason you expect.
- Make the smallest change that makes it pass.
- If an honest test is impractical, do not write a bad one.

## Redesign From First Principles

- Do not bolt a new requirement onto the old design.
- Ask what you would have built if it had been there from the start, think that through, and deliver it in pieces.

## Attack the Premise

- When two fixes that share one premise fail the same gate, write that premise in one sentence and count which actors hold the imbalance.
- Remove the assignment.
- Do not start another fix until you have done that.

## Subtract Before You Add

- Take complexity out before you add anything.

## Outcome-Oriented Execution

- Aim at the end state you can check.
- A break in the middle is allowed when you planned it and can undo it.

## Build the Lever

- If the work is not obvious at a glance, build the tool that does it.
- Do one unit by hand, then make the tool match that unit.

## Architecture

### Model the Domain

- Put the domain in a structure that makes the illegal states impossible.
- Maintain a glossary of domain terms.
- If the code is already clear and local, leave it.

### Boundary Discipline

- Check the data where it enters.
- Inside, trust it.
- Keep the business logic in a pure function.

### Type System Discipline

- Make the illegal value impossible to write.
- Parse outside data once, where it comes in.
- Do not silence the compiler.

### Make Operations Idempotent

- Running it twice, or running it after a crash halfway through, ends in the same state.

### Separate Before Serializing Shared State

- If they do not need the same mutable thing, give each its own.
- If they do, allow one writer, and enforce that in the structure.

# Then Make it Right

## Fix Root Causes

- Reproduce it.
- Fix the cause.
- A guard that only hides the crash is not a fix.

## Sequence work into verifiable units

- Finish one small unit and check it.
- Then start the next.

## Test Behavior, Not Implementation

- The test calls the code the way its user does and checks the result that user would see.
- If the test would still pass when every function returned nothing, throw it out.

## Refactoring

- Pin what the code does.
- Change the structure.
- Prove the behavior did not change.

## Review Before You Commit

- When the change works and its tests pass, and before you commit it, have separate review agents read it.
- Give each agent the changed files and one question, not your conclusions.
- An agent may run the project's tests with coverage to see what the tests reach.
- The questions:
  - Complexity: which changed functions branch a lot and are not fully tested? Split them, test them, or both.
  - Duplication: which changed code repeats the structure of code elsewhere? Make one decision live in one place.
  - Test strength: which change to a condition, a comparison, a boundary or a constant would the tests not notice? Cover the uncovered, make the tests catch what would survive, and delete dead code.
- Fix what they find, check the change again, then commit.

# Practice

## Keep a Log

- Keep a log of every action you take and the reason you took it.
- Report that log upon completion.

## Guard the Context Window

- Keep the main thread small.
- Send the bulk elsewhere, and keep the summary.

## Worktree Cleanup

- Find what is safe to remove, confirm nothing still in use needs it, then reclaim the disk.
- Uncommitted work waits for a decision.

## Commit

- Commit often, in small ordered commits, on the feature branch, never on master.
- Each commit says why, what changed, and how you proved it.
- Do not push. The owner pushes the branch and merges it into master through a pull request.
