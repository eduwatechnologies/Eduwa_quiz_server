# Eduwa Quiz — Backend API

Node.js / Express + MongoDB backend implementing the full Eduwa Quiz feature spec: JAMB past-question practice, AI-powered Smart Quizzes, a voice study coach, token wallets, progress tracking, and notifications. AI features are paid for with tokens — there is no subscription.

Built to match `feature.md` section-for-section — see the mapping table below.

---

## 1. Quick start

See **[API_REFERENCE.md](./API_REFERENCE.md)** for the full endpoint-by-endpoint frontend integration guide (auth flow, request/response shapes, error format, and an integration checklist).

```bash
cd eduwa-backend
cp .env.example .env        # then fill in real secrets
npm install
npm run seed                # creates the 5 JAMB subjects + an admin user
npm run seed:admin          # re-run just the admin bootstrap (idempotent)
npm run seed:admin:reset    # ...and reapply ADMIN_BOOTSTRAP_PASSWORD
npm run dev                 # nodemon, or `npm start` for plain node
```

The API listens on `http://localhost:4000` by default. Health check: `GET /health`.

### Admin dashboard login

Set `ADMIN_BOOTSTRAP_EMAIL` / `ADMIN_BOOTSTRAP_PASSWORD` in `.env` (optionally `ADMIN_BOOTSTRAP_NAME`), then run `npm run seed:admin`. The dashboard signs in with those credentials against `POST /api/auth/admin/signin`, which only accepts `role: "admin"`.

The script is safe to re-run. It promotes an existing account with the same email to `admin` (a normal sign-up would otherwise make admin sign-in fail with 401), unblocks it if needed, and ensures a token wallet exists. Changing the password in `.env` has no effect on an existing account until you run `npm run seed:admin:reset`.

**Requirements:** Node 18+, a MongoDB instance (local `mongod`, Docker, or Atlas — set `MONGODB_URI` accordingly).

### Minimum viable `.env`
At minimum you need `MONGODB_URI`, `JWT_ACCESS_SECRET`, and `JWT_REFRESH_SECRET` to boot and use auth/quiz/progress endpoints. Everything else (AI providers, payments, push, email/SMS) has a safe **mock fallback** so you can develop end-to-end before wiring up real third-party keys — see section 4.

---

## 2. Project structure

```
src/
  app.js            Express app assembly (middleware, routes, error handler)
  server.js         Entrypoint: loads .env, connects DB, starts HTTP server
  config/           DB connection, token pack definitions, AI token costs
  models/           17 Mongoose schemas (one per data-model table in the spec)
  middleware/       requireAuth, requireAdmin, validate, errorHandler
  validators/       Zod schemas per resource
  controllers/      Business logic, one file per resource
  routes/           Express routers, one file per resource, mounted in routes/index.js
  services/         External integrations: aiService, paymentService, pushService,
                     walletService (token credit/debit), statsService (streaks, averages)
  seed/             seedSubjects.js (subjects/topics), seedAdmin.js (admin login),
                   seedQuestions.js (past-question bank)
```

---

## 3. Endpoint map (spec section → routes)

| Spec section | Base path | Notes |
|---|---|---|
| 1. Auth & Account | `/api/auth/*`, `/api/users/me*`, `/api/onboarding/complete` | JWT access + refresh, rotated on `/refresh` |
| 2. Subjects & Questions | `/api/subjects`, `/api/questions` | Admin CRUD gated by `role: admin` |
| 3. Quiz Sessions (past) | `/api/quizzes/start`, `/api/quizzes/:id/complete`, `/api/results*` | Shared `complete` handler also used by AI mode |
| 4. Smart Practice (AI) | `/api/ai/quizzes/generate` | Token balance check → 402 if insufficient; debited only after successful generation |
| 5. Voice Coach | `/api/ai/coach/*` | Same token gating, debited per message; text messages work out of the box, audio needs a transcription step wired in (see §4) |
| 6. Token Wallet | `/api/tokens*` | `/buy` verifies `paymentReference` server-side before crediting |
| 7. Progress & Analytics | `/api/progress/*` | Streaks, weekly performance, weakest topics computed live from attempt history |
| 8. Notifications | `/api/notifications*`, `/api/users/me/notifications` | Push fan-out itself is a stub — see §4 |
| 9. Settings | `/api/users/me/settings` | `appVersion`/`contentVersion` are server-set, never accepted from the client |
| 10. Home | `/api/home` | Aggregates streak, stats, daily goal, continue-session card |
| 11. Ads | `/api/ads/banner` | Auto-skips if the user disabled sponsored content in settings |
| 12. Admin/CMS | `/api/auth/admin/signin`, `/api/admin/*` | Requires a user with `role: admin` (created via seed script or promoted manually) |

Full request/response shapes match `feature.md` exactly — controllers were written directly against those JSON examples.

---

## 4. What's real vs. stubbed

This scaffold is fully wired end-to-end (auth, quiz logic, scoring, token math, streaks, admin) with **real business logic** — nothing in the core flow is fake. AI generation, coach replies, transcription, payment verification, and password reset emails all make real calls to their providers **when you supply API keys** — with clearly-labeled mock fallbacks so the app is still fully testable without any keys at all:

| Integration | File | Behavior with API key set | Behavior with no key |
|---|---|---|---|
| AI quiz generation | `services/aiService.js` | Real call to OpenAI (`gpt-4o-mini`) or Gemini (`gemini-1.5-flash`), parsed as JSON | Deterministic mock questions, clearly labeled |
| Voice coach replies | `services/aiService.js` | Real call, with the user's real stats injected into the system prompt | Mock reply built from the same real stats |
| Voice coach audio transcription | `services/aiService.js` → `transcribeAudio` | Real OpenAI Whisper call | Returns a clear 400 telling you to set `OPENAI_API_KEY` |
| Payment verification (Paystack/Flutterwave) | `services/paymentService.js` | Real server-side verification against the provider | Auto-verifies as success in dev, so purchase flows stay testable |
| Password reset email | `services/emailService.js` | Real send via Resend | Logs the email content (including the real reset link) to the console |
| Push notifications (Expo) | `services/pushService.js` | Real call to Expo's push API | Logs what *would* be sent |
| TTS for coach replies (ElevenLabs) | `services/aiService.js` → `synthesizeSpeech` | Real call, audio uploaded to object storage, public URL returned | Returns `null` (client shows text-only) |
| Avatar uploads | `controllers/userController.js` → `uploadAvatar` | Real upload to S3/R2/Supabase Storage | Returns a clear 400 telling you to configure storage |
| Object storage (S3/R2/Supabase) | `services/storageService.js` | Backs both TTS audio and avatar uploads — one client, set `S3_ENDPOINT` for R2/Supabase or leave blank for AWS S3 | Both features above degrade gracefully instead of crashing |
| Scheduled pushes (daily reminder, streak alert, weekly summary, exam countdown) | `jobs/notificationJobs.js` | **Implemented.** Four `node-cron` schedules, registered at boot when `ENABLE_CRON=true` | — |

**Still not wired (smaller, lower-priority pieces):**
- **Multi-instance cron safety** — `registerNotificationJobs()` assumes a single server instance. If you scale horizontally, either move cron to a dedicated worker process or add leader-election so jobs don't fire N times.
- **Google TTS** as an alternative to ElevenLabs — `GOOGLE_TTS_API_KEY` is read from `.env` but not yet called; `synthesizeSpeech` currently only implements the ElevenLabs path.

To go live with what's already wired: just fill in the relevant `.env` keys (`OPENAI_API_KEY`, `PAYSTACK_SECRET_KEY`/`FLUTTERWAVE_SECRET_KEY`, `RESEND_API_KEY`, `EXPO_ACCESS_TOKEN`, `ELEVENLABS_API_KEY`, `S3_*`) — no code changes needed.

### Notification cron jobs — details

Set `ENABLE_CRON=true` to register all four jobs at server startup:

- **Daily reminder** — runs every minute, fires once per user at their `NotificationPreference.reminderTime` (default `08:00`) in their `timezone` (default `Africa/Lagos`), deduped per calendar day.
- **Streak alert** — runs hourly, fires when a user with `streakAlerts` enabled hasn't completed a quiz attempt in 18+ hours, deduped per inactivity gap.
- **Weekly summary** — runs Mondays at 09:00 server time, for users with `weeklySummary` enabled who completed at least one session.
- **Exam countdown** — runs daily at 07:00 server time, fires at 30/7/1 days before `JAMB_EXAM_DATE` (set this in `.env`), deduped so each threshold only fires once.

All four call `services/notificationDispatchService.js`, which both writes an in-app `Notification` row and fans out to any registered `PushDeviceToken`s via Expo.

---

## 5. Design notes worth knowing

- **Tokens are the only access gate for AI features**, enforced server-side: the balance is checked before any AI call and `debitTokens` throws `402 Payment Required` with the same messaging the spec calls for. Costs live in one place (`config/tokenCosts.js`) so the profile payload and the controllers can't disagree.
- **Streaks** are computed from `QuizAttempt.completedAt` timestamps (distinct calendar days, UTC), not a separately-maintained counter — so they can never drift out of sync with actual activity.
- **AI-generated questions are saved to the question bank** (`source: "generated"`) exactly as the spec requires ("Saves questions to an AI-question bank for reuse").
- **Review arrays only include incorrect answers**, matching the example in spec §3.2.
- **Payment idempotency**: `/tokens/buy` checks for an existing successful transaction with the same `paymentReference` before crediting anything twice.
- **Admin routes** use a separate `POST /api/auth/admin/signin` that only accepts users with `role: "admin"` — create or repair that account with `npm run seed:admin` using the `ADMIN_BOOTSTRAP_*` env vars.

---

## 6. Suggested next steps

1. `npm run seed`, then use `/api/admin/questions/bulk-import` (or direct DB inserts) to load real past-question banks per subject/topic/year.
2. Add real Paystack/Flutterwave keys once you're ready to accept live payments — verification logic is already correct, it just no-ops in mock mode.
3. Set up an S3-compatible bucket (Cloudflare R2 is the cheapest for this use case) to enable avatar uploads and TTS audio hosting.
4. Consider adding integration tests (e.g. `supertest` + `mongodb-memory-server`) — the modular controller/route split makes this straightforward to add incrementally.
5. If you scale beyond one server instance, move `registerNotificationJobs()` into a dedicated worker/cron process so scheduled pushes don't fire multiple times.
# Eduwa_quiz_admin
# Eduwa_quiz_server
