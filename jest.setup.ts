// Global Jest setup — runs after the test framework is installed in each suite.

// Gesture handler's own test stubs (drag-to-reorder uses its Pan gesture).
import 'react-native-gesture-handler/jestSetup';
//
// The mock module ships as a default export, so unwrap `.default` or every
// named import (`useSafeAreaInsets`, `SafeAreaView`, …) resolves to undefined.
jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default
);
