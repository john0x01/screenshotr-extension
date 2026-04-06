import { z } from 'zod';

export const TagSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  name: z.string().min(1).max(50),
  createdAt: z.string().datetime(),
});
export type Tag = z.infer<typeof TagSchema>;
