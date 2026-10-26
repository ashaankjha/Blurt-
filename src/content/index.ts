/**
 * Content runtime: bundled pack loader, Everything Mix, persisted no-repeat history and custom
 * packs. See src/content/HANDOFF.md.
 */
import { PACK_LOADERS, PACK_MANIFEST } from '../../content/packs';
import { EVERYTHING_MIX_ID } from '../config';
import { createCustomPackService } from './custom';
import { kv } from './kv';
import { createContentService } from './service';
import type { ContentService, CustomPackService } from './types';

export * from './types';
export { createContentService, EVERYTHING_MIX_META, type ContentServiceDeps } from './service';
export {
  createCustomPackService,
  decodePack,
  encodePack,
  InvalidPackCodeError,
  rekeyPack,
  type CustomPackServiceOptions,
} from './custom';
export { createMemoryKV, kv, type KV, type MemoryKV } from './kv';

export const customPackService: CustomPackService = createCustomPackService({
  kv,
  reservedIds: () => [EVERYTHING_MIX_ID, ...PACK_MANIFEST.map((m) => m.id)],
});

export const contentService: ContentService = createContentService({
  manifest: PACK_MANIFEST,
  loaders: PACK_LOADERS,
  kv,
  customPacks: customPackService,
});
