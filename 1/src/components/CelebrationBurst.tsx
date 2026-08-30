import React, { useEffect, useMemo, useRef } from 'react';
import { View, Animated, StyleSheet, Dimensions } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PARTICLE_COUNT = 22;
const PALETTE = ['#3D6355', '#7FB39A', '#B14A38', '#E1795F', '#F0EBE2'];

interface Particle {
  angle: number;
  distance: number;
  size: number;
  color: string;
  rotationDeg: number;
}

interface Props {
  /** Increment this number to fire a new burst. */
  trigger: number;
}

export default function CelebrationBurst({ trigger }: Props) {
  const progress = useRef(new Animated.Value(0)).current;

  const particles = useMemo<Particle[]>(() => {
    return Array.from({ length: PARTICLE_COUNT }, () => ({
      angle: Math.random() * Math.PI * 2,
      distance: 90 + Math.random() * 110,
      size: 6 + Math.random() * 8,
      color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
      rotationDeg: Math.random() * 360,
    }));
    // Regenerate a fresh random layout every time a new burst fires.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger]);

  useEffect(() => {
    if (trigger === 0) return;
    progress.setValue(0);
    Animated.timing(progress, { toValue: 1, duration: 900, useNativeDriver: true }).start();
  }, [trigger]);

  if (trigger === 0) return null;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {particles.map((p, i) => {
        const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(p.angle) * p.distance] });
        const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(p.angle) * p.distance - 40] });
        const opacity = progress.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] });
        const scale = progress.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 0.6] });
        const rotate = progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${p.rotationDeg}deg`] });

        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              left: SCREEN_WIDTH / 2,
              top: 40,
              width: p.size,
              height: p.size,
              borderRadius: p.size / 4,
              backgroundColor: p.color,
              opacity,
              transform: [{ translateX }, { translateY }, { scale }, { rotate }],
            }}
          />
        );
      })}
    </View>
  );
}
