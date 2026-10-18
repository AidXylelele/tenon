import { z } from 'zod';
import { ProblemCode } from '../../../domain/enums.js';
import { OPERATORS, PATTERN_OPERATORS } from './operators.js';
import { RegularExpression } from './regular-expression.js';

export const conditionSchema = z.strictObject({
  left: z.unknown().meta({ title: 'Value' }),
  operator: z.enum(OPERATORS).meta({ title: 'Operator' }),
  right: z.unknown().optional().meta({ title: 'Compared to' }),
});

export const conditionsSchema = z
  .strictObject({
    combinator: z.enum(['and', 'or']).default('and').meta({ title: 'Combine' }),
    ignoreCase: z.boolean().default(false).meta({ title: 'Ignore case' }),
    rules: z.array(conditionSchema).min(1).meta({ title: 'Conditions' }),
  })
  .superRefine((conditions, context) => {
    conditions.rules.forEach((rule, index) => {
      const pattern = PATTERN_OPERATORS.includes(rule.operator);

      if (!pattern) return;

      if (typeof rule.right !== 'string') return;

      const problem = RegularExpression.problemOf(rule.right);

      if (problem) {
        context.addIssue({
          code: 'custom',
          path: ['rules', index, 'right'],
          message: problem,
          params: { problem: ProblemCode.InvalidRegex },
        });
      }
    });
  });

export type Conditions = z.infer<typeof conditionsSchema>;

export type Condition = z.infer<typeof conditionSchema>;
