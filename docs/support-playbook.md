# TrainerApp — Support Playbook

> Phase 11 deliverable. Covers every known failure mode, what the user sees,
> and the resolution path. Update this file whenever a new failure mode is discovered in production.

---

## Browser & PWA Compatibility Matrix

| Feature | Chrome/Edge | Safari (iOS 16.4+) | Safari (iOS <16.4) | Firefox | Samsung Browser |
|---|---|---|---|---|---|
| Service Worker | ✅ | ✅ | ✅ | ✅ | ✅ |
| Offline fallback | ✅ | ✅ | ✅ | ✅ | ✅ |
| Install prompt (`beforeinstallprompt`) | ✅ | ❌ (Add to Home Screen only) | ❌ | ❌ | ✅ |
| Push notifications | ✅ | ✅ (16.4+, standalone only) | ❌ | ✅ | ✅ |
| Background sync | ✅ | ❌ | ❌ | ❌ | ✅ |
| IndexedDB | ✅ | ✅ | ✅ | ✅ | ✅ |
| Web Share API | ✅ | ✅ | ✅ | partial | ✅ |

### iOS-specific limitations (document in FAQ)

- **No install prompt:** iOS Safari never fires `beforeinstallprompt`. The app shows in-app iOS install instructions (Share → Add to Home Screen). This is a platform constraint, not a bug.
- **No push before iOS 16.4:** Push notifications require iOS 16.4+ AND the app must be installed to the home screen (standalone mode). Users on older iOS cannot receive push. Deferred post-launch.
- **Background sync unavailable on iOS:** Offline writes queued in the sync_log replay when the user reopens the app and comes online — but they don't sync automatically in the background while the app is closed. Expected behaviour on iOS.
- **Standalone mode required for push (iOS):** Even on 16.4+, push only works in installed PWA mode. Users visiting via Safari browser tab cannot receive push.

---

## Auth Failures

### Registration — duplicate email
**User sees:** "An account with this email already exists"
**Cause:** `POST /auth/register` — email already in `trainers` table
**Resolution:** Direct to login. If user forgot they registered, use "Forgot password" (deferred — tell them to contact support for now).

### Login — wrong credentials
**User sees:** "Invalid email or password"
**Cause:** Either email not found or password hash mismatch. Same message for both — intentional (prevents email enumeration).
**Resolution:** Verify the email used at registration. Password reset is deferred — support can update via DB:
```sql
-- Get trainer record
SELECT id, email FROM trainers WHERE email = 'user@example.com';
-- Then update password hash (requires generating new argon2id hash)
```

### Session expired — access token gone, refresh cookie missing
**User sees:** Redirected to `/login`
**Cause:** `trainer_refresh_token` httpOnly cookie expired (7-day TTL) or was cleared by browser privacy settings
**Resolution:** Log in again. If recurring, check browser is not blocking cookies for the Vercel domain.

### Refresh fails — X-Device-ID missing
**User sees:** "X-Device-ID header required" (401)
**Cause:** Frontend failed to send device ID header — should not happen in normal usage
**Resolution:** Hard refresh (`Cmd+Shift+R`). If persistent, clear site data.

### Token refresh — loop on page load
**User sees:** Spinner that never resolves, or immediate redirect to login
**Cause:** Auth store initialising while requests fire (race condition). Auth guard catches this.
**Resolution:** Wait 2s and refresh. If persistent, clear cookies and log in again.

---

## Email Verification Failures

### Verification link expired
**User sees:** "This verification link has expired. Please request a new one." on `/verify-email`
**Cause:** Token TTL is 24 hours. Link was clicked after expiry.
**Resolution:** User logs in, goes to dashboard, clicks "Send verification email" in the amber banner.

### Verification link already used
**User sees:** "This verification link has already been used."
**Cause:** Token `used_at` is set — single-use enforcement.
**Resolution:** If `emailVerified` is already `true`, no action needed. If not, request a new link from the dashboard banner.

### Never received verification email
**Cause options:** Resend API down at registration time (fire-and-forget, silently dropped), email in spam, wrong email address at registration.
**Resolution:** User requests resend from dashboard banner. 60s cooldown between requests.
**DB check:**
```sql
SELECT token_hash, expires_at, used_at, created_at
FROM email_verification_tokens
WHERE trainer_id = '<uuid>'
ORDER BY created_at DESC;
```

### Resend cooldown hit
**User sees:** "Please wait 60 seconds before requesting another verification email" (400)
**Cause:** `canResendVerification()` found a token created < 60s ago.
**Resolution:** Wait 60 seconds, try again. Rate limit also applied at route level (5/hour).

### Manual email verified (support action)
```sql
UPDATE trainers SET email_verified = true, updated_at = now()
WHERE email = 'user@example.com';
```

---

## Session Logging Failures

### Set log fails while offline
**User sees:** Set appears to log (optimistic UI), sync banner appears when offline
**What happens:** Write queued in `sync_log` table. Replays on reconnect.
**Resolution:** Come back online. App detects reconnect and replays. If sync fails to replay, check `sync_log`:
```sql
SELECT * FROM sync_log WHERE trainer_id = '<uuid>' AND synced_at IS NULL ORDER BY created_at;
```

### Session stuck in `in_progress`
**User sees:** Live session pill persists, cannot start a new session for the same client
**Cause:** App crashed mid-session, or user force-closed the app before tapping "End Session"
**Resolution:**
```sql
UPDATE sessions SET status = 'completed', updated_at = now()
WHERE id = '<session_uuid>' AND status = 'in_progress';
```

### Session exercise not found on set log
**User sees:** "Session exercise not found" (404)
**Cause:** Race condition — exercise was removed from session while sets were being logged
**Resolution:** Refresh session. Sets already logged are safe.

---

## Template Failures

### Templates fail to load (type column drift — past incident)
**What happened:** `template_type` enum column existed in Drizzle schema but was never applied to production DB. All template fetches failed with `column "type" does not exist`.
**Fix applied (2026-06-20):** Migration 001 applied directly to Railway.
**Prevention:** `npx drizzle-kit generate` must run before every schema deploy. See `Database-Management.md`.
**If recurs:** Check Railway logs for `column "X" does not exist`, run the missing migration.

### Template apply — exercises missing from session
**User sees:** Session created but workout blocks are empty
**Cause:** Template had no `templateExercises` rows (e.g. template was created with only block headers)
**Resolution:** Open template in builder, add exercises, re-apply.

---

## Report Failures

### CLIENT_NO_EMAIL
**User sees:** "This client has no email address. Add one to their profile before sending a report." (handled in `ReportPreviewModal`)
**Cause:** `POST /reports/send` called for a client with `email = null`
**Resolution:** Edit the client record, add their email, then send the report.
**Note:** This error code (`CLIENT_NO_EMAIL`) is handled only in `ReportPreviewModal`. If it surfaces elsewhere it will appear as a raw code — flag for fix.

### NO_SESSIONS_IN_PERIOD
**User sees:** "No sessions found in this period. Log at least one session before sending a report." (handled in `ReportPreviewModal`)
**Cause:** Report generation queried sessions for the period and found none
**Resolution:** Confirm the correct client and date range. Log a session if genuinely none exist.
**Note:** Same as above — only handled in `ReportPreviewModal`.

### Report job silently dropped (BullMQ failure)
**User sees:** "Report sent" UI state but client never receives email
**Cause:** BullMQ job enqueued but worker failed (Redis connection drop, Resend API error, unhandled exception in worker)
**Resolution:** Check Railway logs for `[report-worker]` errors. Resend can be triggered manually:
```sql
-- Confirm reportsSentCount did not increment (means job failed)
SELECT reports_sent_count, last_active_at FROM trainers WHERE id = '<uuid>';
```
No automated retry currently — job is fire-and-forget. Retry by re-sending from the UI.

### Resend API down
**Affects:** Report emails, verification emails
**User sees:** No email received. UI shows success (fire-and-forget pattern).
**Resolution:** Check [status.resend.com](https://status.resend.com). Retry when service recovers.

---

## Media Failures

### Cloudinary upload fails
**User sees:** "Upload failed" toast
**Cause:** Network drop mid-upload, Cloudinary rate limit, file too large, unsupported format
**Resolution:** Retry. For persistent failures check Cloudinary dashboard for quota.

### Exercise media broken (missing URL)
**User sees:** Placeholder shown in exercise detail instead of image/video
**Cause:** Cloudinary URL deleted externally, or exercise was seeded without media (expected for most seed exercises)
**Resolution:** Upload media via exercise edit flow. This is expected for most exercises — media population is Phase 9 (deferred).

### Wrong media type on progress photos
**User sees:** "Progress photos must be images. Video is for form check clips."
**Cause:** Video file uploaded to snapshot media endpoint (images only)
**Resolution:** Upload video to session exercise media endpoint instead. Upload image to snapshot.

---

## Service Worker & PWA Failures

### SW registration fails on first load
**User sees:** App works normally but offline support is absent (no service worker)
**Cause:** Browser privacy mode, HTTPS not enforced, or Vite build issue
**How to detect:** Chrome DevTools → Application → Service Workers → shows error
**Resolution:** Ensure app is served over HTTPS. Hard refresh. If browser is in private/incognito, SW registration is expected to fail on some browsers.

### SW update breaks cached assets (stale cache)
**User sees:** App loads stale JS after a deploy, blank screen, or JS errors referencing missing chunks
**Cause:** Old SW serving cached chunks that no longer exist on the CDN
**Resolution:** Clear site data: Chrome → Settings → Privacy → Clear browsing data → Cached images and files (for the Vercel domain). `cleanupOutdatedCaches` in the SW handles this automatically on update — but if the SW itself is stale it may not trigger.
**Support action:** Tell user to hard refresh (`Cmd+Shift+R`) or clear site data for `trainerapp.io`.

### App installed but shows blank screen
**Cause options:** SW serving a bad cached shell, or JS error on startup
**Resolution:** Clear site data, uninstall PWA, reinstall.
**Check:** Open in browser (not standalone) first — if it works there, the issue is SW cache.

### iOS: tapping "Add to Home Screen" option not visible
**User sees:** Safari share sheet without the Add to Home Screen option
**Cause:** iOS < 11.1, or user is in a WKWebView (e.g. opened from Twitter/Instagram in-app browser)
**Resolution:** Open in Safari directly (not in-app browser). The option is available in Safari's share sheet.

---

## Error Boundary (Unexpected App Crashes)

### Generic crash — ErrorBoundary triggered
**User sees:** "Something went wrong — Your data is safe. Refresh to continue."
**Resolution:** Tap "Try again" or "Go home". All server-side data is safe — ErrorBoundary only catches render errors.
**In production:** `error.message` is NOT shown (DEV only). If a user reports a specific error message, they are on a dev build.

### Session crash — SessionErrorBoundary triggered
**User sees:** Session overlay minimises to pill. "Session error — Your logged sets are safe. Try re-opening."
**Resolution:** Tap the session pill to re-open. Sets already logged are persisted server-side.

---

## Raw Error Codes — Known Issues

These API error strings are not human-readable and are handled by specific frontend components.
If they surface outside those components, they will appear as raw codes to the user.

| Code | Handled by | Risk if unhandled |
|---|---|---|
| `CLIENT_NO_EMAIL` | `ReportPreviewModal.tsx` | Appears as raw string in any other context |
| `NO_SESSIONS_IN_PERIOD` | `ReportPreviewModal.tsx` | Same |

**Recommendation:** Convert these to human-readable strings at the API level in a future pass.
For now they are safe because only `ReportPreviewModal` calls the endpoint that produces them.

---

## Database Quick-Reference (Support Actions)

Full commands in `docs/Database-Management.md`. Common support operations:

```sql
-- Look up trainer by email
SELECT id, email, email_verified, trainer_mode, subscription_tier
FROM trainers WHERE email = 'user@example.com';

-- Manually verify email
UPDATE trainers SET email_verified = true, updated_at = now()
WHERE email = 'user@example.com';

-- Fix stuck session
UPDATE sessions SET status = 'completed', updated_at = now()
WHERE id = '<uuid>' AND status = 'in_progress';

-- Check pending sync queue
SELECT * FROM sync_log WHERE trainer_id = '<uuid>' AND synced_at IS NULL;

-- Check email verification tokens
SELECT token_hash, expires_at, used_at, created_at
FROM email_verification_tokens
WHERE trainer_id = '<uuid>' ORDER BY created_at DESC;
```

---

## FAQ Stubs (for future help page)

- **I didn't get a verification email** → Check spam. Request a new one from your dashboard. Wait 60s between requests.
- **My session disappeared** → It may be in "planned" status. Check the Sessions tab.
- **The app won't install on my iPhone** → Open in Safari → tap the Share button → Add to Home Screen.
- **I'm offline but the app still works** → Correct behaviour. Sets logged offline will sync when you reconnect.
- **Push notifications don't work on my iPhone** → Requires iOS 16.4+ and the app must be installed to your home screen.
- **My client didn't receive their report** → Confirm their email is saved on their profile. Check spam. Re-send from their profile page.
