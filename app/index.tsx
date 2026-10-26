import { Text, View } from 'react-native';

import { APP_NAME } from '../src/config';

// Phase 0 placeholder. Agent F replaces this with the Home screen.
export default function Home() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>{APP_NAME}</Text>
    </View>
  );
}
