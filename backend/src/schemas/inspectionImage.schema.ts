import { z } from 'zod';
import { ImageType } from '@prisma/client';

export const uploadImageBodySchema = z.object({
  imageType: z
    .nativeEnum(ImageType, {
      errorMap: () => ({ message: 'Invalid imageType. Must be one of FRONT, BACK, SIDE, TOP, BOTTOM, OTHER' }),
    })
    .default(ImageType.OTHER),
});

export type UploadImageBodyInput = z.infer<typeof uploadImageBodySchema>;
