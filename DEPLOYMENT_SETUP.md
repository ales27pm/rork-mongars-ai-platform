# iOS App Store Auto-Submission Setup

This guide explains how to configure automatic iOS app submission to App Store Connect using GitHub Actions and EAS.

## Prerequisites

1. **Expo Account** with EAS access
2. **Apple Developer Account** with App Store Connect access
3. **GitHub Repository** with Actions enabled

## Step 1: Configure EAS.json

Update your `eas.json` with the following submission configuration:

```json
{
  "cli": {
    "version": ">= 7.0.0",
    "appVersionSource": "remote"
  },
  "build": {
    "production": {
      "distribution": "store",
      "ios": {
        "simulator": false,
        "credentialsSource": "local",
        "autoIncrement": true
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "${APPLE_ID}",
        "ascAppId": "${ASC_APP_ID}",
        "appleTeamId": "${APPLE_TEAM_ID}",
        "sku": "${APP_SKU}",
        "ascApiKeyPath": "./private/AuthKey.p8",
        "ascApiKeyIssuerId": "${ASC_API_KEY_ISSUER_ID}",
        "ascApiKeyId": "${ASC_API_KEY_ID}"
      }
    }
  }
}
```

### Environment Variables Needed:

- `APPLE_ID`: Your Apple ID email
- `ASC_APP_ID`: Your app's App Store Connect ID (numeric ID from app URL)
- `APPLE_TEAM_ID`: Your Apple Developer Team ID
- `APP_SKU`: Your app's SKU (usually the bundle identifier)
- `ASC_API_KEY_ISSUER_ID`: App Store Connect API Key Issuer ID
- `ASC_API_KEY_ID`: App Store Connect API Key ID

## Step 2: Generate App Store Connect API Key

1. Go to [App Store Connect](https://appstoreconnect.apple.com/)
2. Navigate to **Users and Access** > **Keys** (under Integrations)
3. Click **+** to create a new key
4. Give it a name (e.g., "EAS GitHub Actions")
5. Select **Admin** or **App Manager** access
6. Click **Generate**
7. Download the `.p8` file (you can only download it once!)
8. Note down:
   - Key ID (e.g., `2X9R4HXF34`)
   - Issuer ID (UUID format, e.g., `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)

## Step 3: Configure GitHub Secrets

Add these secrets to your GitHub repository:

1. Go to **Settings** > **Secrets and variables** > **Actions**
2. Click **New repository secret** for each:

### Required Secrets:

```
EXPO_TOKEN
- Description: Expo access token for EAS CLI
- How to get: Run `npx expo login` then `npx eas whoami --json` and copy the token
- Or generate from: https://expo.dev/accounts/[username]/settings/access-tokens

EXPO_APPLE_APP_SPECIFIC_PASSWORD
- Description: App-specific password for your Apple ID
- How to get: https://appleid.apple.com/ > Sign In > App-Specific Passwords > Generate
- Note: This is different from your Apple ID password

ASC_API_KEY_ISSUER_ID
- Description: App Store Connect API Key Issuer ID
- Value: The Issuer ID from Step 2

ASC_API_KEY_ID
- Description: App Store Connect API Key ID  
- Value: The Key ID from Step 2

ASC_API_KEY_CONTENT
- Description: Content of the .p8 file
- Value: Copy the entire content of the .p8 file (including BEGIN/END lines)

APPLE_ID
- Description: Your Apple ID email
- Value: your@email.com

ASC_APP_ID
- Description: App Store Connect App ID
- How to get: Go to App Store Connect > Your App > App Information > Apple ID

APPLE_TEAM_ID
- Description: Your Apple Developer Team ID
- How to get: https://developer.apple.com/account/ > Membership Details > Team ID

APP_SKU
- Description: Your app's SKU
- Value: Usually your bundle identifier (app.27pm.monGARS)
```

## Step 4: Store API Key in Repository

Create a `private` directory in your project (add to .gitignore):

```bash
mkdir -p private
echo "private/" >> .gitignore
```

During CI/CD, the workflow will create the AuthKey.p8 file from the secret.

## Step 5: Update Workflow (Optional)

The `.github/workflows/ios-production.yml` file is already configured. You can customize:

### Trigger Options:
- **Push to main/production**: Automatically builds and submits
- **Manual dispatch**: Trigger manually with option to skip submission

### Build Options:
- Change `--wait` to `--no-wait` if you don't want to wait for build completion
- Adjust the build profile (`production`) if needed

## Step 6: Verify Setup

### Test Build Only:
```bash
eas build --platform ios --profile production
```

### Test Submission:
```bash
eas submit --platform ios --profile production --latest
```

### Trigger GitHub Action:
1. Push to `main` branch
2. Or go to **Actions** > **iOS Production Build & Submit** > **Run workflow**

## Workflow Behavior

### On Push to main/production:
1. ✅ Checkout code
2. ✅ Setup Node.js and EAS
3. ✅ Install dependencies
4. ✅ Build iOS app (wait for completion)
5. ✅ Submit to App Store Connect automatically

### On Manual Dispatch:
- Choose whether to submit after build
- Build ID is captured for later submission if needed

## Monitoring

- **EAS Dashboard**: https://expo.dev/accounts/[username]/projects/mongars/builds
- **GitHub Actions**: Check workflow runs under Actions tab
- **App Store Connect**: Verify submission under **TestFlight** or **App Store**

## Troubleshooting

### Build fails with "Invalid credentials"
- Verify `EXPO_TOKEN` is valid: `npx eas whoami`
- Regenerate if needed: https://expo.dev/accounts/[username]/settings/access-tokens

### Submit fails with "Authentication failed"
- Check `EXPO_APPLE_APP_SPECIFIC_PASSWORD` is correct
- Verify App Store Connect API key is valid
- Ensure Team ID and App ID match your account

### "App not found" error
- Verify `ASC_APP_ID` matches your app in App Store Connect
- Ensure app exists in App Store Connect before first submission

### Certificate/Provisioning issues
- Run `eas credentials` to manage iOS credentials
- Ensure your certificates are not expired
- Check Team ID matches your account

## Manual Submission

If auto-submission fails, you can submit manually:

```bash
# List recent builds
eas build:list --platform ios --limit 5

# Submit specific build
eas submit --platform ios --id BUILD_ID

# Submit latest build
eas submit --platform ios --latest
```

## Security Best Practices

1. ✅ Never commit `.p8` files to git
2. ✅ Use GitHub Secrets for all sensitive data
3. ✅ Rotate API keys periodically
4. ✅ Use minimum required permissions for API keys
5. ✅ Review GitHub Action logs for security issues

## Alternative: Using eas.json for credentials

Instead of GitHub Secrets, you can use eas.json with credential sources:

```json
{
  "submit": {
    "production": {
      "ios": {
        "appleId": "your@email.com",
        "ascAppId": "1234567890",
        "appleTeamId": "ABCD1234",
        "sku": "app.27pm.monGARS"
      }
    }
  }
}
```

Then run: `eas submit --platform ios` and it will prompt for password/credentials.

## Resources

- [EAS Submit Documentation](https://docs.expo.dev/submit/introduction/)
- [App Store Connect API](https://developer.apple.com/documentation/appstoreconnectapi)
- [GitHub Actions for Expo](https://docs.expo.dev/build/building-on-ci/)
