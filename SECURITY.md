# Security Notes

## Apple credentials

Apple signing assets (e.g., `.p8`, `.p12`, `.mobileprovision`) must never be committed to git.
Store them in EAS secrets (base64-encoded) and load them during CI/EAS builds.

If any credentials were previously committed, rotate/revoke them immediately in the
Apple Developer portal and update the EAS secrets to the new values.
