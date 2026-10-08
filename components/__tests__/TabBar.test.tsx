import { Text } from 'react-native';
import { render, fireEvent, screen } from '@testing-library/react-native';
import { TabBar } from '../TabBar';

function makeProps(index: number) {
  const names = ['index', 'workouts', 'stats'];
  const titles = ['Calendar', 'Workouts', 'Stats'];
  const routes = names.map((name) => ({ key: `${name}-key`, name }));
  const descriptors = Object.fromEntries(
    routes.map((r, i) => [r.key, { options: { title: titles[i], tabBarIcon: () => <Text>icon</Text> } }])
  );
  const navigation = {
    emit: jest.fn(() => ({ defaultPrevented: false })),
    navigate: jest.fn(),
  };
  return { state: { index, routes }, descriptors, navigation } as any;
}

describe('TabBar', () => {
  it('shows the three tabs with the current one selected', () => {
    render(<TabBar {...makeProps(0)} />);
    expect(screen.getByRole('tab', { name: 'Calendar' })).toBeSelected();
    expect(screen.getByRole('tab', { name: 'Workouts' })).not.toBeSelected();
    expect(screen.getByRole('tab', { name: 'Stats' })).not.toBeSelected();
  });

  it('navigates when another tab is pressed', () => {
    const props = makeProps(0);
    render(<TabBar {...props} />);
    fireEvent.press(screen.getByRole('tab', { name: 'Stats' }));
    expect(props.navigation.navigate).toHaveBeenCalledWith('stats');
  });

  it('does nothing when the current tab is pressed again', () => {
    const props = makeProps(1);
    render(<TabBar {...props} />);
    fireEvent.press(screen.getByRole('tab', { name: 'Workouts' }));
    expect(props.navigation.navigate).not.toHaveBeenCalled();
  });
});
