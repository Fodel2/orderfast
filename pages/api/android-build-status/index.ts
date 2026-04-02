import type { NextApiRequest, NextApiResponse } from 'next';
import type { AppChannel, ApkBuildStatus } from '@/utils/android/apkChannels';

type WorkflowRun = {
  event: string;
  head_branch: string;
  status: string;
  conclusion: string | null;
  html_url: string;
  updated_at: string;
};

function toChannel(value: string | string[] | undefined): AppChannel {
  return value === 'preview' ? 'preview' : 'live';
}

function selectRunForChannel(channel: AppChannel, runs: WorkflowRun[]): WorkflowRun | null {
  if (channel === 'live') {
    return runs.find((run) => run.event === 'push' && run.head_branch === 'main') || null;
  }

  return runs.find((run) => run.event === 'pull_request' || run.head_branch === 'preview') || null;
}

function mapStatus(run: WorkflowRun | null): ApkBuildStatus {
  if (!run) return 'failed';
  if (run.status !== 'completed') return 'building';
  return run.conclusion === 'success' ? 'ready' : 'failed';
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const channel = toChannel(req.query.channel);
  const repository = process.env.GITHUB_REPOSITORY_NAME;

  if (!repository) {
    return res.status(500).json({ error: 'GITHUB_REPOSITORY_NAME is not configured' });
  }

  try {
    const response = await fetch(`https://api.github.com/repos/${repository}/actions/workflows/android-apk.yml/runs?per_page=30`, {
      headers: {
        Accept: 'application/vnd.github+json',
      },
    });

    if (!response.ok) {
      const message = await response.text();
      return res.status(response.status).json({ error: `Failed to load workflow runs: ${message}` });
    }

    const payload = (await response.json()) as { workflow_runs?: WorkflowRun[] };
    const selected = selectRunForChannel(channel, payload.workflow_runs || []);
    const status = mapStatus(selected);

    return res.status(200).json({
      channel,
      status,
      run_url: selected?.html_url || null,
      updated_at: selected?.updated_at || null,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || 'Failed to read Android build status' });
  }
}
