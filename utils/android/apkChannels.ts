export type AppChannel = 'live' | 'preview';

export type ApkBuildStatus = 'building' | 'ready' | 'failed';

export const APP_CHANNEL: AppChannel = process.env.NEXT_PUBLIC_APP_CHANNEL === 'preview' ? 'preview' : 'live';

export const APK_CHANNEL_CONFIG: Record<AppChannel, { releaseTag: string; assetName: string; appName: string; packageId: string }> = {
  live: {
    releaseTag: 'orderfast-android-live',
    assetName: 'orderfast-android-live.apk',
    appName: 'Orderfast',
    packageId: 'com.orderfast.app',
  },
  preview: {
    releaseTag: 'orderfast-android-preview',
    assetName: 'orderfast-android-preview.apk',
    appName: 'Orderfast Preview',
    packageId: 'com.orderfast.app.preview',
  },
};

export function getApkDownloadUrl(channel: AppChannel): string {
  const githubRepository = process.env.NEXT_PUBLIC_GITHUB_REPOSITORY;
  const config = APK_CHANNEL_CONFIG[channel];

  if (!githubRepository) return '#';
  return `https://github.com/${githubRepository}/releases/download/${config.releaseTag}/${config.assetName}`;
}
