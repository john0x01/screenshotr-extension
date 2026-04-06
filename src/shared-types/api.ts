import { z } from 'zod';
import { CaptureMetadataSchema } from './capture.js';

export const CreateCaptureRequestSchema = z.object({
  id: z.string().uuid(),
  metadata: CaptureMetadataSchema,
  fileSize: z.number().int().positive(),
  contentHash: z.string().optional(),
});
export type CreateCaptureRequest = z.infer<typeof CreateCaptureRequestSchema>;

export const CreateProjectRequestSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).default(''),
});
export type CreateProjectRequest = z.infer<typeof CreateProjectRequestSchema>;

export const PaginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
export type Pagination = z.infer<typeof PaginationSchema>;

export const ApiErrorSchema = z.object({
  error: z.string(),
  statusCode: z.number().int(),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;
