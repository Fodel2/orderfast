export type InternalSettlementRunState = {
  flowRunId: string;
  sessionId: string;
  terminalLocationId: string;
  restaurantId: string;
  mode: 'order_payment' | 'quick_charge';
  amountCents: number;
  active: boolean;
  createdAt: string;
  uiAttached: boolean;
  nativeStatus: string | null;
  finalNativeResult: Record<string, unknown> | null;
};

const STORAGE_KEY = 'orderfast.internal_settlement.active_run.v1';

let state: InternalSettlementRunState | null = null;

const readStorage = (): InternalSettlementRunState | null => {
  if (typeof window === 'undefined') return state;
  if (state) return state;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as InternalSettlementRunState;
    state = parsed;
    return parsed;
  } catch {
    return null;
  }
};

const writeStorage = (next: InternalSettlementRunState | null) => {
  state = next;
  if (typeof window === 'undefined') return;
  try {
    if (!next) {
      window.sessionStorage.removeItem(STORAGE_KEY);
      return;
    }
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // no-op
  }
};

export const internalSettlementActiveRunStore = {
  get(): InternalSettlementRunState | null {
    return readStorage();
  },
  create(input: Omit<InternalSettlementRunState, 'active' | 'createdAt' | 'uiAttached' | 'nativeStatus' | 'finalNativeResult'>) {
    const next: InternalSettlementRunState = {
      ...input,
      active: true,
      createdAt: new Date().toISOString(),
      uiAttached: true,
      nativeStatus: 'collecting',
      finalNativeResult: null,
    };
    writeStorage(next);
    return next;
  },
  setUiAttached(attached: boolean) {
    const current = readStorage();
    if (!current) return;
    writeStorage({ ...current, uiAttached: attached });
  },
  setNativeStatus(nativeStatus: string | null) {
    const current = readStorage();
    if (!current) return;
    writeStorage({ ...current, nativeStatus });
  },
  cacheFinalNativeResult(result: Record<string, unknown>) {
    const current = readStorage();
    if (!current) return;
    writeStorage({ ...current, finalNativeResult: result, active: false, nativeStatus: String(result.status || current.nativeStatus || '') });
  },
  clear() {
    writeStorage(null);
  },
};
