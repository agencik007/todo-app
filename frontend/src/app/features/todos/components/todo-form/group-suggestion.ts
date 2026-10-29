import { GroupSuggestion, SuggestedNewGroup } from '@api';

/** Where the form's group value came from. */
export type GroupSource = 'empty' | 'ai' | 'user';

export type SuggestionChip =
  | { kind: 'existing'; groupId: number }
  | { kind: 'new'; group: SuggestedNewGroup };

export interface SuggestionState {
  groupId: number | null;
  source: GroupSource;
  chip: SuggestionChip | null;
  reason: string | null;
  /** Undo or "No thanks" – no more suggestions for this form. */
  stopped: boolean;
}

/**
 * Applies one suggestion response to the form's group state. The latest
 * response wins over an AI value or chip, but never over a group the user
 * picked; only `high` with an existing group fills the field.
 */
export function reduceSuggestion(
  state: SuggestionState,
  response: GroupSuggestion,
): SuggestionState {
  if (state.stopped || state.source === 'user') {
    return state;
  }

  const reason = response.reason ?? null;
  const groupId = response.groupId ?? null;
  // A chip never sits next to an AI value: it replaces it.
  const withoutAiValue =
    state.source === 'ai'
      ? { groupId: null, source: 'empty' as const }
      : { groupId: state.groupId, source: state.source };

  if (groupId !== null && response.confidence === 'high') {
    return { ...state, groupId, source: 'ai', chip: null, reason };
  }
  if (groupId !== null && response.confidence === 'medium') {
    return {
      ...state,
      ...withoutAiValue,
      chip: { kind: 'existing', groupId },
      reason,
    };
  }
  if (response.newGroup) {
    return {
      ...state,
      ...withoutAiValue,
      chip: { kind: 'new', group: response.newGroup },
      reason,
    };
  }
  return { ...state, ...withoutAiValue, chip: null, reason: null };
}
