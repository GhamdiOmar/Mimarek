export const CONTRACT_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["SENT", "SIGNED", "CANCELLED"],
  SENT: ["SIGNED", "CANCELLED"],
  SIGNED: ["VOID"],
  CANCELLED: [],
  VOID: [],
};

export function isValidContractTransition(from: string, to: string): boolean {
  return (CONTRACT_TRANSITIONS[from] ?? []).includes(to);
}
