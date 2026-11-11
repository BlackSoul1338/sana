/** Initial Team Research Arena scale, set by the development team; to be checked against the organizers' scale. */
export const RESEARCH_POINTS = {
  levelShare: { strong: 1, adequate: 0.6, weak: 0.2 },
  completion: 10,
  /** Personal: per item the person authored that the approved conclusion cites. Messages never count. */
  cited: { each: 3, cap: 15 },
} as const;
