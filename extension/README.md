# AI Job Applier browser extension

Fills the job application form you have open with an application you approved in the app, on sites
the applier service deliberately leaves alone: LinkedIn, Indeed, Totaljobs and SEEK.

It fills fields and highlights them. It never clicks Next, Submit or Apply, never opens pages on its
own, and does nothing until you press a button in its popup. Screening questions are listed for you
to answer, not guessed.

## Install

1. In the app's `.env`, set `WORKER_TOKEN` (e.g. `openssl rand -hex 32`) and restart it.
2. Open `chrome://extensions`, turn on **Developer mode**, choose **Load unpacked** and select this
   `extension` folder. It works in Chrome, Edge and Brave.
3. Click the extension icon, open **Settings**, and enter your app address
   (`http://localhost:3000`) and the same token.

If your app runs on another address or port, add it to `host_permissions` in `manifest.json` and
reload the extension.

## Use

1. Approve an application in the app's queue.
2. Open the job's application form in a tab.
3. Click the extension, find the application, and press **Fill this page**. The popup reports what
   it filled, what your profile is missing, and which screening questions need you.
4. **Attach CV** tries to attach your stored CV. Some uploaders reject files added this way; the
   popup says so, and then you attach it with the site's own button.
5. Check everything, submit on the site, then press **I applied** to move it out of the queue.

## Limits

- LinkedIn's Easy Apply runs in steps, so fill each step as you reach it.
- These sites restrict accounts for automated activity. This extension only acts when you click, but
  filling dozens of applications an hour still looks automated. Pace yourself.
- Fields you already typed in are never overwritten.
