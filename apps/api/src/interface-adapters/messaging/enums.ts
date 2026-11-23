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
