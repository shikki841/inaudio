import type { Settings } from '@shared/domain/settings';
import type { SystemStatus } from '@shared/domain/system';
import { Notice, Row } from '@renderer/components/ui/layout';
import { Segmented } from '@renderer/components/ui/segmented';
import { Switch } from '@renderer/components/ui/switch';

export interface TraySettingsProps {
  tray: Settings['tray'];
  status: SystemStatus;
  onChange(patch: Partial<Settings['tray']>): void;
}

/** The tray icon and the menu behind it. */
export function TraySettings({ tray, status, onChange }: TraySettingsProps) {
  const off = !tray.enabled;

  return (
    <>
      {!status.notificationsSupported && (
        <div className="py-3">
          <Notice tone="neutral">
            This system has no notification service, so Inaudio reports recording state through
            the tray icon only.
          </Notice>
        </div>
      )}

      <Row label="Show the tray icon" description="Keep Inaudio reachable after its window is closed.">
        <Switch
          aria-label="Show the tray icon"
          checked={tray.enabled}
          onCheckedChange={(enabled) => onChange({ enabled })}
        />
      </Row>

      <Row
        label="Icon reflects state"
        description="The icon changes while recording and transcribing, so the overlay is not the only sign."
      >
        <Switch
          aria-label="Icon reflects state"
          checked={tray.reflectState}
          disabled={off}
          onCheckedChange={(reflectState) => onChange({ reflectState })}
        />
      </Row>

      <Row label="Left click" description="What clicking the tray icon does.">
        <Segmented<Settings['tray']['leftClick']>
          label="Tray left click"
          value={tray.leftClick}
          disabled={off}
          onValueChange={(leftClick) => onChange({ leftClick })}
          options={[
            { value: 'window', label: 'Open window' },
            { value: 'dictate', label: 'Start dictation' },
          ]}
        />
      </Row>

      <Row
        label="Microphones in the menu"
        description="Right-clicking the tray icon lists input devices. Off leaves current settings only."
      >
        <Switch
          aria-label="Microphones in the tray menu"
          checked={tray.showMicrophones}
          disabled={off}
          onCheckedChange={(showMicrophones) => onChange({ showMicrophones })}
        />
      </Row>

      <Row
        label="Notify instead"
        description={
          status.notificationsSupported
            ? 'Send a system notification when a recording starts and when a transcript is ready.'
            : 'This system has no notification service.'
        }
      >
        <Switch
          aria-label="Notify instead"
          checked={tray.notifications}
          disabled={off || !status.notificationsSupported}
          onCheckedChange={(notifications) => onChange({ notifications })}
        />
      </Row>
    </>
  );
}
