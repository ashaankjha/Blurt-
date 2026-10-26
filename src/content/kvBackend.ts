/** Native backing store for `kv`: expo-sqlite's synchronous kv-store. Web uses kvBackend.web.ts. */
import { Storage } from 'expo-sqlite/kv-store';

export type SyncStorage = Pick<typeof Storage, 'getItemSync' | 'setItemSync' | 'removeItemSync' | 'getAllKeysSync'>;

export const defaultStorage: SyncStorage = Storage;
