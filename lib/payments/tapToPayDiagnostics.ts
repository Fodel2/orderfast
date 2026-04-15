const asRecord = (value: unknown): Record<string, unknown> | null => {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
};

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const asString = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value : null);

const asNumber = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null);

type UnifiedEvent = {
  sequence: number;
  absoluteTimestamp: string | null;
  timestampMs: number | null;
  elapsedMsSinceAttemptStart: number | null;
  eventName: string;
  sessionId: string | null;
  flowRunId: string | null;
  paymentIntentId: string | null;
  processName: string | null;
  activityIdentityHash: number | null;
  context: Record<string, unknown>;
  source: 'ui' | 'native';
};

type BuildInput = {
  attemptSummary: Record<string, unknown>;
  rawNativePayload: Record<string, unknown> | null;
  rawServerVerificationPayload: Record<string, unknown> | null;
  uiContext: Record<string, unknown>;
  uiEventHistory: Record<string, unknown>[];
};

const normalizeUiEvent = (event: Record<string, unknown>, attemptStartMs: number | null): UnifiedEvent => {
  const timestampMs = asNumber(event.timestampMs);
  const elapsedMs = asNumber(event.elapsedMsSinceAttemptStart);
  const computedElapsed = elapsedMs ?? (timestampMs != null && attemptStartMs != null ? Math.max(0, timestampMs - attemptStartMs) : null);
  const context = asRecord(event.context) || {};
  const absoluteTimestamp = asString(event.absoluteTimestamp) ?? (timestampMs != null ? new Date(timestampMs).toISOString() : null);
  return {
    sequence: asNumber(event.sequence) ?? 0,
    absoluteTimestamp,
    timestampMs,
    elapsedMsSinceAttemptStart: computedElapsed,
    eventName: asString(event.eventName) || 'ui.unknown',
    sessionId: asString(event.sessionId),
    flowRunId: asString(event.flowRunId),
    paymentIntentId: asString(event.paymentIntentId),
    processName: asString(event.processName),
    activityIdentityHash: asNumber(event.activityIdentityHash),
    context,
    source: 'ui',
  };
};

const normalizeNativeEvent = (event: Record<string, unknown>, attemptStartMs: number | null): UnifiedEvent => {
  const timestampMs = asNumber(event.timestampMs);
  const elapsedMs = asNumber(event.elapsedMsSinceAttemptStart);
  const computedElapsed = elapsedMs ?? (timestampMs != null && attemptStartMs != null ? Math.max(0, timestampMs - attemptStartMs) : null);
  const context = asRecord(event.context) || {};
  const absoluteTimestamp = asString(event.absoluteTimestamp) ?? (timestampMs != null ? new Date(timestampMs).toISOString() : null);
  return {
    sequence: asNumber(event.sequence) ?? 0,
    absoluteTimestamp,
    timestampMs,
    elapsedMsSinceAttemptStart: computedElapsed,
    eventName: asString(event.eventName) || 'native.unknown',
    sessionId: asString(event.sessionId),
    flowRunId: asString(event.flowRunId),
    paymentIntentId: asString(event.paymentIntentId),
    processName: asString(event.processName),
    activityIdentityHash: asNumber(event.activityIdentityHash),
    context,
    source: 'native',
  };
};

const sortEvents = (events: UnifiedEvent[]): UnifiedEvent[] => {
  return [...events].sort((a, b) => {
    const aTs = a.timestampMs ?? Number.MAX_SAFE_INTEGER;
    const bTs = b.timestampMs ?? Number.MAX_SAFE_INTEGER;
    if (aTs !== bTs) return aTs - bTs;
    if (a.source !== b.source) return a.source === 'ui' ? -1 : 1;
    return a.sequence - b.sequence;
  });
};

const inferPresentments = (events: UnifiedEvent[]) => {
  const presentments: Record<string, unknown>[] = [];
  let current: Record<string, unknown> | null = null;

  const closeCurrent = (result: string, endTs: number | null, notes: string) => {
    if (!current) return;
    current.endedAtMs = endTs;
    current.result = result;
    current.notes = notes;
    presentments.push(current);
    current = null;
  };

  for (const event of events) {
    const nativeStatus = event.eventName === 'native.terminal_payment_status_change'
      ? asString(event.context.paymentStatus)
      : null;

    if (nativeStatus === 'WAITING_FOR_INPUT') {
      if (current) {
        closeCurrent('superseded_by_new_waiting_for_input', event.timestampMs, 'Inferred boundary: another WAITING_FOR_INPUT appeared before explicit completion.');
      }
      current = {
        presentmentIndex: presentments.length + 1,
        startedAtMs: event.timestampMs,
        endedAtMs: null,
        result: 'in_progress',
        ledToCollectSuccess: false,
        ledToProcessStart: false,
        ledToProcessSuccess: false,
        ledToProcessFailure: false,
        paymentIntentId: event.paymentIntentId,
        flowRunId: event.flowRunId,
        basis: 'inferred_from_payment_status_WAITING_FOR_INPUT',
        directCardReadSignalObserved: false,
        notes: 'Presentment opportunity inferred from Stripe Terminal payment status callback.',
      };
      continue;
    }

    if (!current) continue;

    if (event.eventName === 'native.collect_success_callback') {
      current.ledToCollectSuccess = true;
    }
    if (event.eventName === 'native.process_start' || event.eventName === 'native.process_invoked_before_sdk_call') {
      current.ledToProcessStart = true;
    }
    if (event.eventName === 'native.process_success_callback') {
      current.ledToProcessSuccess = true;
      closeCurrent('process_success', event.timestampMs, 'Collect/process callbacks indicate this presentment completed successfully.');
      continue;
    }
    if (event.eventName === 'native.collect_failure_callback') {
      closeCurrent('collect_failure', event.timestampMs, 'Collect callback failed for this presentment.');
      continue;
    }
    if (event.eventName === 'native.process_failure_callback') {
      current.ledToProcessFailure = true;
      closeCurrent('process_failure', event.timestampMs, 'Process callback failed for this presentment.');
      continue;
    }
  }

  if (current) {
    closeCurrent('abandoned_or_unresolved', current.startedAtMs as number | null, 'No terminal collect/process completion callback observed before attempt end.');
  }

  return presentments;
};

const inferRuns = (events: UnifiedEvent[], presentments: Record<string, unknown>[]) => {
  const runMap = new Map<string, Record<string, unknown>>();
  let runCounter = 0;

  for (const event of events) {
    const flowRunId = event.flowRunId || `missing_flow_run_${runCounter + 1}`;
    if (!runMap.has(flowRunId)) {
      runCounter += 1;
      runMap.set(flowRunId, {
        runIndex: runCounter,
        flowRunId: event.flowRunId,
        paymentIntentId: event.paymentIntentId,
        collectCount: 0,
        processInvokeCount: 0,
        collectSuccessCallbackCount: 0,
        collectFailureCallbackCount: 0,
        processSuccessCallbackCount: 0,
        processFailureCallbackCount: 0,
        outcome: 'in_progress',
        linkedPresentmentIndices: [],
      });
    }
    const run = runMap.get(flowRunId)!;
    if (!run.paymentIntentId && event.paymentIntentId) run.paymentIntentId = event.paymentIntentId;
    if (event.eventName === 'native.collect_invoked') run.collectCount = Number(run.collectCount) + 1;
    if (event.eventName === 'native.process_start' || event.eventName === 'native.process_invoked_before_sdk_call') {
      run.processInvokeCount = Number(run.processInvokeCount) + 1;
    }
    if (event.eventName === 'native.collect_success_callback') run.collectSuccessCallbackCount = Number(run.collectSuccessCallbackCount) + 1;
    if (event.eventName === 'native.collect_failure_callback') run.collectFailureCallbackCount = Number(run.collectFailureCallbackCount) + 1;
    if (event.eventName === 'native.process_success_callback') {
      run.processSuccessCallbackCount = Number(run.processSuccessCallbackCount) + 1;
      run.outcome = 'succeeded';
    }
    if (event.eventName === 'native.process_failure_callback') {
      run.processFailureCallbackCount = Number(run.processFailureCallbackCount) + 1;
      if (run.outcome !== 'succeeded') run.outcome = 'failed';
    }
  }

  presentments.forEach((presentment) => {
    const run = Array.from(runMap.values()).find((candidate) => candidate.flowRunId === presentment.flowRunId);
    if (!run) return;
    const indices = run.linkedPresentmentIndices as number[];
    const idx = asNumber(presentment.presentmentIndex);
    if (idx != null && !indices.includes(idx)) indices.push(idx);
  });

  return Array.from(runMap.values());
};

const buildFinalOutcome = (presentments: Record<string, unknown>[]) => {
  const first = presentments[0] || null;
  const second = presentments[1] || null;
  const firstComplete = !!first && ((first.ledToProcessSuccess === true) || (first.ledToProcessFailure === true));
  const neededSecond = presentments.length > 1;
  const final = presentments[presentments.length - 1] || null;
  const finalFrom = final ? asNumber(final.presentmentIndex) : null;
  const strandedFirst = !!first && firstComplete === false && neededSecond;

  let conclusion = 'Insufficient data to determine presentment behavior.';
  if (first && !neededSecond && first.ledToProcessSuccess === true) {
    conclusion = 'Single presentment completed successfully.';
  } else if (first && strandedFirst && second) {
    conclusion = 'First presentment did not reach process completion, and a second presentment opportunity occurred.';
  } else if (first && neededSecond && (second?.ledToProcessSuccess === true || second?.ledToProcessFailure === true)) {
    conclusion = 'Attempt required a second presentment to reach a final process callback.';
  }

  return {
    didFirstPresentmentComplete: firstComplete,
    didAttemptRequireSecondPresentment: neededSecond,
    finalSuccessOrFailureFromPresentmentIndex: finalFrom,
    abandonedOrStrandedFirstRunDetected: strandedFirst,
    conclusion,
  };
};

export const buildCombinedTapToPayDiagnosticsPayload = (input: BuildInput) => {
  const nativeSnapshot = asRecord(input.rawNativePayload?.quickChargeTraceSnapshot) || {};
  const nativeHistoryRaw = asArray(nativeSnapshot.eventHistory);
  const uiHistoryRaw = asArray(input.uiEventHistory);

  const attemptStartMs = asNumber(input.uiContext.attemptStartTimestampMs)
    ?? asNumber(nativeSnapshot.attemptStartTimestampMs)
    ?? null;

  const uiEvents = uiHistoryRaw
    .map((event) => asRecord(event))
    .filter((event): event is Record<string, unknown> => !!event)
    .map((event) => normalizeUiEvent(event, attemptStartMs));

  const nativeEvents = nativeHistoryRaw
    .map((event) => asRecord(event))
    .filter((event): event is Record<string, unknown> => !!event)
    .map((event) => normalizeNativeEvent(event, attemptStartMs));

  const eventHistory = sortEvents([...uiEvents, ...nativeEvents]).map((event, index) => ({
    ...event,
    sequence: index + 1,
  }));

  const presentments = inferPresentments(eventHistory);
  const runs = inferRuns(eventHistory, presentments);
  const finalOutcome = buildFinalOutcome(presentments);

  const attemptEndMs = asNumber(input.uiContext.attemptEndTimestampMs)
    ?? asNumber(nativeSnapshot.attemptEndTimestampMs)
    ?? eventHistory[eventHistory.length - 1]?.timestampMs
    ?? null;

  const attemptMeta = {
    sessionId: asString(input.uiContext.sessionId) ?? asString(input.rawNativePayload?.sessionId) ?? null,
    flowRunId: asString(input.uiContext.flowRunId) ?? asString(input.rawNativePayload?.flowRunId) ?? null,
    paymentIntentId:
      asString(input.uiContext.paymentIntentId)
      ?? asString(input.rawNativePayload?.paymentIntentId)
      ?? asString(nativeSnapshot.paymentIntentId)
      ?? null,
    restaurantId: asString(input.uiContext.restaurantId),
    terminalLocationId: asString(input.uiContext.terminalLocationId),
    startTimestamp: attemptStartMs != null ? new Date(attemptStartMs).toISOString() : null,
    endTimestamp: attemptEndMs != null ? new Date(attemptEndMs).toISOString() : null,
    totalDurationMs: attemptStartMs != null && attemptEndMs != null ? Math.max(0, attemptEndMs - attemptStartMs) : null,
    nativePluginVersionMarkers: {
      sdkVersion: asString((nativeSnapshot.tapToPayProcessAwareness as Record<string, unknown> | null)?.sdkVersion),
      pluginInstanceId: asNumber(nativeSnapshot.pluginInstanceId),
      activeRunSequence: asNumber(nativeSnapshot.activeRunSequence),
    },
    hadMoreThanOnePresentmentReadOpportunity: presentments.length > 1,
  };

  return {
    attemptMeta,
    eventHistory,
    presentments,
    runs,
    finalOutcome,
    rawNativePayload: input.rawNativePayload,
    rawServerVerificationPayload: input.rawServerVerificationPayload,
    uiContext: input.uiContext,
  };
};
