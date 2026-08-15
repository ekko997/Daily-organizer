import React, { useRef } from 'react';
import { Animated, PanResponder, StyleSheet, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

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

  const panResponder = useRef(
    PanResponder.create({
      // Only take over the gesture once it's clearly a horizontal swipe,
      // so vertical scrolling in the list still works normally.
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dx) > 10 && Math.abs(gesture.dx) > Math.abs(gesture.dy) && gesture.dx < 0,
      onPanResponderMove: (_, gesture) => {
        if (gesture.dx < 0) {
          translateX.setValue(Math.max(gesture.dx, MAX_SWIPE));
        }
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dx < SWIPE_THRESHOLD) {
          Animated.timing(translateX, { toValue: -500, duration: 200, useNativeDriver: true }).start(() => {
            onDelete();
          });
        } else {
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
        }
      },
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
