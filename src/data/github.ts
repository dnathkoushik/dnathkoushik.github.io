/**
 * GITHUB. Drives the /github page.
 *
 * `liveStatsEnabled: true` makes the page fetch your public profile and the
 * pinned repositories from the unauthenticated GitHub REST API at runtime.
 * There is no token involved and there must never be one — this bundle is
 * public. Anonymous requests are rate limited to 60/hour per IP, so responses
 * are cached in sessionStorage for an hour and every failure falls back to a
 * designed "unavailable" state rather than an error.
 */

import type { GithubConfig } from '@/types/portfolio'

export const githubConfig = {
  username: 'dnathkoushik',
  profileUrl: 'https://github.com/dnathkoushik',
  /** Spotlighted repositories, in this order. */
  pinnedRepos: [
    'dnathkoushik/huffman_file_compressor',
    'dnathkoushik/metro-route-planner',
    'dnathkoushik/AZ-Problem-Tracker-Chrome-Extension',
    'dnathkoushik/metro-navigator',
    'dnathkoushik/Process_scheduling_OS',
    'dnathkoushik/Satellite-Image-Clustering',
  ],
  liveStatsEnabled: true,
} satisfies GithubConfig
