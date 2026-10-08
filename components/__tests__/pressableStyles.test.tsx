import { render, screen } from '@testing-library/react-native';
import { Chip } from '../Chip';
import { PrimaryButton } from '../PrimaryButton';
import { colors } from '@/lib/theme';

// Regression: NativeWind's Pressable wrapper dropped `style={({ pressed }) => …}`
// on phones (buttons lost backgrounds, tab bar items lost flex: 1). Styles from
// style functions must reach the rendered view.
describe('Pressable style functions', () => {
  it('apply on chips', () => {
    render(<Chip label="chest" selected onPress={() => {}} />);
    expect(screen.getByRole('button', { name: 'chest' })).toHaveStyle({ backgroundColor: colors.sage, height: 32 });
  });

  it('apply on the primary button', () => {
    render(<PrimaryButton label="Save" onPress={() => {}} />);
    expect(screen.getByRole('button', { name: 'Save' })).toHaveStyle({ backgroundColor: colors.sage, height: 58 });
  });
});
