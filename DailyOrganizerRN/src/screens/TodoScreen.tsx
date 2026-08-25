import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, SafeAreaView, ScrollView, KeyboardAvoidingView, Platform, RefreshControl, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useEvents } from '../utils/EventsContext';
import { useAuth } from '../utils/AuthContext';
import { useFamily } from '../utils/FamilyContext';
import { TodoItem } from '../models/Todo';
import { subscribeToTodos, upsertTodo, toggleTodo, deleteTodo } from '../services/cloudTodoService';
import { spacing, radii, typography, cardShadow, ThemeColors } from '../utils/theme';
import { useTheme } from '../utils/ThemeContext';
import { useToast } from '../utils/ToastContext';
import { haptics } from '../utils/haptics';
import { capitalizeFirst } from '../utils/textUtils';
import SwipeableRow from '../components/SwipeableRow';
import ScreenTransition from '../components/ScreenTransition';
import EmptyState from '../components/EmptyState';
import CelebrationBurst from '../components/CelebrationBurst';

function TodoRow({ todo, onToggle, colors, styles }: { todo: TodoItem; onToggle: () => void; colors: ThemeColors; styles: any }) {
  const scale = useRef(new Animated.Value(1)).current;

  function handlePress() {
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.9, duration: 80, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 4, useNativeDriver: true }),
    ]).start();
    onToggle();
  }

  return (
    <Pressable
      style={({ pressed }) => [styles.todoRow, { borderLeftColor: todo.done ? colors.border : colors.accent }, pressed && { opacity: 0.6 }]}
      onPress={handlePress}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <Ionicons
          name={todo.done ? 'checkmark-circle' : 'ellipse-outline'}
          size={24}
          color={todo.done ? colors.accent : colors.textSecondary}
        />
      </Animated.View>
      <Text style={[styles.todoText, todo.done && styles.todoTextDone]}>{todo.text}</Text>
    </Pressable>
  );
}

export default function TodoScreen() {
  const { activeScope, setActiveScope } = useEvents();
  const { user } = useAuth();
  const { family } = useFamily();
  const { colors } = useTheme();
  const { showToast } = useToast();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [newText, setNewText] = useState('');
  const [scopeDropdownOpen, setScopeDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [celebrationTrigger, setCelebrationTrigger] = useState(0);
  const wasAllDone = useRef(false);

  const onRefresh = useCallback(() => {
    haptics.light();
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 500);
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = subscribeToTodos(user.uid, family?.id ?? null, setTodos);
    return unsubscribe;
  }, [user?.uid, family?.id]);

  const visibleTodos = todos
    .filter(t => t.scope === activeScope)
    .filter(t => !searchQuery.trim() || t.text.toLowerCase().includes(searchQuery.trim().toLowerCase()))
    .sort((a, b) => Number(a.done) - Number(b.done) || a.createdAt.localeCompare(b.createdAt));

  // Celebrates the exact moment the list goes from "not quite done" to
  // "fully done" — not on every render while it stays done, and not on
  // load if it happens to already be complete.
  useEffect(() => {
    const allDone = visibleTodos.length > 0 && visibleTodos.every(t => t.done);
    if (allDone && !wasAllDone.current) {
      haptics.success();
      setCelebrationTrigger(t => t + 1);
    }
    wasAllDone.current = allDone;
  }, [visibleTodos]);

  async function handleAdd() {
    if (!newText.trim() || !user) return;
    const todo: TodoItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      text: newText.trim(),
      done: false,
      scope: activeScope,
      ownerId: user.uid,
      familyId: activeScope === 'family' ? (family?.id ?? null) : null,
      createdAt: new Date().toISOString(),
      lastModifiedBy: user.uid,
    };
    setNewText('');
    haptics.light();
    try {
      await upsertTodo(todo);
    } catch (err: any) {
      showToast({ message: `Couldn't add: ${err?.message || 'unknown error'}` });
    }
  }

  async function handleToggle(todo: TodoItem) {
    haptics.light();
    await toggleTodo(todo.id, !todo.done);
  }

  async function handleDelete(todo: TodoItem) {
    haptics.warning();
    await deleteTodo(todo.id);
    showToast({
      message: `"${todo.text}" deleted`,
      actionLabel: 'Undo',
      onAction: async () => { await upsertTodo(todo); },
    });
  }

  async function handleClearCompleted() {
    const completed = visibleTodos.filter(t => t.done);
    if (completed.length === 0) return;
    haptics.warning();
    for (const t of completed) await deleteTodo(t.id);
    showToast({ message: `Cleared ${completed.length} completed item${completed.length === 1 ? '' : 's'}` });
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScreenTransition>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={90}>
        <View style={styles.headerRow}>
          <Text style={styles.header}>To-Do</Text>
          {visibleTodos.some(t => t.done) && (
            <Pressable onPress={handleClearCompleted} accessibilityLabel="Clear completed items" accessibilityRole="button">
              <Text style={styles.clearCompletedText}>Clear done</Text>
            </Pressable>
          )}
        </View>

        {visibleTodos.length > 0 && (() => {
          const doneCount = visibleTodos.filter(t => t.done).length;
          const allDone = doneCount === visibleTodos.length;
          return (
            <View style={[styles.progressCard, allDone && styles.progressCardComplete]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.progressNumber}>{allDone ? 'All done!' : `${doneCount} / ${visibleTodos.length}`}</Text>
                <Text style={styles.progressLabel}>{allDone ? 'Nice work today' : 'done'}</Text>
              </View>
              {allDone ? (
                <Ionicons name="sparkles" size={28} color={colors.textOnDark} />
              ) : (
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${(doneCount / visibleTodos.length) * 100}%` }]} />
                </View>
              )}
            </View>
          );
        })()}

        <CelebrationBurst trigger={celebrationTrigger} />

        {family ? (
          <View style={styles.scopeWrapper}>
            <Pressable style={styles.scopeButton} onPress={() => setScopeDropdownOpen(!scopeDropdownOpen)}>
              <Ionicons name={activeScope === 'family' ? 'people' : 'person'} size={16} color={colors.accent} />
              <Text style={styles.scopeButtonText} maxFontSizeMultiplier={1.3}>{activeScope === 'family' ? (family?.name || 'Family') : 'Personal'}</Text>
              <Ionicons name={scopeDropdownOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textSecondary} style={{ marginLeft: 'auto' }} />
            </Pressable>
            {scopeDropdownOpen && (
              <View style={styles.scopeDropdown}>
                <Pressable style={styles.scopeDropdownRow} onPress={() => { setActiveScope('personal'); setScopeDropdownOpen(false); }}>
                  <Ionicons name="person" size={16} color={colors.textSecondary} />
                  <Text style={styles.scopeDropdownText}>Personal</Text>
                </Pressable>
                <Pressable style={[styles.scopeDropdownRow, styles.scopeDropdownDivider]} onPress={() => { setActiveScope('family'); setScopeDropdownOpen(false); }}>
                  <Ionicons name="people" size={16} color={colors.textSecondary} />
                  <Text style={styles.scopeDropdownText}>{family?.name || 'Family'}</Text>
                </Pressable>
              </View>
            )}
          </View>
        ) : (
          <View style={{ height: spacing.md }} />
        )}

        <View style={styles.addRow}>
          <TextInput
            style={styles.input}
            placeholder="Add an item..."
            placeholderTextColor={colors.textSecondary}
            value={newText}
            onChangeText={text => setNewText(capitalizeFirst(text))}
            onSubmitEditing={handleAdd}
            returnKeyType="done"
          />
          <Pressable
            style={({ pressed }) => [styles.addButton, pressed && styles.pressedShrink]}
            accessibilityLabel="Add to-do item"
            accessibilityRole="button"
            onPress={handleAdd}
          >
            <Ionicons name="add" size={20} color={colors.white} />
          </Pressable>
        </View>

        {todos.filter(t => t.scope === activeScope).length > 3 && (
          <View style={styles.searchRow}>
            <Ionicons name="search" size={16} color={colors.textSecondary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search this list"
              placeholderTextColor={colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
              </Pressable>
            )}
          </View>
        )}

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        >
          {visibleTodos.length === 0 ? (
            <EmptyState
              icon={searchQuery ? 'search' : 'checkmark-done-outline'}
              title={searchQuery ? 'No matches' : 'All clear'}
              subtitle={searchQuery ? undefined : 'Nothing on this list right now'}
            />
          ) : (
            visibleTodos.map(todo => (
              <SwipeableRow key={todo.id} onDelete={() => handleDelete(todo)} style={{ marginBottom: spacing.sm }}>
                <TodoRow todo={todo} onToggle={() => handleToggle(todo)} colors={colors} styles={styles} />
              </SwipeableRow>
            ))
          )}
        </ScrollView>
      </KeyboardAvoidingView>
      </ScreenTransition>
    </SafeAreaView>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { ...typography.screenTitle, paddingHorizontal: spacing.xl, paddingTop: spacing.md, color: colors.textPrimary },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingRight: spacing.xl },
    clearCompletedText: { fontSize: 12, fontWeight: '600', color: colors.accent },
    progressCard: {
      flexDirection: 'row', alignItems: 'center', gap: spacing.lg,
      backgroundColor: colors.surfaceDark, borderRadius: radii.lg,
      paddingHorizontal: spacing.lg, paddingVertical: spacing.lg,
      marginHorizontal: spacing.xl, marginTop: spacing.md,
      ...cardShadow,
    },
    progressCardComplete: { backgroundColor: colors.accent },
    progressNumber: { fontSize: 22, fontWeight: '800', fontFamily: 'Manrope_800ExtraBold', color: colors.textOnDark },
    progressLabel: { fontSize: 12, color: colors.textOnDarkMuted, marginTop: 2 },
    progressTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.25)', overflow: 'hidden' },
    progressFill: { height: '100%', borderRadius: 4, backgroundColor: colors.textOnDark },
    scopeWrapper: { position: 'relative', zIndex: 20, paddingHorizontal: spacing.xl, marginTop: spacing.md },
    scopeButton: {
      flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
      backgroundColor: colors.surface, borderRadius: radii.pill,
      paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, alignSelf: 'flex-start',
    },
    scopeButtonText: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
    scopeDropdown: {
      position: 'absolute', top: 44, left: spacing.xl, minWidth: 180,
      backgroundColor: colors.background, borderRadius: radii.sm, borderWidth: 1, borderColor: colors.border,
      shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 6,
      paddingVertical: spacing.xs,
    },
    scopeDropdownRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.md },
    scopeDropdownDivider: { borderTopWidth: 1, borderTopColor: colors.border },
    scopeDropdownText: { fontSize: 14, color: colors.textPrimary },
    addRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.xl, marginTop: spacing.md, marginBottom: spacing.md },
    input: { flex: 1, backgroundColor: colors.surface, borderRadius: radii.sm, padding: spacing.md, fontSize: 15, color: colors.textPrimary },
    addButton: { width: 44, borderRadius: radii.sm, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
    pressedShrink: { transform: [{ scale: 0.94 }], opacity: 0.85 },
    searchRow: {
      flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
      backgroundColor: colors.surface, borderRadius: radii.pill,
      paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
      marginHorizontal: spacing.xl, marginBottom: spacing.md,
    },
    searchInput: { flex: 1, fontSize: 14, color: colors.textPrimary },
    todoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radii.sm, borderLeftWidth: 3, padding: spacing.md, ...cardShadow },
    todoText: { flex: 1, fontSize: 14, color: colors.textPrimary },
    todoTextDone: { textDecorationLine: 'line-through', color: colors.textSecondary },
    emptyState: { alignItems: 'center', paddingVertical: spacing.xxl, gap: spacing.sm },
    emptyText: { fontSize: 14, color: colors.textSecondary },
  });
}
