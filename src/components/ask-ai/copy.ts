/**
 * Ask My AI interface copy (UI only — never facts about the owner). Spec §3 labels are verbatim.
 */
export const UI = {
  smartTitle: 'Smart Mode',
  smartSubtitle: 'Instant answers from portfolio',
  localTitle: 'Local AI',
  localSubtitle: 'Generated on your device',
  tryLocal: 'Try Local AI (runs on your device)',
  backToSmart: 'Back to Smart Mode',
  notice: 'Answers use approved public portfolio information only.',
  inputLabel: 'Ask about Islam’s work',
  placeholder: 'Ask about his work, projects, contact…',
  placeholderLocal: 'Ask the local model about his work…',
  send: 'Send question',
  stop: 'Stop',
  clear: 'Clear conversation',
  suggestions: 'Suggested questions',
  sources: 'Sources',
  sourcesGiven: 'Sources given to the model',
  nextSteps: 'Explore',
  smartLabel: 'Smart Answer',
  localLabel: 'Generated Locally',
  you: 'You asked:',
  empty:
    'Ask in English or Arabic. Smart Mode searches approved portfolio content in your browser — nothing you type is sent or stored.',
  loadingIndex: 'Loading the portfolio index…',
  indexError: 'The portfolio index could not be loaded. Check your connection and try again.',
  searching: 'Searching approved content…',
  writing: 'Writing the answer…',
  retrying: 'Checking the answer against the sources…',
  cancelled: 'Stopped. Your question is back in the box.',
  turnError: 'Something went wrong. Your question is back in the box.',
  pausedNote: 'The 3D scene pauses while the model loads or writes, then resumes.',
} as const;

export const LOCAL = {
  checking: 'Checking whether this device can run a local model…',
  consentTitle: 'Run a small language model on this device?',
  chooseModel: 'Choose a model',
  consentDownload: (size: string, label: string, license: string) =>
    `Downloads about ${size} once — ${label} (${license}) from Hugging Face and GitHub.`,
  consentStorage: (size: string) =>
    `Your browser keeps it (about ${size}) for next time; clearing site data removes it.`,
  consentGpu: 'Uses your GPU and memory while it loads and answers. The 3D scene pauses during that time.',
  consentPrivacy: 'Your questions and answers stay on this device — nothing is sent to a server.',
  consentOptional: 'Optional: Smart Mode keeps working, and you can go back to it at any time.',
  consentCached: 'The model is already stored in this browser — no download needed.',
  consentPartial: 'Part of the model is already stored; the rest will download.',
  saveData: 'Your browser asked to save data. Consider staying in Smart Mode on metered connections.',
  noSpace: 'There isn’t enough free browser storage for this model.',
  accept: 'Download and start',
  acceptCached: 'Start Local AI',
  decline: 'Not now',
  cancel: 'Cancel',
  retry: 'Try again',
  clearCache: 'Remove model from this device',
  cacheCleared: 'Model files removed from this browser.',
  downloading: 'Downloading model files',
  initializing: 'Preparing the model on your GPU',
  compiling: 'Compiling GPU shaders',
  ready: (label: string) => `${label} is running on your device.`,
  switching: 'Switching mode…',
  offline: 'You’re offline and the model isn’t stored on this device yet. Smart Mode works offline.',
  pressure:
    'The GPU ran out of resources or was reset, so Local AI stopped and the 3D scene resumed. Smart Mode is answering.',
  unavailable: {
    'insecure-context': 'Local AI needs a secure (HTTPS) connection. Smart Mode keeps working.',
    'no-webgpu': 'This browser doesn’t support WebGPU, which Local AI needs. Smart Mode keeps working.',
    'no-adapter': 'No compatible GPU is available to this browser. Smart Mode keeps working.',
    'missing-feature': 'This GPU lacks a feature the model needs (16-bit shaders). Smart Mode keeps working.',
    limits: 'This GPU’s memory limits are too small for the model. Smart Mode keeps working.',
    storage: 'There isn’t enough browser storage for the model. Smart Mode keeps working.',
    'other-tab':
      'Local AI is already running in another tab of this site. Use it there, or close it there to run it here. Smart Mode keeps working.',
  } as Record<string, string>,
  errors: {
    network: 'The download was interrupted. You can try again — files already downloaded are kept.',
    'quota-exceeded':
      'The browser refused to store the model (storage is full). Free some space or stay in Smart Mode.',
    integrity: 'A model file failed its integrity check, so it was not used. Smart Mode is answering.',
    'out-of-memory': 'The GPU ran out of memory. Smart Mode is answering.',
    'device-lost': 'The GPU was reset. Smart Mode is answering.',
    'webgpu-unavailable': 'WebGPU stopped being available. Smart Mode is answering.',
    'worker-crashed': 'Local AI stopped unexpectedly. Smart Mode is answering.',
    unknown: 'Local AI couldn’t start. Smart Mode is answering.',
  } as Record<string, string>,
} as const;

/** Why a Smart answer is shown while Local AI is on — always said, never hidden. */
export const FALLBACK_NOTICE: Record<
  'blocked' | 'no-evidence' | 'not-grounded' | 'arabic' | 'model-abstained' | 'error',
  { en: string; ar: string }
> = {
  blocked: {
    en: 'Answered by Smart Mode: this request isn’t sent to the local model.',
    ar: 'أجاب الوضع الذكي: هذا الطلب لا يُرسل إلى النموذج المحلي.',
  },
  'no-evidence': {
    en: 'Answered by Smart Mode: there is no approved content for the local model to use.',
    ar: 'أجاب الوضع الذكي: لا يوجد محتوى معتمد يمكن للنموذج المحلي الاعتماد عليه.',
  },
  'not-grounded': {
    en: 'The local model’s answer couldn’t be verified against the sources, so this is the Smart Answer.',
    ar: 'تعذّر التحقق من إجابة النموذج المحلي مقابل المصادر، لذلك هذه إجابة الوضع الذكي.',
  },
  'model-abstained': {
    en: 'The local model found no answer in the sources, so this is the Smart Answer.',
    ar: 'لم يجد النموذج المحلي إجابة في المصادر، لذلك هذه إجابة الوضع الذكي.',
  },
  arabic: {
    en: 'Local AI answers in English only for now, so this is the Smart Answer.',
    ar: 'الذكاء الاصطناعي المحلي يجيب بالإنجليزية فقط حالياً، لذلك هذه إجابة الوضع الذكي.',
  },
  error: {
    en: 'Local AI failed on this question, so this is the Smart Answer.',
    ar: 'تعذّر على الذكاء الاصطناعي المحلي الإجابة، لذلك هذه إجابة الوضع الذكي.',
  },
};

export const LOCAL_DISCLAIMER = {
  en: 'Generated on your device by a small language model from the sources below. It can make mistakes — check the sources.',
  ar: 'وُلّدت هذه الإجابة على جهازك بواسطة نموذج لغوي صغير اعتماداً على المصادر أدناه، وقد تحتوي على أخطاء — راجع المصادر.',
};
