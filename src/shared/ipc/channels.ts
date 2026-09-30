/** Every IPC channel in the app. Nothing outside this list is handled or exposed. */
export const IPC = {
  systemStatus: 'system:status',
  systemOpenLink: 'system:open-link',
  systemRevealModels: 'system:reveal-models',
  systemWindow: 'system:window',
  systemMenu: 'system:menu',
  settingsGet: 'settings:get',
  settingsUpdate: 'settings:update',
  modelsList: 'models:list',
  modelsDownload: 'models:download',
  modelsCancel: 'models:cancel',
  modelsRemove: 'models:remove',
  modelsLoad: 'models:load',
  dictationTranscribe: 'dictation:transcribe',
  dictationPhase: 'dictation:phase',
  textInsert: 'text:insert',
  clipboardWrite: 'clipboard:write',
  clipboardRead: 'clipboard:read',
  ttsSpeak: 'tts:speak',
  historyList: 'history:list',
  historyRemove: 'history:remove',
  historyClear: 'history:clear',
} as const;

/** Main → renderer push events. */
export const EVENTS = {
  command: 'event:command',
  modelProgress: 'event:model-progress',
  statusChanged: 'event:status-changed',
  settingsChanged: 'event:settings-changed',
} as const;

export type IpcChannel = (typeof IPC)[keyof typeof IPC];
export type EventChannel = (typeof EVENTS)[keyof typeof EVENTS];
