import { Injectable } from "@nestjs/common";
import { TransactionHost } from "@nestjs-cls/transactional";
import type { UnitOfWork } from "../../application/unit-of-work.js";
import { MessageInbox } from "../messaging/message-inbox.js";
import type { Transaction } from "./interfaces.js";

@Injectable()
export class PostgresUnitOfWork implements UnitOfWork {
  constructor(
    private readonly txHost: TransactionHost<Transaction>,
    private readonly inbox: MessageInbox,
  ) {}

  run<T>(work: () => Promise<T>): Promise<T> {
    return this.txHost.withTransaction(() =>
      this.inbox.recorded(this.txHost.tx, work),
    );
  }
}
