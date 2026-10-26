# Gmail API setup for Render Free

The backend supports EMAIL_PROVIDER=gmail for HTTPS delivery and EMAIL_PROVIDER=smtp (default) for the existing SMTP delivery. Verification and password reset use the same branded templates with either provider. No customer Gmail authorization is needed; only the business sender authorizes access.

## Connect the sender

1. Sign in to https://console.cloud.google.com/ as dydclothes.admin@gmail.com. Select or create a project and enable Gmail API in the API Library.
2. Configure Google Auth Platform branding and audience. While in Testing, add the business Gmail address as a test user. Add only the scope https://www.googleapis.com/auth/gmail.send for sending mail.
3. Create an OAuth client of type Web application. Set its authorized redirect URI to https://developers.google.com/oauthplayground .
4. Open https://developers.google.com/oauthplayground . In the gear settings, enable Use your own OAuth credentials and enter that client ID and secret. Use Server-side flow and Offline access.
5. Enter https://www.googleapis.com/auth/gmail.send as the scope and select Authorize APIs. Sign in as dydclothes.admin@gmail.com and approve sending permission.
6. Exchange the authorization code for tokens. Store the refresh token privately in backend/.env or Render's environment settings. Do not use the short-lived access token and do not paste secrets into chat or source control.

Using your own OAuth credentials avoids Playground's default 24-hour refresh-token revocation. Google's separate Testing-mode rule still expires Gmail refresh tokens after seven days. Before customer use, review production publishing and any applicable OAuth verification requirements. Publishing does not itself mean Google has verified the app. A refresh token can still be revoked; reauthorize if needed. Once setup is complete, the Playground redirect URI can be removed from the client.

## Render Environment

Deploy the latest backend code and set:

```env
EMAIL_PROVIDER=gmail
GMAIL_SENDER=dydclothes.admin@gmail.com
GMAIL_CLIENT_ID=<your client ID>
GMAIL_CLIENT_SECRET=<your client secret>
GMAIL_REFRESH_TOKEN=<your refresh token>
PUBLIC_SITE_URL=https://dyd-cloths.onrender.com
```

SMTP variables are ignored in Gmail mode. The Gmail App Password is not an OAuth refresh token. Save and redeploy. Request a verification email or password reset from the live site and confirm receipt, including checking spam, and that its link uses the public site address. Existing localhost links do not change.

## Behavior and verification

The API transport uses HTTPS only. Nodemailer builds a MIME message containing both HTML and plain text without opening an SMTP connection. Access tokens are cached with expiry and simultaneous refreshes share one request. An HTTP 401 triggers one refresh/retry. Quota failures and network timeouts are not blindly retried, because a request may already have sent the email. Error messages exclude credentials and provider response bodies. Gmail acceptance is not a guarantee of inbox delivery.

Run `node --test tests/gmailDelivery.test.js` from backend to test MIME generation, token reuse, rejected credentials and quota handling with mocked HTTP calls. These tests send no emails.

Official references:
- https://developers.google.com/oauthplayground/
- https://developers.google.com/workspace/gmail/api/guides/sending
- https://developers.google.com/identity/protocols/oauth2
