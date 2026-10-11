import { adminDb, hasValidAdminCredentials } from '@/lib/firebase/admin';
import { ERP_COLLECTIONS } from '@/lib/firebase/collections';
import { fetchCollection } from '@/lib/firebase/firestore';

/**
 * Concurrency-safe unique Employee ID generation and verification.
 * Follows the standard human-readable business format: AGRI-EMP-0001
 */

export async function generateUniqueEmployeeId(): Promise<string> {
  if (!hasValidAdminCredentials) {
    return `AGRI-EMP-${Math.floor(1000 + Math.random() * 9000)}`;
  }

  const counterRef = adminDb.collection(ERP_COLLECTIONS.systemSettings).doc('counters');

  return await adminDb.runTransaction(async (transaction) => {
    const counterDoc = await transaction.get(counterRef);
    let nextNum = 1;

    if (counterDoc.exists) {
      const data = counterDoc.data();
      nextNum = (data?.employeeCounter || 0) + 1;
    }

    let candidateId = `AGRI-EMP-${String(nextNum).padStart(4, '0')}`;

    // Verify candidate does not collide with an existing employee document
    let collides = true;
    while (collides) {
      candidateId = `AGRI-EMP-${String(nextNum).padStart(4, '0')}`;
      const querySnap = await adminDb
        .collection(ERP_COLLECTIONS.employees)
        .where('employeeId', '==', candidateId)
        .limit(1)
        .get();

      if (querySnap.empty) {
        collides = false;
      } else {
        nextNum++;
      }
    }

    transaction.set(counterRef, { employeeCounter: nextNum }, { merge: true });
    return candidateId;
  });
}

export async function isEmployeeIdUnique(employeeId: string, excludeUid?: string): Promise<boolean> {
  const normalizedId = employeeId.trim().toUpperCase();
  const matches = await fetchCollection(ERP_COLLECTIONS.employees, [
    { field: 'employeeId', op: '==', value: normalizedId },
  ]);

  if (matches.length === 0) return true;
  if (excludeUid && matches.length === 1 && (matches[0] as any).uid === excludeUid) return true;
  return false;
}
