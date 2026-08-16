import React, { useRef } from 'react';
import { Animated, PanResponder, StyleSheet, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { haptics } from '../utils/haptics';

interface Props {
  children: React.ReactNode;
  onDelete: () => void;
  deleteColor?: string;
  style?: ViewStyle;
}

const SWIPE_THRESHOLD = -80;
const MAX_SWIPE = -120;

export default function SwipeableRow({ children, onDelete, deleteColor = '#D9435C', style }: Props) {
  const translateX = useRef(new Animated.Value(0)).current;
  const currentValue = useRef(0);

  const snapBack = () => {
    Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
    currentValue.current = 0;
  };

  const panResponder = useRef(
    PanResponder.create({
      // Don't claim a plain tap — only a clear horizontal drag.
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dx) > 10 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
      // Once we've claimed the gesture, don't let the parent ScrollView
      // steal it mid-swipe — that's what left rows stuck before.
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, gesture) => {
        const next = Math.min(0, Math.max(gesture.dx, MAX_SWIPE));
        const crossedThreshold = next < SWIPE_THRESHOLD && currentValue.current >= SWIPE_THRESHOLD;
        if (crossedThreshold) haptics.light();
        translateX.setValue(next);
        currentValue.current = next;
      },
      onPanResponderRelease: () => {
        if (currentValue.current < SWIPE_THRESHOLD) {
          haptics.medium();
          Animated.timing(translateX, { toValue: -500, duration: 200, useNativeDriver: true }).start(() => {
            onDelete();
          });
        } else {
          snapBack();
        }
      },
      // Safety net: if the gesture is cancelled some other way, always snap back
      // rather than leaving the row stuck mid-swipe.
      onPanResponderTerminate: snapBack,
    })
  ).current;

  return (
    <View style={[styles.wrapper, style]}>
      <View style={[styles.deleteBackground, { backgroundColor: deleteColor }]}>
        <Ionicons name="trash" size={20} color="#FFFFFF" />
      </View>
      <Animated.View style={{ transform: [{ translateX }] }} {...panResponder.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { position: 'relative' },
  deleteBackground: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    left: 0,
    borderRadius: 10,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingRight: 20,
  },
});
