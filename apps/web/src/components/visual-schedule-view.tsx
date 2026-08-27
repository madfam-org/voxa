'use client';

import type { BoardButton } from '@voxa/core';
import { AacButton } from '@voxa/ui';
import { buttonLabel } from '@/lib/board-utils';
import { neutral, status, surface } from '@/lib/tokens';

export interface VisualScheduleViewProps {
  steps: BoardButton[];
  completedIds: ReadonlySet<string>;
  currentStepId: string | null;
  targetScale: number;
  hideSymbol?: boolean;
  hideLabel?: boolean;
  isHighlighted: (btn: BoardButton) => boolean;
  isGroupHighlighted: (btn: BoardButton) => boolean;
  dwellProgressFor: (buttonId: string) => number;
  renderStepButton: (btn: BoardButton, state: { completed: boolean; current: boolean }) => React.ReactNode;
}

export function VisualScheduleView({
  steps,
  completedIds,
  currentStepId,
  targetScale,
  hideSymbol,
  hideLabel,
  isHighlighted,
  isGroupHighlighted,
  dwellProgressFor,
  renderStepButton,
}: VisualScheduleViewProps): React.ReactNode {
  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        overflow: 'auto',
        padding: `${Math.round(12 * targetScale)}px ${Math.round(20 * targetScale)}px`,
      }}
    >
      <ol
        aria-label="Visual schedule"
        style={{
          listStyle: 'none',
          margin: 0,
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: `${Math.round(10 * targetScale)}px`,
        }}
      >
        {steps.map((btn, index) => {
          const id = btn.id as string;
          const completed = completedIds.has(id);
          const current = !completed && id === currentStepId;
          const showConnector = index < steps.length - 1;

          return (
            <li
              key={id}
              style={{
                display: 'grid',
                gridTemplateColumns: `${Math.round(40 * targetScale)}px 1fr`,
                gap: `${Math.round(12 * targetScale)}px`,
                alignItems: 'stretch',
              }}
            >
              <div
                aria-hidden
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  paddingTop: `${Math.round(8 * targetScale)}px`,
                }}
              >
                <span
                  style={{
                    width: `${Math.round(28 * targetScale)}px`,
                    height: `${Math.round(28 * targetScale)}px`,
                    borderRadius: '50%',
                    border: `2px solid ${completed ? status.successBorder : current ? status.warningAccent : neutral.disabled}`,
                    background: completed ? status.successFill : current ? status.warningFill : surface.raised,
                    color: completed ? status.successSoft : current ? status.premium : neutral.muted,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: `${Math.round(14 * targetScale)}px`,
                    flexShrink: 0,
                  }}
                >
                  {completed ? '✓' : index + 1}
                </span>
                {showConnector ? (
                  <span
                    style={{
                      flex: 1,
                      width: 2,
                      minHeight: `${Math.round(12 * targetScale)}px`,
                      marginTop: 4,
                      background: completed ? status.successBorder : neutral.border,
                    }}
                  />
                ) : null}
              </div>

              <div style={{ minWidth: 0 }}>
                {renderStepButton(btn, { completed, current }) ?? (
                  <AacButton
                    label={buttonLabel(btn)}
                    data-voxa-button-id={id}
                    targetScale={targetScale}
                    hideSymbol={hideSymbol}
                    hideLabel={hideLabel}
                    scanHighlighted={isHighlighted(btn)}
                    scanGroupHighlighted={isGroupHighlighted(btn)}
                    dwellProgress={dwellProgressFor(id)}
                    style={
                      completed
                        ? { opacity: 0.72, outline: `2px solid ${status.successBorder}` }
                        : current
                          ? { outline: `2px solid ${status.warningAccent}` }
                          : undefined
                    }
                    aria-label={
                      completed
                        ? `${buttonLabel(btn)} (completed)`
                        : current
                          ? `${buttonLabel(btn)} (current step)`
                          : buttonLabel(btn)
                    }
                  />
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
