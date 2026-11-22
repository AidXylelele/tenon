import { z } from "zod";

const PORT = z.coerce.number().int().min(1).max(65535).default(6007);

export const PLAYGROUND_PORT = PORT.parse(process.env.PLAYGROUND_PORT);
