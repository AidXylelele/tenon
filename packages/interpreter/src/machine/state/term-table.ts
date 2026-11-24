import type {
  Descriptor,
  Procedure,
  Program,
  Stream,
  TaskTerm,
  Term,
  TermId,
} from "../../core/index.js";
import { termsOf } from "../../core/index.js";
import { InterpreterError, rootPointer } from "../../runtime/index.js";

interface TermRef {
  readonly root: string;
  readonly id: TermId;
}

interface Root {
  readonly name: string;
  readonly terms: ReadonlyMap<TermId, Term>;
}

const workflowRoot = "workflow";
const procedureRoot = "procedure";
const triggerRoot = "trigger";

export class TermTable {
  static of(program: Program): TermTable {
    return new TermTable(program);
  }

  readonly #roots: ReadonlyMap<string, ReadonlyMap<TermId, Term>>;
  readonly #refs: ReadonlyMap<Term, TermRef>;
  readonly #tasks: ReadonlyMap<Descriptor, TaskTerm>;
  readonly #workflow: Descriptor;

  private constructor(program: Program) {
    const roots = this.#rootsOf(program);
    const named = roots.map((root) => [root.name, root.terms] as const);
    const refs = roots.flatMap((root) => this.#refsOf(root));
    const terms = refs.map((ref) => ref[0]);
    const tasks = terms.filter(
      (term): term is TaskTerm => term.form === "task",
    );
    const described = tasks.map((task) => [task.descriptor, task] as const);

    this.#roots = new Map(named);
    this.#refs = new Map(refs);
    this.#tasks = new Map(described);
    this.#workflow = this.#workflowDescriptorOf(program);
  }

  get workflowDescriptor(): Descriptor {
    return this.#workflow;
  }

  all(): readonly Term[] {
    const held = this.#refs.keys();
    return Array.from(held);
  }

  taskOf(descriptor: Descriptor): TaskTerm {
    const task = this.#tasks.get(descriptor);

    if (task === undefined) {
      throw new InterpreterError(
        `The descriptor of '${descriptor.reference}' belongs to no task of the program.`,
      );
    }

    return task;
  }

  refOf(term: Term): TermRef {
    const ref = this.#refs.get(term);

    if (ref === undefined) {
      throw new InterpreterError(
        `The term '${term.id}' belongs to no root of the program.`,
      );
    }

    return ref;
  }

  termOf(ref: TermRef): Term {
    const term = this.#roots.get(ref.root)?.get(ref.id);

    if (term === undefined) {
      throw new InterpreterError(
        `The program holds no term '${ref.id}' in the root '${ref.root}'.`,
      );
    }

    return term;
  }

  #workflowDescriptorOf(program: Program): Descriptor {
    return {
      name: program.manifest.identity.name,
      reference: rootPointer,
      definition: program.definition,
    };
  }

  #rootsOf(program: Program): readonly Root[] {
    const workflow = this.#rootOf(workflowRoot, program.root);
    const procedures = [...program.procedures.values()];
    const called = procedures.map((procedure) =>
      this.#procedureRootOf(procedure),
    );
    const triggered = program.triggers.map((trigger, index) =>
      this.#triggerRootOf(trigger, index),
    );

    return [workflow, ...called, ...triggered];
  }

  #procedureRootOf(procedure: Procedure): Root {
    const name = `${procedureRoot}:${procedure.key}`;

    return this.#rootOf(name, procedure.body);
  }

  #triggerRootOf(trigger: Stream, index: number): Root {
    const name = `${triggerRoot}:${String(index)}`;

    return this.#rootOf(name, trigger);
  }

  #rootOf(name: string, root: Term): Root {
    const held = termsOf(root);
    const entries = held.map((term) => [term.id, term] as const);
    const terms = new Map(entries);
    const broken = held.find((term) => terms.get(term.id) !== term);

    if (broken !== undefined) {
      throw new InterpreterError(
        `Two terms of the root '${name}' share the id '${broken.id}' (D10).`,
      );
    }

    return { name, terms };
  }

  #refsOf(root: Root): readonly (readonly [Term, TermRef])[] {
    const terms = [...root.terms.values()];

    return terms.map((term) => [term, { root: root.name, id: term.id }]);
  }
}
