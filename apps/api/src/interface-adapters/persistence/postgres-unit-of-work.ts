import { Injectable } from "@nestjs/common";
import { TransactionHost } from "@nestjs-cls/transactional";
import type { UnitOfWork } from "../../application/unit-of-work.js";
import type { Transaction } from "./interfaces.js";

@Injectable()
export class PostgresUnitOfWork implements UnitOfWork {
  constructor(private readonly txHost: TransactionHost<Transaction>) {}

  run<T>(work: () => Promise<T>): Promise<T> {
    return this.txHost.withTransaction(work);
  }
}
