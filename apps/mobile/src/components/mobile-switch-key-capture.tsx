import { useRef, useEffect } from 'react';
import { TextInput, type NativeSyntheticEvent, type TextInputKeyPressEventData } from 'react-native';
import { classifySwitchNativeKey } from '@voxa/access';

interface MobileSwitchKeyCaptureProps {
  enabled: boolean;
  onAdvance: () => void;
  onSelect: () => void;
}

/** Invisible focus target so BT/USB switches that emulate a keyboard can drive scan. */
export function MobileSwitchKeyCapture({ enabled, onAdvance, onSelect }: MobileSwitchKeyCaptureProps) {
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!enabled) return;
    inputRef.current?.focus();
  }, [enabled]);

  if (!enabled) return null;

  const onKeyPress = (event: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
    const action = classifySwitchNativeKey(event.nativeEvent.key);
    if (action === 'select') {
      onSelect();
      return;
    }
    if (action === 'advance') {
      onAdvance();
    }
  };

  return (
    <TextInput
      ref={inputRef}
      accessibilityLabel="Hardware switch input"
      autoFocus
      editable
      importantForAccessibility="no-hide-descendants"
      onKeyPress={onKeyPress}
      showSoftInputOnFocus={false}
      style={{ height: 1, opacity: 0, position: 'absolute', width: 1 }}
      value=""
    />
  );
}
