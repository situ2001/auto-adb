import z from "zod";
import type { ICliArgs } from "./interfaces.js";

export const cliArgsSchema: z.ZodType<ICliArgs> = z.object({
  adbHost: z.string().default('127.0.0.1'),
  adbPort: z.number().min(1).default(5037),
  commands: z.array(z.string()).default([]),
  cleanupCommands: z.array(z.string()).default([]),
});
