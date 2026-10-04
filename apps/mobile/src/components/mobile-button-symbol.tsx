import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { Image } from 'expo-image';
import { MULBERRY_ATTRIBUTION } from '@voxa/symbols';

/**
 * A button's symbol above its label. Decorative for assistive technology: the
 * button's accessibility label already names it. When the image cannot load
 * (offline without a cached copy, or the host answers with an error), the
 * button falls back to label-only, as on the web board.
 */
export function MobileButtonSymbol({ uri, size }: { uri: string; size: number }) {
  const [failedUri, setFailedUri] = useState<string | null>(null);
  if (failedUri === uri) return null;
  return (
    <Image
      source={{ uri }}
      style={{ width: size, height: size }}
      contentFit="contain"
      cachePolicy="disk"
      accessible={false}
      onError={() => setFailedUri(uri)}
    />
  );
}

/** CC BY-SA 4.0 attribution, shown while the board displays Mulberry symbols. */
export function MobileSymbolCredit() {
  return (
    <Text style={styles.credit} accessibilityRole="text">
      {MULBERRY_ATTRIBUTION}
    </Text>
  );
}

const styles = StyleSheet.create({
  credit: { color: '#a3a3a3', fontSize: 11, paddingHorizontal: 12, paddingVertical: 6 },
});
