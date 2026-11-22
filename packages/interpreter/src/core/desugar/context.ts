import type { ExpressionLanguage } from "../../runtime/index.js";
import { type SemanticModel, resolutionKeyOf } from "../../semantics/index.js";
import { type Role, type TermId, termIdOf } from "../forms/index.js";
import {
  type ActivationMark,
  type StaticFrame,
  StaticActivations,
  StaticEnvironment,
} from "../storage/index.js";
import { Definitions } from "./definitions.js";
import { type ExtensionTerms, extensionTermsOf } from "./extensions.js";
import { TranslatedProcedures } from "./translated-procedures.js";

export type Extending = "extended" | "unextended";

interface ContextParts {
  readonly model: SemanticModel;
  readonly environment: StaticEnvironment;
  readonly activations: StaticActivations;
  readonly place: string | null;
  readonly extending: Extending;
  readonly taskActivation: ActivationMark;
  readonly labels: ReadonlyMap<string, number>;
  readonly extensions: ExtensionTerms;
  readonly expressions: ExpressionLanguage;
  readonly definitions: Definitions;
  readonly procedures: TranslatedProcedures;
}

const noLabels: ReadonlyMap<string, number> = new Map();

const noExtensions: ExtensionTerms = new Map();

export class Context {
  static rootOf(
    model: SemanticModel,
    expressions: ExpressionLanguage,
  ): Context {
    const definitions = new Definitions(model);
    const procedures = new TranslatedProcedures();
    const closed = new Context({
      model,
      environment: StaticEnvironment.empty,
      activations: StaticActivations.empty,
      place: null,
      extending: "extended",
      taskActivation: "own",
      labels: noLabels,
      extensions: noExtensions,
      expressions,
      definitions,
      procedures,
    });
    const extensions = extensionTermsOf(model.workflow.use, closed);
    const parts = { ...closed.#parts, extensions };

    return new Context(parts);
  }

  readonly #parts: ContextParts;

  private constructor(parts: ContextParts) {
    this.#parts = parts;
  }

  get model(): SemanticModel {
    return this.#parts.model;
  }

  get environment(): StaticEnvironment {
    return this.#parts.environment;
  }

  get activations(): StaticActivations {
    return this.#parts.activations;
  }

  get extending(): Extending {
    return this.#parts.extending;
  }

  get taskActivation(): ActivationMark {
    return this.#parts.taskActivation;
  }

  get labels(): ReadonlyMap<string, number> {
    return this.#parts.labels;
  }

  get extensions(): ExtensionTerms {
    return this.#parts.extensions;
  }

  get expressions(): ExpressionLanguage {
    return this.#parts.expressions;
  }

  get definitions(): Definitions {
    return this.#parts.definitions;
  }

  get procedures(): TranslatedProcedures {
    return this.#parts.procedures;
  }

  closed(): Context {
    const parts: ContextParts = {
      ...this.#parts,
      environment: StaticEnvironment.empty,
      activations: StaticActivations.empty,
      place: null,
      extending: "extended",
      taskActivation: "own",
      labels: noLabels,
    };

    return new Context(parts);
  }

  extended(frame: StaticFrame): Context {
    const environment = this.#parts.environment.extended(frame);
    const parts = { ...this.#parts, environment };

    return new Context(parts);
  }

  entered(mark: ActivationMark): Context {
    const activations = this.#parts.activations.entered(mark);
    const parts = { ...this.#parts, activations };

    return new Context(parts);
  }

  placedAt(place: string): Context {
    const parts = { ...this.#parts, place };
    return new Context(parts);
  }

  unextended(): Context {
    const parts: ContextParts = { ...this.#parts, extending: "unextended" };
    return new Context(parts);
  }

  transparent(): Context {
    const parts: ContextParts = {
      ...this.#parts,
      taskActivation: "transparent",
    };

    return new Context(parts);
  }

  labelled(labels: ReadonlyMap<string, number>): Context {
    const parts = { ...this.#parts, labels };
    return new Context(parts);
  }

  siteOf(pointer: string): string {
    return resolutionKeyOf(pointer, this.#parts.place);
  }

  termIdOf(pointer: string, role: Role): TermId {
    const site = this.siteOf(pointer);
    return termIdOf(site, role);
  }
}
