import React, { useRef } from 'react';
import { Animated, ViewStyle } from 'react-native';
import { useFocusEffect, useRoute } from '@react-navigation/native';

interface Props {
  children: React.ReactNode;
  style?: ViewStyle;
}

// Matches the tab order in App.tsx — lets the slide direction reflect
// which way you're actually moving through the tab bar (left vs right),
// like a real paging motion instead of the same animation every time.
const TAB_ORDER = ['Today', 'Calendar', 'Agenda', 'To-Do', 'Settings'];
let lastActiveTab: string | null = null;

/**
 * Wraps a screen's content so it fades and slides in horizontally every
 * time the tab is focused — gives tab switching a fluid, paging feel
 * without touching React Navigation's own transition internals (safer
 * than customizing the navigator's animation directly).
 */
export default function ScreenTransition({ children, style }: Props) {
  const route = useRoute();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(0)).current;

  useFocusEffect(
    React.useCallback(() => {
      const currentIndex = TAB_ORDER.indexOf(route.name);
      const previousIndex = lastActiveTab ? TAB_ORDER.indexOf(lastActiveTab) : currentIndex;
      // Moving right through the tabs slides in from the right; moving
      // left slides in from the left. First launch has no direction, so
      // it just fades in place.
      const startOffset = currentIndex > previousIndex ? 36 : currentIndex < previousIndex ? -36 : 0;
      lastActiveTab = route.name;

      opacity.setValue(0);
      translateX.setValue(startOffset);
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 260, useNativeDriver: true }),
        Animated.timing(translateX, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
    }, [route.name])
  );

  return (
    <Animated.View style={[{ flex: 1, opacity, transform: [{ translateX }] }, style]}>
      {children}
    </Animated.View>
  );
}
