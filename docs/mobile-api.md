# Agricart ERP: Mobile REST API Documentation (v1)

> **Production Base URL:** `https://erp.agricartfpc.in/api/v1`  
> **Development Base URL:** `http://localhost:3000/api/v1`  
> **Protocol:** HTTPS  
> **Data Format:** JSON (`application/json`)  
> **Authentication:** Firebase Authentication Bearer ID Token  

---

## 1. Architecture & Authentication

### 1.1 Overview
The Agricart ERP Mobile API is a secure, stateless REST API built directly into the Next.js application using App Router Route Handlers. It empowers the Flutter Android application to interact with Firestore, Firebase Authentication, Cloud Storage, and backend business logic without exposing service account credentials or database secrets.

### 1.2 Authentication Protocol
1. The Flutter application prompts the employee for credentials and signs in using **Firebase Authentication Client SDK** (`firebase_auth`).
2. Upon successful authentication, Flutter retrieves the user's **Firebase ID Token** via `user.getIdToken()`.
3. Flutter includes this token in the `Authorization` header on every API request:
   ```http
   Authorization: Bearer <FIREBASE_ID_TOKEN>
   ```
   *Alternative:* For direct file downloads (e.g. PDF/Excel) or browser testing, `?token=<FIREBASE_ID_TOKEN>` query parameter is also supported.
4. **Local Development Bypass:** When testing directly on `localhost` without a Bearer token, the API automatically resolves the local development employee (or accepts `?uid=...` or `?email=...`), allowing instant browser inspection without 401 barriers.
5. The Next.js backend intercepts the request and verifies the token cryptographically using the **Firebase Admin SDK** (`adminAuth.verifyIdToken(token)`).
6. The backend extracts the authenticated `uid` and resolves the employee's trusted profile directly from Firestore (`erp_emp`).
7. **Zero Client Trust:** In production, the backend never trusts client-supplied roles or permissions. All authorization decisions are computed server-side.

### 1.3 Token Refresh
Firebase ID tokens expire after 1 hour. In Flutter, calling `FirebaseAuth.instance.currentUser?.getIdToken(true)` forces a token refresh when an API call returns a `401 UNAUTHORIZED` error.

---

## 2. Standard Request & Response Envelopes

### 2.1 Success Response (`200 OK` / `201 Created`)
```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": { ... },
  "meta": {
    "total": 42,
    "page": 1,
    "limit": 20,
    "totalPages": 3
  }
}
```

### 2.2 Error Response (`400`, `401`, `403`, `404`, `429`, `500`)
```json
{
  "success": false,
  "error": "VALIDATION_ERROR",
  "message": "Input validation failed",
  "details": {
    "village": ["Village / Location is required before completing this activity."]
  }
}
```

#### Standard Error Codes:
| HTTP Status | Error Code | Description |
|---|---|---|
| `400` | `BAD_REQUEST` / `VALIDATION_ERROR` | Malformed JSON or input validation constraint failed. |
| `401` | `UNAUTHORIZED` | Missing, invalid, or expired Firebase ID token. |
| `403` | `FORBIDDEN` | Insufficient role permissions or accessing another user's data. |
| `404` | `NOT_FOUND` | Requested resource (activity, leave, report, employee) not found. |
| `429` | `RATE_LIMITED` | Too many requests in a short time window. |
| `500` | `INTERNAL_SERVER_ERROR` | Unexpected server failure. |

---

## 3. Role-Based Access Control (RBAC) Matrix

| Endpoint Area | Super Admin | Admin | Manager | Staff |
|---|:---:|:---:|:---:|:---:|
| `GET /api/v1/auth/me` | ✅ | ✅ | ✅ | ✅ |
| `GET /api/v1/profile` | ✅ | ✅ | ✅ | ✅ |
| `PATCH /api/v1/profile` | ✅ | ✅ | ✅ | ✅ |
| `GET /api/v1/attendance/today` | ✅ | ✅ | ✅ | ✅ |
| `POST /api/v1/attendance/check-in` | ✅ | ✅ | ✅ | ✅ |
| `POST /api/v1/attendance/check-out` | ✅ | ✅ | ✅ | ✅ |
| `GET /api/v1/attendance/history` | ✅ | ✅ | ✅ (Dept/Center) | ✅ (Self only) |
| `GET /api/v1/activities` | ✅ | ✅ | ✅ (Dept/Center) | ✅ (Self only) |
| `POST /api/v1/activities/start` | ✅ | ✅ | ✅ | ✅ |
| `PATCH /api/v1/activities/:id` | ✅ | ✅ | ❌ | ✅ (Own active only) |
| `POST /api/v1/activities/:id/end` | ✅ | ✅ | ❌ | ✅ (Own active only) |
| `POST /api/v1/activities/:id/evidence` | ✅ | ✅ | ❌ | ✅ (Own active only) |
| `GET /api/v1/activities/summary` | ✅ | ✅ | ✅ (Dept/Center) | ✅ (Self only) |
| `GET /api/v1/reports/monthly` | ✅ | ✅ | ✅ (Dept/Center) | ✅ (Self only) |
| `GET /api/v1/reports/monthly/export` | ✅ | ✅ | ✅ (Dept/Center) | ✅ (Self only) |
| `GET /api/v1/reports/daily/:date` | ✅ | ✅ | ✅ (Dept/Center) | ✅ (Self only) |
| `GET /api/v1/leaves` | ✅ | ✅ | ✅ (Dept/Center) | ✅ (Self only) |
| `POST /api/v1/leaves` | ✅ | ✅ | ✅ | ✅ |
| `PATCH /api/v1/leaves/:id` (Approve/Reject) | ✅ | ✅ | ✅ (Dept only) | ❌ |
| `PATCH /api/v1/leaves/:id` (Cancel own) | ✅ | ✅ | ✅ | ✅ (Pending only) |
| `GET /api/v1/admin/*` | ✅ | ✅ | ✅ (Scoped) | ❌ |
| `POST /api/v1/admin/employees` | ✅ | ✅ | ❌ | ❌ |
| `PATCH /api/v1/admin/employees/:id` | ✅ | ✅ | ❌ | ❌ |

---

## 4. Offline Synchronization & Idempotency

To support field operations in remote farming areas with unstable mobile connectivity:

1. **Client-Generated UUIDs:**
   When starting an activity offline, Flutter generates a UUID v4 and passes it as `clientActivityId`.
2. **Authoritative Server Timestamps:**
   The backend saves both the client event timestamp (`clientTimestamp`) and authoritative server recording timestamp (`createdAt`, `activityStartAt`, `activityEndAt`).
3. **Idempotent Start Replay:**
   If a network drop occurs while calling `POST /api/v1/activities/start`, Flutter safely retries with the same `clientActivityId`. The backend detects the existing document and returns `isIdempotentReplay: true` with `200 OK`, strictly preventing duplicate activities.
4. **Local Sync Status:**
   Every synchronized activity record returns `syncStatus: "synced"`.

---

## 5. API Endpoint Reference

### 5.1 Authentication & Profile

#### `GET /api/v1/auth/me`
Fetches the authenticated employee's verified account profile, role, department, center assignments, and permission flags.

- **Headers:** `Authorization: Bearer <TOKEN>`
- **Response `200 OK`:**
```json
{
  "success": true,
  "message": "Authentication successful",
  "data": {
    "uid": "emp_dayanand_01",
    "employeeId": "AGRI-EMP-8541",
    "fullName": "Dayanand Shinde",
    "email": "dayanand@agricartfpc.in",
    "phone": "+91 9876543210",
    "designation": "Field Officer",
    "role": "staff",
    "accountStatus": "active",
    "departmentId": "dept_field_ops",
    "departmentName": "Field Operations",
    "departmentCode": "OPS",
    "assignedCenterIds": ["ctr_pandur_01"],
    "assignedCenterNames": ["Agricart Pandur Center"],
    "centers": [
      {
        "id": "ctr_pandur_01",
        "name": "Agricart Pandur Center",
        "code": "PND",
        "address": "Pandur, Tal. Dindori, Nashik"
      }
    ],
    "emergencyContact": "+91 9822000000",
    "bio": "Field operations coordinator for Nashik region.",
    "joiningDate": "2024-01-15",
    "permissions": {
      "role": "staff",
      "isSuperAdmin": false,
      "isAdmin": false,
      "isManager": false,
      "isStaff": true,
      "canReviewReports": false,
      "canManageStaff": false,
      "canApproveLeaves": false,
      "canViewLiveMonitor": false,
      "canAccessAdminPanel": false
    }
  }
}
```

---

#### `GET /api/v1/profile`
Fetches comprehensive profile details of the authenticated employee.

- **Headers:** `Authorization: Bearer <TOKEN>`
- **Response `200 OK`:** Returns employee record with contact, center, and department information.

---

#### `PATCH /api/v1/profile`
Updates editable personal contact fields (`phone`, `emergencyContact`, `bio`).

- **Headers:** `Authorization: Bearer <TOKEN>`, `Content-Type: application/json`
- **Request Body:**
```json
{
  "phone": "+91 9876543210",
  "emergencyContact": "+91 9822112233",
  "bio": "Updated bio details"
}
```
- **Response `200 OK`:** Returns updated profile fields.

---

### 5.2 Attendance & Time Tracker

#### `GET /api/v1/attendance/today`
Returns the authenticated employee's daily attendance session for the current operational day (`Asia/Kolkata`).

- **Headers:** `Authorization: Bearer <TOKEN>`
- **Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "date": "2026-11-05",
    "hasSession": true,
    "state": "LOGGED_IN",
    "isCheckedIn": true,
    "isCheckedOut": false,
    "session": {
      "id": "att_emp_dayanand_01_2026-11-05",
      "employeeUid": "emp_dayanand_01",
      "employeeId": "AGRI-EMP-8541",
      "employeeName": "Dayanand Shinde",
      "date": "2026-11-05",
      "loginAt": "2026-11-05T09:15:30.000Z",
      "loginGps": {
        "latitude": 19.1862,
        "longitude": 73.0566,
        "accuracy": 14.2,
        "placeName": "Pandur Center, Nashik, Maharashtra",
        "capturedAt": "2026-11-05T09:15:30.000Z"
      },
      "loginLocationStatus": "captured",
      "logoutAt": null,
      "status": "active",
      "attendanceDurationMinutes": 0
    }
  }
}
```

---

#### `POST /api/v1/attendance/check-in`
Records employee daily check-in with device GPS coordinates. Prevents duplicate check-ins on the same day. Automatically closes lingering stale sessions from previous days at midnight.

- **Headers:** `Authorization: Bearer <TOKEN>`, `Content-Type: application/json`
- **Request Body:**
```json
{
  "gps": {
    "latitude": 19.1862,
    "longitude": 73.0566,
    "accuracy": 12.0,
    "placeName": "Pandur Center, Nashik, Maharashtra",
    "timestamp": "2026-11-05T09:15:30.000Z"
  },
  "locationStatus": "captured",
  "clientTimestamp": "2026-11-05T09:15:30.000Z"
}
```
- **Response `200 OK`:**
```json
{
  "success": true,
  "message": "Check-in recorded successfully",
  "data": {
    "session": { ... },
    "isNew": true,
    "state": "LOGGED_IN",
    "serverTimestamp": "2026-11-05T09:15:30.500Z"
  }
}
```

---

#### `POST /api/v1/attendance/check-out`
Records employee check-out with device GPS. Computes duration authoritatively server-side.

- **Headers:** `Authorization: Bearer <TOKEN>`, `Content-Type: application/json`
- **Request Body:**
```json
{
  "gps": {
    "latitude": 19.1862,
    "longitude": 73.0566,
    "accuracy": 10.5,
    "placeName": "Pandur Center, Nashik, Maharashtra",
    "timestamp": "2026-11-05T18:05:00.000Z"
  },
  "locationStatus": "captured",
  "clientTimestamp": "2026-11-05T18:05:00.000Z"
}
```
- **Response `200 OK`:**
```json
{
  "success": true,
  "message": "Check-out recorded successfully",
  "data": {
    "session": { ... },
    "state": "LOGGED_OUT",
    "durationMinutes": 530,
    "serverTimestamp": "2026-11-05T18:05:01.200Z"
  }
}
```

---

#### `GET /api/v1/attendance/history`
Returns attendance records for an employee.

- **Query Parameters:**
  - `month`: Month number (1–12) or `YYYY-MM`.
  - `year`: 4-digit year (e.g. `2026`).
  - `startDate`, `endDate`: Optional date bounds (`YYYY-MM-DD`).
  - `page`: Page index (default: 1).
  - `limit`: Page size (default: 31).
  - `employeeUid`: Target employee (Admin/Manager only).
- **Response `200 OK`:**
```json
{
  "success": true,
  "data": [ ... ],
  "meta": {
    "total": 24,
    "page": 1,
    "limit": 31,
    "totalPages": 1,
    "employeeUid": "emp_dayanand_01"
  }
}
```

---

### 5.3 Field Activities Lifecycle

#### `GET /api/v1/activities`
Lists recorded field activities for the authenticated employee with optional filtering.

- **Query Parameters:**
  - `date`: Single date filter (`YYYY-MM-DD`).
  - `startDate`, `endDate`: Date range filter.
  - `status`: `IN_PROGRESS` | `COMPLETED` | `ALL`.
  - `page`: Page index (default: 1).
  - `limit`: Items per page (default: 50).
- **Response `200 OK`:** Returns array of `FieldActivityRecord` objects.

---

#### `POST /api/v1/activities/start`
Starts a new field activity slot. Immediately captures starting GPS and creates a document in `erp_field_activities` with status `IN_PROGRESS`.

- **Headers:** `Authorization: Bearer <TOKEN>`, `Content-Type: application/json`
- **Request Body:**
```json
{
  "clientActivityId": "550e8400-e29b-41d4-a716-446655440000",
  "slotNumber": 1,
  "reportDate": "2026-11-05",
  "activityName": "farmer_visit",
  "activityNameLabel": "Farmer Visit",
  "village": "Pandur",
  "wadi": "Maliwadi",
  "activityType": "single_farmer",
  "farmerName": "Ramesh Patil",
  "totalParticipants": 1,
  "maleParticipants": 1,
  "femaleParticipants": 0,
  "gps": {
    "latitude": 19.1862,
    "longitude": 73.0566,
    "accuracy": 8.0,
    "placeName": "Pandur, Maharashtra"
  },
  "locationStatus": "captured",
  "clientTimestamp": "2026-11-05T10:00:00.000Z"
}
```
- **Response `201 Created`:**
```json
{
  "success": true,
  "message": "Activity started and saved to database",
  "data": {
    "activity": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "activityId": "550e8400-e29b-41d4-a716-446655440000",
      "slotNumber": 1,
      "reportDate": "2026-11-05",
      "activityStatus": "IN_PROGRESS",
      "activityStartAt": "2026-11-05T10:00:01.000Z",
      "activityStartLocation": {
        "latitude": 19.1862,
        "longitude": 73.0566,
        "placeName": "Pandur, Maharashtra"
      },
      "syncStatus": "synced"
    },
    "activityId": "550e8400-e29b-41d4-a716-446655440000",
    "serverTimestamp": "2026-11-05T10:00:01.000Z",
    "syncStatus": "synced"
  }
}
```

---

#### `GET /api/v1/activities/:id`
Fetches full details of a specific field activity by ID.

- **Headers:** `Authorization: Bearer <TOKEN>`
- **Response `200 OK`:** Full `FieldActivityRecord`.

---

#### `PATCH /api/v1/activities/:id`
Incrementally updates details of an in-progress field activity (notes, observations, farmer issues, support provided, participant numbers). Rejects modification if the activity is already completed.

- **Headers:** `Authorization: Bearer <TOKEN>`, `Content-Type: application/json`
- **Request Body:**
```json
{
  "observations": "Examined organic fertilizer trial on tomato crop.",
  "farmerIssues": "Early blight symptoms observed on foliage.",
  "supportProvided": ["organic_pesticide_recommendation", "soil_testing"],
  "followUpRequired": true,
  "followUpDetails": "Revisit in 5 days after bio-fungicide spray.",
  "followUpDate": "2026-11-10"
}
```
- **Response `200 OK`:** Returns merged updated activity record.

---

#### `POST /api/v1/activities/:id/end`
Completes the field activity. Captures ending GPS, computes duration server-side, validates required fields (village, observations, farmer name, participant counts), and marks status as `COMPLETED`.

- **Headers:** `Authorization: Bearer <TOKEN>`, `Content-Type: application/json`
- **Request Body:**
```json
{
  "endGps": {
    "latitude": 19.1865,
    "longitude": 73.0569,
    "accuracy": 9.5,
    "placeName": "Pandur, Maharashtra"
  },
  "locationStatus": "captured",
  "finalDetails": {
    "observations": "Examined organic fertilizer trial. Applied neem extract spray.",
    "supportProvided": ["soil_testing"]
  },
  "clientTimestamp": "2026-11-05T11:15:00.000Z"
}
```
- **Response `200 OK`:**
```json
{
  "success": true,
  "message": "Activity completed and verified successfully",
  "data": {
    "activity": { ... },
    "durationMinutes": 75,
    "activityStatus": "COMPLETED",
    "serverTimestamp": "2026-11-05T11:15:01.000Z",
    "syncStatus": "synced"
  }
}
```

---

#### `POST /api/v1/activities/:id/evidence`
Attaches photo or video evidence to an activity slot. Supports both multipart file upload and JSON URL submission.

- **Mode A: Multipart Form Data** (`Content-Type: multipart/form-data`)
  - Form Fields: `file` (Binary image/video), `caption` (Text).
- **Mode B: JSON Upload** (`Content-Type: application/json`)
  - Body: `{ "photoUrl": "https://res.cloudinary.com/...", "caption": "Tomato field inspection" }`
- **Response `200 OK`:**
```json
{
  "success": true,
  "message": "Evidence attached successfully",
  "data": {
    "activityId": "550e8400-e29b-41d4-a716-446655440000",
    "url": "https://storage.googleapis.com/...",
    "isVideo": false,
    "photoEvidence": ["https://storage.googleapis.com/..."],
    "updatedAt": "2026-11-05T11:16:00.000Z"
  }
}
```

---

#### `GET /api/v1/activities/summary`
Calculates consolidated daily totals across all activity slots recorded for a given date.

- **Query Parameters:** `date` (default: today), `employeeUid` (Admin/Manager only).
- **Response `200 OK`:**
```json
{
  "success": true,
  "data": {
    "date": "2026-11-05",
    "employeeUid": "emp_dayanand_01",
    "summary": {
      "totalActivities": 3,
      "totalActivityMinutes": 210,
      "totalActivityHours": 3.5,
      "firstActivityStart": "2026-11-05T09:30:00.000Z",
      "lastActivityEnd": "2026-11-05T15:45:00.000Z",
      "totalWorkingPeriodMinutes": 375,
      "totalWorkingPeriodHours": 6.3,
      "totalDeskJobMinutes": 0,
      "totalFieldActivityMinutes": 210,
      "totalParticipantContacts": 18,
      "totalMaleParticipants": 12,
      "totalFemaleParticipants": 6
    },
    "activitiesCount": 3,
    "inProgressCount": 0,
    "completedCount": 3,
    "validationErrors": []
  }
}
```

---

### 5.4 Monthly & Daily Reports

#### `GET /api/v1/reports/monthly`
Fetches the monthly report dataset for an employee. Strictly derives all metrics from actual Field Activity and Attendance records.

- **Query Parameters:** `month` (1–12), `year` (e.g. `2026`), `employeeUid` (optional).
- **Response `200 OK`:** Full monthly report object containing employee details, calendar days breakdown (1 row per calendar day), and monthly totals.

---

#### `GET /api/v1/reports/monthly/export`
Exports monthly report as a genuine **Excel (`.xlsx`) workbook** or **PDF**.

- **Query Parameters:**
  - `format`: `excel` (default) or `pdf`.
  - `month`: 1–12.
  - `year`: 4-digit year.
  - `employeeUid`: Target employee UID.
- **Response `200 OK`:**
  - `Content-Type`: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` (for Excel)
  - `Content-Type`: `application/pdf` (for PDF)

---

#### `GET /api/v1/reports/daily/:date`
Fetches the complete daily report for date `:date` (`YYYY-MM-DD`).

- **Query Parameters:**
  - `format`: `json` (default) or `pdf`.
  - `employeeUid`: Target employee UID (Admin/Manager only).
- **Behavior:**
  - When `format=pdf`: Returns the official verified **1-page Daily Field Report PDF** with human-readable locations.
  - When `format=json`: Returns JSON with activities, summary, and attendance session.

---

### 5.5 Leave Management

#### `GET /api/v1/leaves`
Lists leave requests. Staff can only access their own records; managers/admins can filter by employee, status, and year.

- **Query Parameters:** `status` (`pending`, `approved`, `rejected`, `all`), `year`, `staffUid`.
- **Response `200 OK`:** Array of `LeaveRecord` items.

---

#### `POST /api/v1/leaves`
Submits a new leave request. Automatically verifies date ranges, enforces minimum reason lengths, and performs overlap detection.

- **Headers:** `Authorization: Bearer <TOKEN>`, `Content-Type: application/json`
- **Request Body:**
```json
{
  "leaveType": "casual",
  "startDate": "2026-11-12",
  "endDate": "2026-11-14",
  "isHalfDay": false,
  "reason": "Family obligation in hometown"
}
```
- **Response `201 Created`:**
```json
{
  "success": true,
  "message": "Leave application submitted successfully",
  "data": {
    "leaveId": "leave_emp_dayanand_01_1762340000000",
    "status": "pending",
    "submittedAt": "2026-11-05T13:00:00.000Z"
  }
}
```

---

#### `PATCH /api/v1/leaves/:id`
- **Staff Action (Cancel own pending leave):**
  ```json
  { "action": "cancel" }
  ```
- **Admin/Manager Action (Approve / Reject):**
  ```json
  {
    "action": "approved"
  }
  ```
  or
  ```json
  {
    "action": "rejected",
    "rejectionReason": "Insufficient staff coverage during crop distribution."
  }
  ```

---

### 5.6 Admin Operations

#### `GET /api/v1/admin/employees`
Lists employees with filtering by department, center, role, and search keywords.

#### `POST /api/v1/admin/employees`
Provisions a new employee account in Firebase Auth and Firestore with an automatically generated unique Employee ID (`AGRI-EMP-XXXX`).

#### `PATCH /api/v1/admin/employees/:id`
Updates employee role, assigned centers, department, or activates/deactivates the account.

#### `GET /api/v1/admin/reports`
Admin view of field reports with multi-criteria filters.

#### `GET /api/v1/admin/attendance`
Admin view of attendance sessions across staff with real-time active/closed counts.

#### `GET /api/v1/admin/activities`
Admin view of field activities across the organization. Pass `view=live` to access the real-time operations monitor.

---

## 6. Complete Flutter Android Integration Guide

### 6.1 `pubspec.yaml` Dependencies
```yaml
dependencies:
  flutter:
    sdk: flutter
  firebase_core: ^3.6.0
  firebase_auth: ^5.3.1
  dio: ^5.7.0
  geolocator: ^13.0.1
  geocoding: ^3.0.0
  hive_flutter: ^1.1.0
  uuid: ^4.5.1
  intl: ^0.19.0
```

---

### 6.2 Dio Auth Interceptor (`auth_interceptor.dart`)
Automatically attaches the Firebase ID token to every outgoing request and handles token refresh on `401 UNAUTHORIZED`.

```dart
import 'package:dio/dio.dart';
import 'package:firebase_auth/firebase_auth.dart';

class AgricartAuthInterceptor extends Interceptor {
  final FirebaseAuth _auth = FirebaseAuth.instance;

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) async {
    final user = _auth.currentUser;
    if (user != null) {
      final token = await user.getIdToken();
      options.headers['Authorization'] = 'Bearer $token';
    }
    options.headers['Accept'] = 'application/json';
    return handler.next(options);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) async {
    // Token expired: attempt force refresh
    if (err.response?.statusCode == 401) {
      final user = _auth.currentUser;
      if (user != null) {
        try {
          final newToken = await user.getIdToken(true); // force refresh
          final RequestOptions requestOptions = err.requestOptions;
          requestOptions.headers['Authorization'] = 'Bearer $newToken';

          final dio = Dio();
          final response = await dio.fetch(requestOptions);
          return handler.resolve(response);
        } catch (_) {
          // Token refresh failed, force user to re-login
        }
      }
    }
    return handler.next(err);
  }
}
```

---

### 6.3 Agricart API Client (`agricart_api_client.dart`)

```dart
import 'package:dio/dio.dart';
import 'auth_interceptor.dart';

class AgricartApiClient {
  static const String baseUrl = 'https://erp.agricartfpc.in/api/v1';
  late final Dio _dio;

  AgricartApiClient() {
    _dio = Dio(BaseOptions(
      baseUrl: baseUrl,
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 15),
      headers: {'Content-Type': 'application/json'},
    ));
    _dio.interceptors.add(AgricartAuthInterceptor());
    _dio.interceptors.add(LogInterceptor(responseBody: true, requestBody: true));
  }

  // --- Auth & Profile ---
  Future<Map<String, dynamic>> getMe() async {
    final res = await _dio.get('/auth/me');
    return res.data['data'];
  }

  // --- Attendance ---
  Future<Map<String, dynamic>> getTodayAttendance() async {
    final res = await _dio.get('/attendance/today');
    return res.data['data'];
  }

  Future<Map<String, dynamic>> checkIn({
    required double latitude,
    required double longitude,
    double? accuracy,
    String? placeName,
  }) async {
    final res = await _dio.post('/attendance/check-in', data: {
      'gps': {
        'latitude': latitude,
        'longitude': longitude,
        'accuracy': accuracy,
        'placeName': placeName,
        'timestamp': DateTime.now().toUtc().toIso8601String(),
      },
      'locationStatus': 'captured',
    });
    return res.data['data'];
  }

  Future<Map<String, dynamic>> checkOut({
    required double latitude,
    required double longitude,
    double? accuracy,
    String? placeName,
  }) async {
    final res = await _dio.post('/attendance/check-out', data: {
      'gps': {
        'latitude': latitude,
        'longitude': longitude,
        'accuracy': accuracy,
        'placeName': placeName,
        'timestamp': DateTime.now().toUtc().toIso8601String(),
      },
      'locationStatus': 'captured',
    });
    return res.data['data'];
  }

  // --- Field Activities ---
  Future<Map<String, dynamic>> startActivity({
    required String clientActivityId,
    required int slotNumber,
    required String activityName,
    required String activityNameLabel,
    required String village,
    String? farmerName,
    required double latitude,
    required double longitude,
    double? accuracy,
    String? placeName,
  }) async {
    final res = await _dio.post('/activities/start', data: {
      'clientActivityId': clientActivityId,
      'slotNumber': slotNumber,
      'activityName': activityName,
      'activityNameLabel': activityNameLabel,
      'village': village,
      'farmerName': farmerName,
      'gps': {
        'latitude': latitude,
        'longitude': longitude,
        'accuracy': accuracy,
        'placeName': placeName,
      },
      'locationStatus': 'captured',
    });
    return res.data['data'];
  }

  Future<Map<String, dynamic>> endActivity({
    required String activityId,
    required String observations,
    required double latitude,
    required double longitude,
    double? accuracy,
    String? placeName,
    List<String>? supportProvided,
  }) async {
    final res = await _dio.post('/activities/$activityId/end', data: {
      'endGps': {
        'latitude': latitude,
        'longitude': longitude,
        'accuracy': accuracy,
        'placeName': placeName,
      },
      'locationStatus': 'captured',
      'finalDetails': {
        'observations': observations,
        'supportProvided': supportProvided ?? [],
      },
    });
    return res.data['data'];
  }

  Future<Map<String, dynamic>> attachEvidence({
    required String activityId,
    required String photoUrl,
    String? caption,
  }) async {
    final res = await _dio.post('/activities/$activityId/evidence', data: {
      'photoUrl': photoUrl,
      'caption': caption,
    });
    return res.data['data'];
  }

  // --- Leaves ---
  Future<Map<String, dynamic>> requestLeave({
    required String leaveType,
    required String startDate,
    required String endDate,
    required String reason,
    bool isHalfDay = false,
  }) async {
    final res = await _dio.post('/leaves', data: {
      'leaveType': leaveType,
      'startDate': startDate,
      'endDate': endDate,
      'reason': reason,
      'isHalfDay': isHalfDay,
    });
    return res.data['data'];
  }
}
```

---

### 6.4 Offline Synchronization Engine (`offline_sync_service.dart`)

```dart
import 'package:hive_flutter/hive_flutter.dart';
import 'package:uuid/uuid.dart';
import 'agricart_api_client.dart';

class OfflineSyncService {
  final AgricartApiClient _client;
  static const String boxName = 'offline_activity_queue';

  OfflineSyncService(this._client);

  /// Queue an activity start while offline
  Future<String> queueActivityStartOffline({
    required int slotNumber,
    required String activityName,
    required String activityNameLabel,
    required String village,
    String? farmerName,
    required double latitude,
    required double longitude,
    String? placeName,
  }) async {
    final box = await Hive.openBox(boxName);
    final clientActivityId = const Uuid().v4();

    await box.put(clientActivityId, {
      'action': 'START_ACTIVITY',
      'clientActivityId': clientActivityId,
      'slotNumber': slotNumber,
      'activityName': activityName,
      'activityNameLabel': activityNameLabel,
      'village': village,
      'farmerName': farmerName,
      'latitude': latitude,
      'longitude': longitude,
      'placeName': placeName,
      'queuedAt': DateTime.now().toIso8601String(),
    });

    return clientActivityId;
  }

  /// Synchronize all pending offline items to the ERP server
  Future<int> syncPendingQueue() async {
    final box = await Hive.openBox(boxName);
    int syncedCount = 0;

    for (final key in box.keys.toList()) {
      final item = box.get(key) as Map<dynamic, dynamic>;

      try {
        if (item['action'] == 'START_ACTIVITY') {
          await _client.startActivity(
            clientActivityId: item['clientActivityId'],
            slotNumber: item['slotNumber'],
            activityName: item['activityName'],
            activityNameLabel: item['activityNameLabel'],
            village: item['village'],
            farmerName: item['farmerName'],
            latitude: item['latitude'],
            longitude: item['longitude'],
            placeName: item['placeName'],
          );
          await box.delete(key);
          syncedCount++;
        }
      } catch (err) {
        // If server returns error or connection unavailable, keep in queue
        print('Sync item $key deferred: $err');
      }
    }

    return syncedCount;
  }
}
```

---

### 6.5 GPS Location Provider (`gps_helper.dart`)

```dart
import 'package:geolocator/geolocator.dart';
import 'package:geocoding/geocoding.dart';

class GpsHelper {
  static Future<Position?> getCurrentGps() async {
    bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      await Geolocator.openLocationSettings();
      return null;
    }

    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) return null;
    }
    if (permission == LocationPermission.deniedForever) return null;

    return await Geolocator.getCurrentPosition(
      desiredAccuracy: LocationAccuracy.high,
      timeLimit: const Duration(seconds: 12),
    );
  }

  static Future<String> getReadableAddress(double lat, double lng) async {
    try {
      final placemarks = await placemarkFromCoordinates(lat, lng);
      if (placemarks.isNotEmpty) {
        final p = placemarks.first;
        return [p.subLocality, p.locality, p.subAdministrativeArea, p.administrativeArea]
            .where((s) => s != null && s.isNotEmpty)
            .join(', ');
      }
    } catch (_) {}
    return 'Location coordinates captured';
  }
}
```

---

## 7. OpenAPI 3.0 Specification Summary

```yaml
openapi: 3.0.3
info:
  title: Agricart ERP Mobile API
  version: 1.0.0
  description: Secure REST API for Agricart ERP Flutter Android application.
servers:
  - url: https://erp.agricartfpc.in/api/v1
    description: Production Server
  - url: http://localhost:3000/api/v1
    description: Local Development Server
components:
  securitySchemes:
    FirebaseAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
security:
  - FirebaseAuth: []
paths:
  /auth/me:
    get:
      summary: Get authenticated employee details & permissions
      responses:
        '200':
          description: Verified user profile
  /attendance/today:
    get:
      summary: Get today's attendance session
  /attendance/check-in:
    post:
      summary: Start day with device GPS
  /attendance/check-out:
    post:
      summary: End day with device GPS
  /activities:
    get:
      summary: List field activities
  /activities/start:
    post:
      summary: Start an activity slot with starting GPS
  /activities/{id}/end:
    post:
      summary: End an activity slot with ending GPS
  /activities/{id}/evidence:
    post:
      summary: Upload / attach evidence
  /activities/summary:
    get:
      summary: Live daily summary totals
  /reports/monthly:
    get:
      summary: Get monthly report derived from Field Activities
  /reports/monthly/export:
    get:
      summary: Export monthly report as Excel or PDF
  /leaves:
    get:
      summary: List leave records
    post:
      summary: Submit a new leave application
```

---
*Agricart ERP • Mobile API Documentation v1 • Official Technical Specification*

