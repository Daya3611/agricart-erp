import {
  startFieldActivity,
  updateFieldActivityProgress,
  endFieldActivity,
  getStaffActivitiesForDate,
  getLiveActivitiesForAdmin,
} from '../src/lib/services/field-activity-service';
import { fetchDocument } from '../src/lib/firebase/firestore';
import { ERP_COLLECTIONS } from '../src/lib/firebase/collections';
import { UserProfile, GpsCoordinate } from '../src/types';
import { getOperationalDateString } from '../src/lib/utils/date-utils';

async function runActivityLifecycleTests() {
  console.log('====================================================');
  console.log('STARTING ACTIVITY LIFECYCLE VERIFICATION TESTS');
  console.log('====================================================');

  const todayIST = getOperationalDateString();
  const testStaff: UserProfile = {
    uid: `test_crp_${Date.now()}`,
    employeeId: 'CRP-TEST-007',
    fullName: 'Ramesh Patil',
    email: 'ramesh.crp@agricart.com',
    role: 'staff',
    departmentId: 'dept_field_ops',
    departmentName: 'Field Operations',
    assignedCenterIds: ['center_dindori'],
    assignedCenterNames: ['Dindori Rural Center'],
    phone: '+91 9876543210',
    designation: 'Field Officer',
    accountStatus: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const startGps: GpsCoordinate = {
    latitude: 20.2014,
    longitude: 73.8421,
    accuracy: 9.5,
    placeName: 'Dindori Village Chowk, Nashik, Maharashtra',
    capturedAt: new Date().toISOString(),
  };

  // ----------------------------------------------------
  // TEST 1: Start Activity creates document immediately in Firestore
  // ----------------------------------------------------
  console.log('\n[TEST 1] Testing Start Activity immediate persistence...');
  const startResult = await startFieldActivity(testStaff, {
    slotNumber: 1,
    reportDate: todayIST,
    activityName: 'farmer_visit',
    activityNameLabel: 'Farmer Visit',
    village: 'Dindori',
    wadi: 'Patil Wadi',
    gps: startGps,
    locationStatus: 'captured',
    initialDetails: {
      activityType: 'single_farmer',
      farmerName: 'Kailash Shinde',
      totalParticipants: 1,
      maleParticipants: 1,
      femaleParticipants: 0,
      observations: '',
    },
  });

  if (!startResult.success || !startResult.activityId || !startResult.activity) {
    throw new Error(`Start Activity failed: ${startResult.error}`);
  }

  const activityId = startResult.activityId;
  console.log(`✓ Activity created successfully with ID: ${activityId}`);
  console.log(`  Status: ${startResult.activity.activityStatus}`);
  console.log(`  Start Time: ${startResult.activity.activityStartAt}`);
  console.log(`  Start Place: ${startResult.activity.activityStartLocation?.placeName}`);

  if (startResult.activity.activityStatus !== 'IN_PROGRESS') {
    throw new Error(`Expected status to be IN_PROGRESS, got: ${startResult.activity.activityStatus}`);
  }

  // Verify directly from Firestore collection erp_field_activities
  const fetchedDoc = (await fetchDocument(ERP_COLLECTIONS.fieldActivities, activityId)) as any;
  if (!fetchedDoc) {
    throw new Error(`Document ${activityId} does not exist in erp_field_activities collection!`);
  }
  if (fetchedDoc.activityStatus !== 'IN_PROGRESS') {
    throw new Error(`Direct Firestore document status is ${fetchedDoc.activityStatus}, expected IN_PROGRESS`);
  }
  console.log('✓ Verified document exists immediately in erp_field_activities with IN_PROGRESS status.');

  // ----------------------------------------------------
  // TEST 2: Active conflict check
  // ----------------------------------------------------
  console.log('\n[TEST 2] Testing conflict check for concurrent activities...');
  const conflictResult = await startFieldActivity(testStaff, {
    slotNumber: 2,
    reportDate: todayIST,
    activityName: 'training',
    activityNameLabel: 'Training',
    village: 'Niphad',
    gps: startGps,
  });

  if (conflictResult.success) {
    throw new Error('Expected second activity start to FAIL because slot 1 is in progress!');
  }
  console.log(`✓ Concurrent activity prevented as expected: "${conflictResult.error}"`);

  // ----------------------------------------------------
  // TEST 3: Admin Live Monitor detects the active activity immediately
  // ----------------------------------------------------
  console.log('\n[TEST 3] Testing Admin Live Monitor...');
  const liveData = await getLiveActivitiesForAdmin(todayIST);
  const foundLive = liveData.activeActivities.find((a) => a.activityId === activityId);
  if (!foundLive) {
    throw new Error(`Admin live monitor failed to find in-progress activity ${activityId}!`);
  }
  console.log(`✓ Admin live monitor detected active activity:`);
  console.log(`  Staff: ${foundLive.employeeName} (${foundLive.employeeId})`);
  console.log(`  Activity: ${foundLive.activityNameLabel} in ${foundLive.village}`);
  console.log(`  Start Location: ${foundLive.activityStartLocation?.placeName}`);

  // ----------------------------------------------------
  // TEST 4: Progress updates / autosave while IN_PROGRESS
  // ----------------------------------------------------
  console.log('\n[TEST 4] Testing progress updates and incremental autosave...');
  const updateResult = await updateFieldActivityProgress(testStaff, activityId, {
    observations: 'Inspected tomato crop. Detected mild early blight symptoms on lower leaves.',
    farmerIssues: 'Water stress due to 3-day load shedding.',
    supportProvided: ['technical_guidance', 'crop_guidance'],
    followUpRequired: true,
    followUpDetails: 'Provide biological fungicide spray schedule on Friday.',
  });

  if (!updateResult.success || !updateResult.activity) {
    throw new Error(`Autosave progress update failed: ${updateResult.error}`);
  }

  // Verify in Firestore
  const updatedDoc = (await fetchDocument(ERP_COLLECTIONS.fieldActivities, activityId)) as any;
  if (!updatedDoc.observations.includes('mild early blight')) {
    throw new Error('Updated observations were not persisted to Firestore!');
  }
  if (!updatedDoc.followUpRequired) {
    throw new Error('followUpRequired was not persisted to Firestore!');
  }
  console.log('✓ Incremental autosave persisted all fields to Firestore.');

  // ----------------------------------------------------
  // TEST 5: End Activity updates the SAME document to COMPLETED
  // ----------------------------------------------------
  console.log('\n[TEST 5] Testing End Activity...');
  const endGps: GpsCoordinate = {
    latitude: 20.2088,
    longitude: 73.8499,
    accuracy: 8.0,
    placeName: 'Shinde Farm, Outskirts of Dindori, Nashik',
    capturedAt: new Date().toISOString(),
  };

  const endResult = await endFieldActivity(testStaff, activityId, {
    endGps,
    locationStatus: 'captured',
    finalDetails: {
      observations: 'Inspected tomato crop. Detected mild early blight symptoms on lower leaves. Recommended bio-spray.',
    },
  });

  if (!endResult.success || !endResult.activity) {
    throw new Error(`End Activity failed: ${endResult.error}`);
  }

  console.log(`✓ Activity ended successfully:`);
  console.log(`  Status: ${endResult.activity.activityStatus}`);
  console.log(`  Duration: ${endResult.activity.activityDurationMinutes} minutes`);
  console.log(`  End Location: ${endResult.activity.activityEndLocation?.placeName}`);

  if (endResult.activity.activityStatus !== 'COMPLETED') {
    throw new Error(`Expected status COMPLETED, got ${endResult.activity.activityStatus}`);
  }
  if (!endResult.activity.activityEndAt) {
    throw new Error('activityEndAt was not captured!');
  }
  if (!endResult.activity.activityEndLocation) {
    throw new Error('activityEndLocation was not captured!');
  }

  // Verify direct document
  const finalDoc = (await fetchDocument(ERP_COLLECTIONS.fieldActivities, activityId)) as any;
  if (finalDoc.activityStatus !== 'COMPLETED') {
    throw new Error(`Document status in Firestore is not COMPLETED: ${finalDoc.activityStatus}`);
  }
  if (finalDoc.activityId !== activityId) {
    throw new Error('Document ID mismatch!');
  }
  console.log('✓ Verified EXACT SAME Firestore document updated to COMPLETED without duplication.');

  // ----------------------------------------------------
  // TEST 6: Prevent modifying completed activity
  // ----------------------------------------------------
  console.log('\n[TEST 6] Testing prevention of modifications to completed activities...');
  const restartResult = await startFieldActivity(testStaff, {
    activityId,
    slotNumber: 1,
    reportDate: todayIST,
    gps: startGps,
  });
  if (restartResult.success) {
    throw new Error('Expected restarting completed activity to fail!');
  }
  console.log(`✓ Restart prevented as expected: "${restartResult.error}"`);

  // ----------------------------------------------------
  // TEST 7: Query staff activities for date (refresh survival test)
  // ----------------------------------------------------
  console.log('\n[TEST 7] Testing retrieval of activities for staff...');
  const staffActivities = await getStaffActivitiesForDate(testStaff.uid, todayIST);
  const foundInHistory = staffActivities.find((a) => a.activityId === activityId);
  if (!foundInHistory) {
    throw new Error('Completed activity not found in staff activities query!');
  }
  if (foundInHistory.activityStatus !== 'COMPLETED') {
    throw new Error('Retrieved activity is not marked COMPLETED');
  }
  console.log(`✓ Staff activity successfully retrieved from query: slot #${foundInHistory.slotNumber}, status=${foundInHistory.activityStatus}, duration=${foundInHistory.activityDurationMinutes}m.`);

  console.log('\n====================================================');
  console.log('ALL 7 ACTIVITY LIFECYCLE TESTS PASSED PERFECTLY!');
  console.log('====================================================\n');
}

runActivityLifecycleTests().catch((err) => {
  console.error('\n❌ ACTIVITY LIFECYCLE TEST FAILED:', err);
  process.exit(1);
});
