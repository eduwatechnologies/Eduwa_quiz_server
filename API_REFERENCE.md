# Eduwa Quiz API Reference

Base URL: `{API_BASE_URL}/api` (e.g. `http://localhost:4000/api` in dev)

All requests/responses are JSON unless noted (file uploads use `multipart/form-data`).

---

## 1. Conventions

### Auth
Every route except `POST /auth/*` and `POST /auth/admin/signin` requires:

```
Authorization: Bearer <accessToken>
```

Access tokens expire quickly (default 15 min). Use `POST /auth/refresh` with the `refreshToken` to get a new pair — **refresh tokens rotate**, so always store the new one returned.

### Error shape
Every error follows the same envelope, regardless of status code:

```json
{
  "error": {
    "message": "Human-readable summary",
    "details": [ { "field": "email", "message": "Email is already registered" } ]
  }
}
```
`details` is only present for `422` validation errors.

| Status | Meaning |
|---|---|
| `400` | Bad request (malformed input the request itself is broken, not a validation shape) |
| `401` | Missing/invalid/expired token |
| `402` | Payment/token required — insufficient tokens for the requested AI feature |
| `403` | Forbidden — authenticated but not allowed (e.g. non-admin hitting `/admin/*`) |
| `404` | Not found |
| `409` | Conflict — e.g. duplicate payment reference, session already completed |
| `422` | Validation failed — see `details[]` |
| `500` | Server error |

### Pagination
List endpoints that paginate accept `?limit=&offset=` and return:
```json
{ "items": [ ... ], "count": 137 }
```

### IDs
All resource IDs are strings. `subjectId` is a human-readable slug (`"mathematics"`), everything else is a Mongo ObjectId string.

---

## 2. Auth — `/auth`

### `POST /auth/signup`
No auth required.

**Body**
```json
{
  "name": "Ada Lovelace",
  "email": "ada@example.com",
  "password": "secret123",
  "confirmPassword": "secret123",
  "course": "Computer Science",
  "examYear": "2026"
}
```

**201 Response**
```json
{
  "user": { "id": "...", "name": "...", "email": "...", "course": "...", "examYear": "...", "avatarUrl": null, "createdAt": "..." },
  "session": { "accessToken": "...", "refreshToken": "...", "expiresAt": "2026-09-15T12:15:00.000Z" },
  "onboarding": { "completed": false }
}
```
Also creates a token wallet seeded with `SIGNUP_BONUS_TOKENS` (default 1000).

### `POST /auth/signin`
**Body:** `{ "email": "...", "password": "..." }`
**200:** same shape as signup's response (minus onboarding being necessarily false).

### `POST /auth/refresh`
No Bearer header needed — the refresh token itself is the credential.
**Body:** `{ "refreshToken": "..." }`
**200:** `{ "accessToken": "...", "refreshToken": "...", "expiresAt": "..." }`
Old refresh token is revoked (rotation) — discard it after this call.

### `POST /auth/signout`
Auth required. **Body (optional):** `{ "refreshToken": "..." }` — revokes that session.
**204** No content.

### `POST /auth/forgot-password`
No auth. **Body:** `{ "email": "..." }`
**200:** `{ "message": "If that email is registered, a reset link has been sent." }`
Always returns this message regardless of whether the email exists (no account enumeration). A real email is sent via Resend if `RESEND_API_KEY` is configured.

### `POST /auth/reset-password`
No auth. **Body:** `{ "token": "...", "newPassword": "..." }` (token comes from the emailed reset link, valid 1 hour)
**200:** `{ "message": "Password has been reset. Please sign in again." }`
**400** if token invalid/expired. All existing sessions for the user are revoked.

---

## 3. User Profile — `/users`

All routes below require auth.

### `GET /users/me`
**200**
```json
{
  "id": "...", "name": "...", "email": "...", "course": "...", "examYear": "...",
  "avatarUrl": null, "createdAt": "...",
  "stats": { "questionsAnswered": 240, "averageScore": 71, "currentStreak": 4, "sessionsCompleted": 18 },
  "tokens": { "total": 1000, "used": 350, "remaining": 650 },
  "access": {
    "canUseAi": true, "canUseCoach": true,
    "aiQuizTokenCost": 50, "coachMessageTokenCost": 10
  },
  "onboarding": { "completed": true }
}
```

### `PUT /users/me`
**Body (all optional):** `{ "name", "email", "course", "examYear", "avatarUrl" }`
**200:** same shape as `GET /users/me`.

### `POST /users/me/password`
**Body:** `{ "currentPassword", "newPassword", "confirmPassword" }`
**204** on success. **422** if `currentPassword` is wrong.

### `POST /users/me/avatar`
`multipart/form-data` with a single field `avatar` (JPEG/PNG/WebP, ≤5MB).
**200:** `{ "avatarUrl": "https://..." }`
**400** if object storage isn't configured server-side, or the file fails validation.

### `GET /users/me/notifications` / `PUT /users/me/notifications`
See [§12 Notifications](#12-notifications--notifications--usersmenotifications).

### `GET /users/me/settings` / `PUT /users/me/settings`
See [§10 Settings](#10-settings--usersmesettings).

---

## 4. Onboarding — `/onboarding`

### `POST /onboarding/complete`
Auth required, no body.
**200:** `{ "completed": true }`

---

## 5. Subjects — `/subjects`

### `GET /subjects`
Auth required.
**200:** array of subjects with the current user's progress on each:
```json
[
  {
    "id": "mathematics", "name": "Mathematics", "shortName": "Math",
    "icon": "activity", "color": "#159A63", "topics": ["Algebra", "Geometry", ...],
    "progress": { "completed": 42, "total": 300 }
  },
  ...
]
```

### `GET /subjects/:subjectId`
**200:** single subject as above, plus `"availableYears": [2024, 2023, 2022, ...]` (descending) for the past-question picker.
**404** if unknown subjectId.

---

## 6. Questions — `/questions`

### `GET /questions?subjectId=&topic=&year=&limit=&offset=`
Auth required. `subjectId` is required; `topic`/`year` optional filters. Returns **past** questions only, **with answers included** (this is the browse/practice-bank endpoint, not a quiz session).
**200:** `{ "items": [ { "id", "subjectId", "topic", "year", "text", "options", "difficulty", "correctAnswer", "explanation" } ], "count": 812 }`

Admin-only create/update/delete for individual questions also exist at `POST /questions`, `PUT /questions/:id`, `DELETE /questions/:id` — prefer the `/admin/questions/*` routes in §14 which have the same behavior plus listing/filtering by source.

---

## 7. Quiz Sessions & Results

### `POST /quizzes/start`
Starts a **past-questions** quiz session. Auth required.
**Body**
```json
{ "subjectId": "mathematics", "topic": "Algebra", "year": 2023, "questionCount": 10 }
```
`topic`, `year` optional (omit to draw from the whole subject). `questionCount` defaults to 10, max 50.

**201**
```json
{
  "id": "sessionId", "subjectId": "mathematics", "subjectName": "Mathematics",
  "topic": "Algebra", "mode": "past", "year": 2023, "startedAt": "...",
  "questions": [ { "id", "subjectId", "topic", "year", "text", "options", "difficulty", "correctAnswer", "explanation" }, ... ]
}
```
Note: correct answers ARE included in the session payload (client should hide them until the user submits — don't rely on the server to hide them for this mode).

### `POST /quizzes/:sessionId/complete`
Submits answers and scores the session. Auth required.
**Body:** `{ "answers": { "<questionId>": "A", "<questionId>": "C", ... } }`

**200**
```json
{
  "id": "attemptId", "subjectName": "Mathematics", "topic": "Algebra", "mode": "past",
  "questions": [ ...same shape as session questions... ],
  "answers": { "...": "A" },
  "score": 8, "percentage": 80, "completedAt": "...",
  "review": [
    { "questionId": "...", "userAnswer": "B", "correctAnswer": "C", "isCorrect": false }
  ]
}
```
`review` only lists **incorrect** answers (for a "review what you got wrong" screen).
**404** unknown session. **409** if already completed.

*(This same endpoint handles AI-mode session completion too — see §8.)*

### `GET /results?subjectId=&limit=&offset=`
Auth required. Attempt history, most recent first.
**200:** `{ "items": [ { "id", "subjectName", "topic", "mode", "questionsCount", "score", "percentage", "completedAt" } ], "count": 46 }`

### `GET /results/:attemptId`
Full detail for one past attempt (same shape as the `complete` response above).

---

## 8. AI — Smart Practice & Voice Coach — `/ai`

**All `/ai/*` routes require a sufficient token balance** (`402` if not). There is no subscription — the wallet balance is the only access gate. Balances are debited only after a successful AI response, so a `402` never charges the user.

### `POST /ai/quizzes/generate`
**Body**
```json
{ "subjectId": "physics", "topic": "Mechanics", "difficulty": "Medium", "questionCount": 5 }
```
`difficulty` ∈ `Easy|Medium|Hard` (default `Medium`). `questionCount` 1–20 (default 5).

**201**
```json
{ "id": "sessionId", "mode": "ai", "questions": [ ...same shape as past-mode... ] }
```
Costs `AI_QUIZ_TOKEN_COST` tokens (default 50), deducted only after generation succeeds. Complete this session the same way as a past-mode one: `POST /quizzes/:sessionId/complete`.

### `POST /ai/coach/session`
Starts a coach conversation. **Body (optional):** `{ "voiceProfileId": "juniper-default" }`
**201:** `{ "sessionId": "...", "tokenCostPerInteraction": 10, "available": true }`

### `GET /ai/coach/suggestions`
Quick-prompt chips for the coach UI.
**200:** `[ { "icon": "trending-up", "label": "Performance", "samplePrompt": "How can I improve my average score?" }, ... ]`

### `POST /ai/coach/:sessionId/message`
Either JSON `{ "text": "..." }` **or** `multipart/form-data` with an `audio` file field (transcribed server-side via Whisper).

**200**
```json
{
  "transcribedText": "How am I doing this week?",
  "replyText": "You're averaging 71% right now...",
  "replyAudioUrl": "https://.../coach-audio/....mp3",
  "tokensUsed": 10,
  "remainingTokens": 640,
  "suggestions": ["Review my weakest topics", "Suggest a study plan for this week"]
}
```
- `transcribedText` is only present when the request was audio (omit/ignore it for text requests).
- `replyAudioUrl` is `null` if TTS isn't configured server-side — treat as text-only.
- Costs `COACH_MESSAGE_TOKEN_COST` tokens per message (default 10) — deducted after a successful reply.

---

## 9. Token Wallet — `/tokens`

### `GET /tokens`
**200:** `{ "total": 1000, "used": 350, "remaining": 650 }`

### `POST /tokens/buy`
**Body**
```json
{ "packId": "pack-1500", "paymentReference": "ref_from_paystack_or_flutterwave", "provider": "paystack" }
```
`packId` ∈ `pack-500 | pack-1500 | pack-5000`. Server verifies `paymentReference` with the provider before crediting — **never trust a client-side "success" flag**, always pass the real provider reference.

**200:** `{ "success": true, "tokensAdded": 1500, "newTotal": 2500, "newRemaining": 2150, "transactionId": "..." }`
**409** if that reference was already processed (idempotent — safe to retry with the same reference).

### `GET /tokens/transactions`
**200:** `{ "items": [ { "id", "type": "purchase"|"spend", "amount", "balanceAfter", "reason", "createdAt" } ] }`

---

## 10. Progress & Analytics — `/progress`

### `GET /progress/summary`
**200**
```json
{
  "overview": { "questionsAnswered": 240, "accuracy": 71, "sessionsCompleted": 18, "currentStreakDays": 4, "longestStreakDays": 11 },
  "weeklyPerformance": [ { "day": "Mon", "correct": 8, "total": 10 }, ... ],
  "bySubject": [ { "subjectId", "subjectName", "accuracy", "questionsAnswered", "completed", "total" }, ... ],
  "weakestTopics": [ { "subjectId", "topic", "accuracy" }, ... ],
  "nextFocusSuggestion": { "subjectId": "physics", "reason": "Has the most room to grow." }
}
```

### `GET /progress/subjects`
Just the `bySubject` array from above, standalone.

---

## 11. Notifications — `/notifications` & `/users/me/notifications`

### `GET /users/me/notifications`
Preferences.
**200**
```json
{
  "dailyReminder": true, "streakAlerts": true, "weeklySummary": false, "examCountdown": true,
  "reminderTime": "08:00", "timezone": "Africa/Lagos",
  "pushDeviceTokens": [ { "token": "ExponentPushToken[...]", "platform": "ios" } ]
}
```

### `PUT /users/me/notifications`
Same shape, all fields optional. Send `pushDeviceTokens` on login/app-open to register the device for push.
**Body example:** `{ "dailyReminder": false, "reminderTime": "19:30", "timezone": "Africa/Lagos" }`

### `GET /notifications`
Recent in-app notification feed.
**200:** `{ "items": [ { "id", "icon", "colorKey", "title", "text", "time", "read", "deepLink" } ], "hasUnread": true }`

### `POST /notifications/mark-all-read`
**204** No content.

---

## 12. Settings — `/users/me/settings`

### `GET /users/me/settings`
**200:** `{ "soundEffects": true, "haptics": true, "sponsoredContent": true, "reducedMotion": false, "dailyGoal": 10, "appVersion": "0.0.0", "contentVersion": "2026.01" }`

### `PUT /users/me/settings`
**Body (all optional):** `{ "soundEffects", "haptics", "sponsoredContent", "reducedMotion", "dailyGoal" }` — `dailyGoal` ∈ `10|20|30`.
`appVersion`/`contentVersion` are server-controlled and silently ignored if sent.

---

## 13. Home — `/home`

### `GET /home`
Single aggregation call for the home screen.
**200**
```json
{
  "greeting": "Good morning",
  "examPlan": "JAMB 2026 · CBT preparation",
  "streak": 4,
  "heroContinueSubject": { "id": "mathematics", "topic": "Algebra", "ofTotal": "0 of 10 questions", "progress": 0 },
  "stats": { "questionsDone": 240, "averageScore": "71%", "streak": "4 days" },
  "smartPracticePromo": { "ctaText": "Practice smarter with AI", "subText": "Personalized questions for any topic" },
  "dailyGoalProgress": { "target": 10, "completed": 6 }
}
```
`heroContinueSubject` is `null` if there's no in-progress session.

---

## 14. Ads — `/ads`

### `GET /ads/banner?placement=home`
**200 (has an ad to show):** `{ "skip": false, "id", "title", "subtitle", "cta", "url", "imageUrl" }`
**200 (nothing to show):** `{ "skip": true }` — always returned for users who disabled sponsored content in settings. Client should render nothing when `skip: true`.

---

## 15. Admin / CMS

All `/admin/*` routes require a Bearer token for a user with `role: "admin"`. Regular user tokens get `403`.

### Admin auth
`POST /auth/admin/signin` — **Body:** `{ "email", "password" }` (only succeeds for `role: "admin"` accounts).
**200:** same session shape as user signin.

### Subjects
| Method & path | Body | Notes |
|---|---|---|
| `GET /admin/subjects` | — | All subjects, no per-user progress |
| `POST /admin/subjects` | `{ "id", "name", "shortName", "icon", "color", "topics": [] }` | Upsert by `id` (slug) |
| `DELETE /admin/subjects/:subjectId` | — | `204` |

### Questions
| Method & path | Body | Notes |
|---|---|---|
| `GET /admin/questions?subjectId=&topic=&year=&source=&limit=&offset=` | — | `source` ∈ `past\|generated`; all filters optional |
| `POST /admin/questions` | `{ "subjectId", "topic", "year", "text", "options": [...], "correctAnswer", "explanation", "difficulty" }` | Creates a single `source: "past"` question |
| `PUT /admin/questions/:id` | partial of the above | |
| `DELETE /admin/questions/:id` | — | `204` |
| `POST /admin/questions/bulk-import` | `{ "questions": [ {...}, {...} ] }` | Each item same shape as create; inserted with `ordered: false` (one bad row doesn't block the rest) |

### Users
| Method & path | Body | Notes |
|---|---|---|
| `GET /admin/users?search=&limit=&offset=` | — | `search` matches name or email |
| `GET /admin/users/:id` | — | Includes stats |
| `GET /admin/users/:id/attempts?limit=&offset=` | — | That user's quiz attempt history |
| `POST /admin/users/:id/refund-tokens` | `{ "amount", "reason" }` | Credits tokens without a payment record |
| `POST /admin/users/:id/ban` | `{ "banned": true }` | Sets `status: "blocked"` (or `"active"` if `false`) — blocked users can't sign in |

### Ad campaigns
| Method & path | Body | Notes |
|---|---|---|
| `GET /admin/ads?placement=home` | — | |
| `POST /admin/ads` | `{ "placement", "title", "subtitle", "cta", "url", "imageUrl", "active", "weight" }` | |
| `PUT /admin/ads/:id` | partial of the above | |
| `DELETE /admin/ads/:id` | — | `204` |

### Analytics
`GET /admin/usage-summary`
**200**
```json
{
  "dau": 312, "mau": 4210, "totalUsers": 5800,
  "tokensSoldRevenueNGN": 1250000,
  "tokensPurchased": 180000, "tokensSpent": 143500,
  "generatedAt": "..."
}
```

---

## 16. Frontend integration checklist

1. **Store `accessToken` in memory** (not localStorage, to reduce XSS exposure) and `refreshToken` in a secure place (Expo SecureStore / httpOnly cookie if you add a BFF). On `401`, call `/auth/refresh` once and retry the original request; on a second `401`, force sign-out.
2. **Register the push token** right after login and whenever it changes: `PUT /users/me/notifications` with `pushDeviceTokens`.
3. **Gate AI features client-side too** (don't just rely on the `402`) — check `GET /users/me` → `access.canUseAi` / `access.canUseCoach` and `tokens.remaining` before showing the Smart Practice / Coach entry points, and show the `402` error message directly when it does happen (it's already user-facing copy). Tokens are the only access gate; there is no subscription to check.
4. **Quiz flow:** `POST /quizzes/start` → render `questions[]` (hide `correctAnswer`/`explanation` in the UI until submit) → collect answers keyed by `question.id` → `POST /quizzes/:sessionId/complete` → render `review[]` for the wrong-answers screen.
5. **Ads:** always check `skip` before rendering anything from `GET /ads/banner` — don't render a loading/empty ad slot for `skip: true`.
6. **Admin panel:** treat `/admin/*` exactly like the rest of the API (same Bearer header, just from an admin sign-in) — no separate admin SDK needed.
