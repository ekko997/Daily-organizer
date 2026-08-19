import React, { useRef } from 'react';
import { Animated, ViewStyle } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

interface Props {
  children: React.ReactNode;
  style?: ViewStyle;
}

/**
 * Wraps a screen's content so it fades and slides in gently every time the
 * tab is focused — gives tab switching a fluid feel without touching React
 * Navigation's own transition internals (safer than customizing the
 * navigator's animation directly).
 */
export default function ScreenTransition({ children, style }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;

  useFocusEffect(
    React.useCallback(() => {
      opacity.setValue(0);
      translateY.setValue(12);
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 260, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 260, useNativeDriver: true }),
      ]).start();
    }, [])
  );

  return (
    <Animated.View style={[{ flex: 1, opacity, transform: [{ translateY }] }, style]}>
      {children}
    </Animated.View>
  );
}
