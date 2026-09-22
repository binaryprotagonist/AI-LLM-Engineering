import { z } from "zod";

export const GatewayRequestSchema = z.object({
  question: z
    .string()
    .trim()
    .min(1, "Question cannot be empty")
    .max(4000, "Question is too long"),

  user: z.object({
    userId: z.string().min(1),
    tenantId: z.string().min(1),
    roles: z.array(z.string()).min(1)
  })
});

export type ValidatedGatewayRequest = z.infer<
  typeof GatewayRequestSchema
>;