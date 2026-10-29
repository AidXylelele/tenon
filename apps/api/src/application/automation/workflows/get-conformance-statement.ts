import { Injectable } from '@nestjs/common';
import type { ConformanceStatement } from '../../../domain/automation/language/interfaces.js';
import { SupportedSubset } from '../../../domain/automation/language/supported-subset.js';

@Injectable()
export class GetConformanceStatement {
  execute(): ConformanceStatement {
    return SupportedSubset.statement();
  }
}
