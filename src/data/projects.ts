/**
 * PROJECTS. Newest first — the page sorts by `date`, and `featured` lifts an
 * entry into the highlights row.
 *
 * `image` is optional: with no image the card renders a deterministic gradient
 * derived from the project id, so nothing is ever a broken <img>. To add a
 * screenshot, drop it in `public/` and set `image: 'my-shot.png'`.
 */

import type { Project } from '@/types/portfolio'

export const projects = [
  {
    id: 'metro-navigator',
    name: 'Metro Navigator',
    summary:
      'Full-stack metro navigation system that finds optimal routes across a network, accounting for interchanges.',
    description:
      'A browser front-end over the same graph work as the C++ route planner, extended into a full-stack application. Models a metro network as a weighted graph and returns the optimal route between two stations along with interchanges, total distance and estimated travel time.',
    technologies: ['JavaScript', 'Node.js', 'Graph Algorithms'],
    githubUrl: 'https://github.com/dnathkoushik/metro-navigator',
    featured: false,
    date: '2026-01-29',
    status: 'shipped',
    keyFeatures: [
      'Shortest-path search over a weighted station graph.',
      'Reports interchanges, distance and estimated travel time, not just the station list.',
      'Full-stack: routing logic behind an API rather than computed in the page.',
    ],
  },
  {
    id: 'huffman-compressor',
    name: 'Text File Compressor',
    summary:
      'Browser-based lossless compressor implementing Huffman coding end to end, with a consistent 50–60% size reduction.',
    description:
      'A complete Huffman coding pipeline running entirely in the browser: character frequency analysis, priority-queue tree construction, bit-level encoding and decoding, and a visualisation of the tree that was built. Written to understand the algorithm from the bits up rather than to wrap a library — the encoder packs bits manually, which is where most of the interesting work is.',
    technologies: ['JavaScript', 'HTML/CSS', 'Data Structures'],
    githubUrl: 'https://github.com/dnathkoushik/huffman_file_compressor',
    featured: true,
    date: '2025-07-01',
    status: 'shipped',
    keyFeatures: [
      'Full pipeline: frequency analysis, priority-queue tree construction, bit-level encode and decode.',
      'Consistent 50–60% size reduction on text input.',
      'Zero-loss round-trip — decoding reproduces the original file byte for byte.',
      'Renders the generated Huffman tree so the encoding is inspectable, not a black box.',
    ],
  },
  {
    id: 'az-problem-tracker',
    name: 'AZ Problem Tracker',
    summary:
      'Chrome extension that reads the problem statement and your code off the page and answers questions about them.',
    description:
      'An in-browser coding companion built as a Chrome extension. It parses the problem statement and the user’s current code directly from the DOM and by intercepting XHR traffic, then passes them to the Gemini API for contextual help. Renders responses as Markdown, supports speech through the Web Speech API, and persists sessions through the Chrome Extension storage APIs so context survives a page reload.',
    technologies: ['JavaScript', 'Chrome Extensions', 'Gemini API', 'Web Speech API'],
    githubUrl: 'https://github.com/dnathkoushik/AZ-Problem-Tracker-Chrome-Extension',
    featured: true,
    date: '2025-06-22',
    status: 'shipped',
    keyFeatures: [
      'Extracts problem text and live user code via DOM parsers and XHR interceptors.',
      'Markdown rendering for model responses.',
      'Web Speech API support for spoken output.',
      'Sessions persisted through the Chrome Extension storage APIs.',
    ],
  },
  {
    id: 'metro-route-planner',
    name: 'Metro Route Planner',
    summary:
      'Modular C++ CLI over a 50-station network, using BFS for unweighted and Dijkstra for weighted shortest paths.',
    description:
      'A command-line route planner written to get graph algorithms right in a language with no safety net. Models a 50-station metro network and answers shortest-path queries two ways — breadth-first search when every hop costs the same, Dijkstra’s algorithm when edges are weighted by travel time — returning the route, the journey time and the stop count in under 100 ms.',
    technologies: ['C++', 'Graph Algorithms', 'CLI'],
    githubUrl: 'https://github.com/dnathkoushik/metro-route-planner',
    featured: true,
    date: '2025-06-19',
    status: 'shipped',
    keyFeatures: [
      'BFS for unweighted hops, Dijkstra’s algorithm for time-weighted paths.',
      '50-station network model with a modular, testable structure.',
      'Returns route, travel time and stop count in under 100 ms.',
    ],
  },
  {
    id: 'satellite-image-clustering',
    name: 'Satellite Image Clustering',
    summary:
      'K-means clustering over satellite imagery to segment terrain by spectral similarity.',
    description:
      'A Python program that applies K-means clustering to satellite images, grouping pixels by spectral similarity to segment distinct regions of terrain. Written as an exercise in implementing and reasoning about an unsupervised algorithm rather than calling one.',
    technologies: ['Python', 'Jupyter Notebook', 'K-means', 'NumPy'],
    githubUrl: 'https://github.com/dnathkoushik/Satellite-Image-Clustering',
    featured: false,
    date: '2024-06-07',
    status: 'shipped',
    keyFeatures: [
      'K-means clustering applied to multi-band satellite imagery.',
      'Segments terrain regions by spectral similarity.',
    ],
  },
] satisfies Project[]
