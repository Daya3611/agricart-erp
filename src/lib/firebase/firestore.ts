import { adminDb, hasValidAdminCredentials } from './admin';
import { db } from './client';
export { ERP_COLLECTIONS } from './collections';
import {
  collection as clientCollection,
  doc as clientDoc,
  getDocs as clientGetDocs,
  getDoc as clientGetDoc,
  setDoc as clientSetDoc,
  updateDoc as clientUpdateDoc,
  deleteDoc as clientDeleteDoc,
  query as clientQuery,
  where as clientWhere,
  orderBy as clientOrderBy,
  limit as clientLimit,
} from 'firebase/firestore';

export async function fetchCollection(collectionName: string, filters: { field: string; op: any; value: any }[] = []) {
  try {
    if (hasValidAdminCredentials) {
      let ref: any = adminDb.collection(collectionName);
      for (const f of filters) {
        ref = ref.where(f.field, f.op, f.value);
      }
      const snap = await ref.get();
      return snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    } else {
      // Use Client Firestore SDK
      let colRef = clientCollection(db, collectionName);
      const queryConstraints: any[] = [];
      for (const f of filters) {
        queryConstraints.push(clientWhere(f.field, f.op, f.value));
      }
      const q = clientQuery(colRef, ...queryConstraints);
      const snap = await clientGetDocs(q);
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    }
  } catch (err: any) {
    console.error(`fetchCollection error (${collectionName}):`, err);
    return [];
  }
}

export async function fetchDocument(collectionName: string, docId: string) {
  try {
    if (hasValidAdminCredentials) {
      const docSnap = await adminDb.collection(collectionName).doc(docId).get();
      if (!docSnap.exists) return null;
      return { id: docSnap.id, ...docSnap.data() };
    } else {
      const docRef = clientDoc(db, collectionName, docId);
      const docSnap = await clientGetDoc(docRef);
      if (!docSnap.exists()) return null;
      return { id: docSnap.id, ...docSnap.data() };
    }
  } catch (err) {
    console.error(`fetchDocument error (${collectionName}/${docId}):`, err);
    return null;
  }
}

function cleanUndefined(obj: any): any {
  if (obj === null || obj === undefined) return null;
  if (Array.isArray(obj)) return obj.map(cleanUndefined);
  if (typeof obj === 'object' && !(obj instanceof Date)) {
    const res: Record<string, any> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v !== undefined) {
        res[k] = cleanUndefined(v);
      }
    }
    return res;
  }
  return obj;
}

export async function saveDocument(collectionName: string, docId: string, data: any, merge = true) {
  try {
    const cleaned = cleanUndefined(data);
    if (hasValidAdminCredentials) {
      await adminDb.collection(collectionName).doc(docId).set(cleaned, { merge });
    } else {
      const docRef = clientDoc(db, collectionName, docId);
      await clientSetDoc(docRef, cleaned, { merge });
    }
    return { success: true };
  } catch (err: any) {
    console.error(`saveDocument error (${collectionName}/${docId}):`, err);
    return { success: false, error: err.message };
  }
}

export async function updateDocument(collectionName: string, docId: string, data: any) {
  try {
    const cleaned = cleanUndefined(data);
    if (hasValidAdminCredentials) {
      await adminDb.collection(collectionName).doc(docId).update(cleaned);
    } else {
      const docRef = clientDoc(db, collectionName, docId);
      await clientUpdateDoc(docRef, cleaned);
    }
    return { success: true };
  } catch (err: any) {
    console.error(`updateDocument error (${collectionName}/${docId}):`, err);
    return { success: false, error: err.message };
  }
}

export async function deleteDocument(collectionName: string, docId: string) {
  try {
    if (hasValidAdminCredentials) {
      await adminDb.collection(collectionName).doc(docId).delete();
    } else {
      const docRef = clientDoc(db, collectionName, docId);
      await clientDeleteDoc(docRef);
    }
    return { success: true };
  } catch (err: any) {
    console.error(`deleteDocument error (${collectionName}/${docId}):`, err);
    return { success: false, error: err.message };
  }
}
