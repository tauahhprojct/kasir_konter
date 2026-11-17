import { supabase } from '../supabase';

type Ref = { table: string; shopId: string; id?: string; collection?: boolean };
type Snapshot = { exists: () => boolean; data: () => Record<string, unknown>; docs: { id: string; data: () => Record<string, unknown> }[] };

export const db = supabase;
export const Timestamp = class { constructor(private date: Date) {} toDate() { return this.date; } };
export const serverTimestamp = () => new Date().toISOString();

export function doc(_db: unknown, ...path: string[]): Ref {
  if (path[0] === 'shops' && path.length === 2) return { table: 'shops', shopId: path[1], id: path[1] };
  return { table: path[2], shopId: path[1], id: path[3] };
}
export function collection(_db: unknown, ...path: string[]): Ref {
  return { table: path[2], shopId: path[1], collection: true };
}
export function where(_field: string, _op: string, _value: unknown) { return null; }
export function query(ref: Ref, ..._constraints: unknown[]) { return ref; }

function toColumn(key: string) {
  if (key === 'ownerId') return 'shop_id';
  return key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}
function fromRow(row: Record<string, unknown>, table: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (key === 'shop_id' && table !== 'shops') result.ownerId = value;
    else if (key === 'shop_name') result.shopName = value;
    else result[key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase())] = value;
  }
  return result;
}
function toRow(data: Record<string, unknown>, ref: Ref) {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (key === 'ownerId') continue;
    result[key === 'shopName' ? 'shop_name' : toColumn(key)] = value;
  }
  if (ref.table === 'shops') result.id = ref.id;
  else result.shop_id = ref.shopId;
  if (ref.id && ref.table !== 'shops') result.id = ref.id;
  return result;
}
function fail(error: { message?: string; code?: string } | null) {
  if (error) throw Object.assign(new Error(error.message || 'Supabase request failed'), { code: error.code });
}

export async function getDoc(ref: Ref): Promise<{ exists: () => boolean; data: () => Record<string, unknown> }> {
  const result = ref.table === 'shops'
    ? await supabase.from('shops').select('*').eq('id', ref.id!).maybeSingle()
    : await supabase.from(ref.table).select('*').eq('shop_id', ref.shopId).eq('id', ref.id!).maybeSingle();
  fail(result.error);
  const row = result.data ? fromRow(result.data, ref.table) : null;
  return { exists: () => Boolean(row), data: () => row || {} };
}

export async function setDoc(ref: Ref, data: Record<string, unknown>) {
  const result = ref.table === 'shops'
    ? await supabase.from('shops').upsert(toRow(data, ref), { onConflict: 'id' })
    : await supabase.from(ref.table).upsert(toRow(data, ref), { onConflict: 'shop_id,id' });
  fail(result.error);
}
export async function updateDoc(ref: Ref, data: Record<string, unknown>) {
  const row = toRow(data, ref);
  delete row.id; delete row.shop_id;
  const result = ref.table === 'shops'
    ? await supabase.from('shops').update(row).eq('id', ref.id!)
    : await supabase.from(ref.table).update(row).eq('shop_id', ref.shopId).eq('id', ref.id!);
  fail(result.error);
}
export async function deleteDoc(ref: Ref) {
  const result = ref.table === 'shops'
    ? await supabase.from('shops').delete().eq('id', ref.id!)
    : await supabase.from(ref.table).delete().eq('shop_id', ref.shopId).eq('id', ref.id!);
  fail(result.error);
}

export function onSnapshot(ref: Ref, next: (snapshot: Snapshot) => void, error?: (err: Error) => void) {
  let stopped = false;
  const refresh = async () => {
    try {
      if (ref.collection) {
        const result = await supabase.from(ref.table).select('*').eq('shop_id', ref.shopId);
        fail(result.error);
        if (!stopped) next({ exists: () => true, data: () => ({}), docs: (result.data || []).map((row) => ({ id: String(row.id), data: () => fromRow(row, ref.table) })) });
      } else {
        const result = await getDoc(ref);
        if (!stopped) next({ ...result, docs: [] });
      }
    } catch (err) { if (!stopped) error?.(err instanceof Error ? err : new Error(String(err))); }
  };
  void refresh();
  const timer = window.setInterval(() => void refresh(), 5000);
  return () => { stopped = true; window.clearInterval(timer); };
}

type BatchOp = { type: 'set' | 'update' | 'delete'; ref: Ref; data?: Record<string, unknown> };
export function writeBatch(_db: unknown) {
  const ops: BatchOp[] = [];
  return {
    set: (ref: Ref, data: Record<string, unknown>) => { ops.push({ type: 'set', ref, data }); },
    update: (ref: Ref, data: Record<string, unknown>) => { ops.push({ type: 'update', ref, data }); },
    delete: (ref: Ref) => { ops.push({ type: 'delete', ref }); },
    commit: async () => { for (const op of ops) { if (op.type === 'set') await setDoc(op.ref, op.data!); else if (op.type === 'update') await updateDoc(op.ref, op.data!); else await deleteDoc(op.ref); } },
  };
}
