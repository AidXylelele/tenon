export enum MessageTopic {
  EventAccepted = "event.accepted",
  EventOffered = "event.offered",
  TriggerOffered = "trigger.offered",
  ChildEnded = "instance.child-ended",
  ScheduledCompleted = "instance.scheduled-completed",
  ChildrenAbandoned = "instance.children-abandoned",
  CancelRequested = "instance.cancel-requested",
  RunBegin = "run.begin",
  RunRespond = "run.respond",
  RunReceives = "run.receives",
  RunFail = "run.fail",
  RunEffect = "run.effect",
  RunProcess = "run.process",
  RunTimer = "run.timer",
  DeliveryRequested = "delivery.requested",
  ScheduleArmed = "schedule.armed",
  ScheduleFired = "schedule.fired",
}

export enum IdNamespace {
  Instances = "df367bff-100f-4133-ae08-71552df2fc33",
}

export enum SpanAttribute {
  System = "messaging.system",
  OperationName = "messaging.operation.name",
  OperationType = "messaging.operation.type",
  Destination = "messaging.destination.name",
  MessageId = "messaging.message.id",
  InstanceId = "tenon.instance.id",
  ParentId = "tenon.parent.id",
  EffectId = "tenon.effect.id",
  WorkflowId = "tenon.workflow.id",
  SubscriptionId = "tenon.subscription.id",
  EventSequence = "tenon.event.sequence",
}
