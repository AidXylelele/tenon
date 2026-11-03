import { z } from 'zod';

const ATTRIBUTE = /^[a-z0-9]{1,20}$/;

// A CloudEvent 1.0 in structured mode: its required context attributes, extensions named as
// the specification allows, any data.
export const CloudEventBody = z
  .object({
    specversion: z.literal('1.0'),
    id: z.string().min(1),
    source: z.string().min(1),
    type: z.string().min(1),
    subject: z.string().min(1).optional(),
    time: z.iso.datetime({ offset: true }).optional(),
    datacontenttype: z.string().min(1).optional(),
    dataschema: z.string().min(1).optional(),
    data: z.json().optional(),
  })
  .catchall(z.json())
  .refine(
    (event) =>
      Object.keys(event).every(
        (name) => ATTRIBUTE.test(name) || name === 'data_base64',
      ),
    {
      message: 'An attribute name holds only lower-case letters and digits',
    },
  );

export type CloudEventBody = z.infer<typeof CloudEventBody>;

export const EventsQuery = z.strictObject({
  cursor: z.coerce.number().int().min(0).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

export type EventsQuery = z.infer<typeof EventsQuery>;
