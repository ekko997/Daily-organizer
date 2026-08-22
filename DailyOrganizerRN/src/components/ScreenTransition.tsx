import React, { useRef } from 'react';
import { Animated, ViewStyle } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

interface Props {
  children: React.ReactNode;
  style?: ViewStyle;
}

/**
 * A subtle fade-in on top of the tab bar's own native "shift" transition
 * (set in App.tsx's Tab.Navigator screenOptions) — that native option
 * already handles the synchronized left/right slide of both the outgoing
 * and incoming screen correctly, so this only adds a soft fade rather than
 * a second, competing slide animation.
 */
export default function ScreenTransition({ children, style }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;

  useFocusEffect(
    React.useCallback(() => {
      opacity.setValue(0);
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    }, [])
  );

  return (
    <Animated.View style={[{ flex: 1, opacity }, style]}>
      {children}
    </Animated.View>
  );
}
