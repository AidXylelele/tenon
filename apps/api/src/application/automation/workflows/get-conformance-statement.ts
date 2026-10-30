import { Injectable } from '@nestjs/common';
import { ConformanceStatement } from '../../../domain/automation/language/conformance-statement.js';

@Injectable()
export class GetConformanceStatement {
  execute(): ConformanceStatement {
    return ConformanceStatement.current();
  }
}
