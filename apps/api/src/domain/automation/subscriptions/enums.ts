// How a delivery authenticates, with a value taken from one of the owner's secrets.
export enum DeliveryScheme {
  Basic = 'basic',
  Bearer = 'bearer',
}

// Why a subscription refuses to be created; the presentation turns the code into a message.
export enum SubscriptionRefusal {
  ForeignSecret = 'subscription.foreign-secret',
}
