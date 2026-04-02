const KIOSK_APK_RELEASE_TAG = process.env.NEXT_PUBLIC_KIOSK_APK_RELEASE_TAG ?? 'kiosk-taptopay-release-testing';
const KIOSK_APK_ASSET_NAME = process.env.NEXT_PUBLIC_KIOSK_APK_ASSET_NAME ?? 'orderfast-kiosk-taptopay-release.apk';
const GITHUB_REPOSITORY = process.env.NEXT_PUBLIC_GITHUB_REPOSITORY;

export const KIOSK_APK_DOWNLOAD_URL =
  (GITHUB_REPOSITORY
    ? `https://github.com/${GITHUB_REPOSITORY}/releases/download/${KIOSK_APK_RELEASE_TAG}/${KIOSK_APK_ASSET_NAME}`
    : '#');
