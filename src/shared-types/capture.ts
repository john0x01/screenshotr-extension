import { z } from 'zod';

export const CaptureMetadataSchema = z.object({
  title: z.string(),
  url: z.string().url(),
  domain: z.string(),
  path: z.string(),
  capturedAt: z.number().int().positive(),
});
export type CaptureMetadata = z.infer<typeof CaptureMetadataSchema>;

export const CaptureStatusSchema = z.enum([
  'pending',
  'compressed',
  'uploaded',
  'deleted',
]);
export type CaptureStatus = z.infer<typeof CaptureStatusSchema>;

export const CaptureSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  projectId: z.string().uuid().nullable(),
  title: z.string(),
  url: z.string().url(),
  domain: z.string(),
  path: z.string(),
  capturedAt: z.number().int().positive(),
  status: CaptureStatusSchema,
  imageKey: z.string(),
  thumbnailKey: z.string().nullable(),
  fileSize: z.number().int().positive(),
  tags: z.array(z.string()).default([]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable(),
});
export type Capture = z.infer<typeof CaptureSchema>;
