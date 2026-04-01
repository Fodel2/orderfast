const KIOSK_APK_RELEASE_TAG = process.env.NEXT_PUBLIC_KIOSK_APK_RELEASE_TAG ?? 'kiosk-debug-testing';
const KIOSK_APK_ASSET_NAME = process.env.NEXT_PUBLIC_KIOSK_APK_ASSET_NAME ?? 'orderfast-kiosk-debug.apk';
const GITHUB_REPOSITORY = process.env.NEXT_PUBLIC_GITHUB_REPOSITORY;

export const KIOSK_APK_DOWNLOAD_URL =
  (GITHUB_REPOSITORY
    ? `https://github.com/${GITHUB_REPOSITORY}/releases/download/${KIOSK_APK_RELEASE_TAG}/${KIOSK_APK_ASSET_NAME}`
    : '#');
