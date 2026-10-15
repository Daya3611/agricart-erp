import { normalizeReportDate, getOperationalDateString } from '../src/lib/utils/date-utils';
import { checkExistingDailyReport, createOrUpdateReport } from '../src/lib/services/report-service';

async function runTests() {
  console.log('--- 1. Testing Date Normalization & IST Timezone ---');
  const todayIST = getOperationalDateString();
  console.log('Today in IST (Asia/Kolkata):', todayIST);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(todayIST)) {
    throw new Error('Invalid format for todayIST: ' + todayIST);
  }

  const normalizedWithSpaces = normalizeReportDate('  2026-10-15  ');
  if (normalizedWithSpaces !== '2026-10-15') {
    throw new Error('Whitespace normalization failed: ' + normalizedWithSpaces);
  }
  console.log('✓ Date normalization passed.');

  console.log('--- 2. Testing Check & Prevention Logic with Mock Staff ---');
  const mockStaff = {
    uid: 'mock_staff_test_' + Date.now(),
    employeeId: 'AGR-TEST-999',
    fullName: 'Test Staff',
    email: 'test@agricart.com',
    departmentId: 'dept_field',
    departmentName: 'Field Operations',
    assignedCenterIds: ['center_1'],
    assignedCenterNames: ['Center 1'],
  };

  const testDate = '2026-10-14';

  // Step 2a: Check unsubmitted date
  const checkInitial = await checkExistingDailyReport(mockStaff.uid, testDate);
  console.log('Initial check for unsubmitted date:', checkInitial.exists, checkInitial.isSubmitted);
  if (checkInitial.exists || checkInitial.isSubmitted) {
    throw new Error('Expected no report to exist initially.');
  }
  console.log('✓ Scenario 1: Initial unsubmitted date check passed.');

  // Step 2b: Submit first report
  const submitResult1 = await createOrUpdateReport(mockStaff, {
    reportDate: testDate,
    workLocation: 'APMC Market',
    activities: 'Inspected apple lots',
    completedTasks: 'Cataloged 5 crates',
    farmersVisited: 3,
    meetingsConducted: 1,
    submitNow: true,
  });
  console.log('First report submission result:', submitResult1);
  if (!submitResult1.success || !submitResult1.reportId) {
    throw new Error('First submission failed: ' + submitResult1.error);
  }
  console.log('✓ First report submitted successfully.');

  // Step 2c: Check submitted date
  const checkSubmitted = await checkExistingDailyReport(mockStaff.uid, testDate);
  console.log('Check after submission:', checkSubmitted.exists, checkSubmitted.isSubmitted, checkSubmitted.report?.status);
  if (!checkSubmitted.exists || !checkSubmitted.isSubmitted || checkSubmitted.report?.status !== 'submitted') {
    throw new Error('Expected report to be exists=true and isSubmitted=true');
  }
  console.log('✓ Scenario 2: Existing submitted report correctly detected.');

  // Step 2d: Attempt duplicate submission (should fail)
  const duplicateAttempt = await createOrUpdateReport(mockStaff, {
    reportDate: testDate,
    workLocation: 'APMC Market Alternate',
    activities: 'Trying duplicate',
    completedTasks: 'Duplicate task',
    farmersVisited: 1,
    meetingsConducted: 0,
    submitNow: true,
  });
  console.log('Duplicate submission attempt result:', duplicateAttempt);
  if (duplicateAttempt.success) {
    throw new Error('Expected duplicate submission to FAIL, but it succeeded!');
  }
  if (!duplicateAttempt.error?.includes('already been submitted')) {
    throw new Error('Expected duplicate error message, got: ' + duplicateAttempt.error);
  }
  console.log('✓ Scenario 4 & 5: Duplicate submission was blocked by server with concurrency protection!');

  // Step 2e: Check that another date for the same staff is still unsubmitted
  const checkDifferentDate = await checkExistingDailyReport(mockStaff.uid, '2026-10-13');
  if (checkDifferentDate.exists || checkDifferentDate.isSubmitted) {
    throw new Error('Different date should not be blocked.');
  }
  console.log('✓ Scenario 6: Different dates are not blocked.');

  // Step 2f: Check that another employee on the same date is not blocked
  const checkDifferentEmployee = await checkExistingDailyReport('another_staff_uid_999', testDate);
  if (checkDifferentEmployee.exists || checkDifferentEmployee.isSubmitted) {
    throw new Error('Different employee should not be blocked.');
  }
  console.log('✓ Scenario 6: Different employees on same date are not blocked.');

  console.log('\n===========================================');
  console.log('ALL VERIFICATION TESTS COMPLETED SUCCESSFULLY!');
  console.log('===========================================');
}

runTests().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});

