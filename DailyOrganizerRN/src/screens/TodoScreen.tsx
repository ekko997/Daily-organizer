import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, SafeAreaView, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useEvents } from '../utils/EventsContext';
import { useAuth } from '../utils/AuthContext';
import { useFamily } from '../utils/FamilyContext';
import { TodoItem } from '../models/Todo';
import { subscribeToTodos, upsertTodo, toggleTodo, deleteTodo } from '../services/cloudTodoService';
import { spacing, radii, typography, ThemeColors } from '../utils/theme';
import { useTheme } from '../utils/ThemeContext';
import { useToast } from '../utils/ToastContext';
import { haptics } from '../utils/haptics';
import { capitalizeFirst } from '../utils/textUtils';
import SwipeableRow from '../components/SwipeableRow';

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

  useEffect(() => {
    if (!user) return;
    const unsubscribe = subscribeToTodos(user.uid, family?.id ?? null, setTodos);
    return unsubscribe;
  }, [user?.uid, family?.id]);

  const visibleTodos = todos
    .filter(t => t.scope === activeScope)
    .sort((a, b) => Number(a.done) - Number(b.done) || a.createdAt.localeCompare(b.createdAt));

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

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={90}>
        <Text style={styles.header}>To-Do</Text>

        {family ? (
          <View style={styles.scopeWrapper}>
            <Pressable style={styles.scopeButton} onPress={() => setScopeDropdownOpen(!scopeDropdownOpen)}>
              <Ionicons name={activeScope === 'family' ? 'people' : 'person'} size={16} color={colors.accent} />
              <Text style={styles.scopeButtonText}>{activeScope === 'family' ? (family?.name || 'Family') : 'Personal'}</Text>
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
          <Pressable style={styles.addButton} accessibilityLabel="Add to-do item" accessibilityRole="button" onPress={handleAdd}>
            <Ionicons name="add" size={20} color={colors.white} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl }}>
          {visibleTodos.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="checkmark-done-outline" size={32} color={colors.textSecondary} />
              <Text style={styles.emptyText}>Nothing on the list</Text>
            </View>
          ) : (
            visibleTodos.map(todo => (
              <SwipeableRow key={todo.id} onDelete={() => handleDelete(todo)} style={{ marginBottom: spacing.sm }}>
                <Pressable style={styles.todoRow} onPress={() => handleToggle(todo)}>
                  <Ionicons
                    name={todo.done ? 'checkbox' : 'square-outline'}
                    size={22}
                    color={todo.done ? colors.accent : colors.textSecondary}
                  />
                  <Text style={[styles.todoText, todo.done && styles.todoTextDone]}>{todo.text}</Text>
                </Pressable>
              </SwipeableRow>
            ))
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { ...typography.screenTitle, paddingHorizontal: spacing.xl, paddingTop: spacing.md, color: colors.textPrimary },
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
    todoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radii.sm, padding: spacing.md },
    todoText: { flex: 1, fontSize: 14, color: colors.textPrimary },
    todoTextDone: { textDecorationLine: 'line-through', color: colors.textSecondary },
    emptyState: { alignItems: 'center', paddingVertical: spacing.xxl, gap: spacing.sm },
    emptyText: { fontSize: 14, color: colors.textSecondary },
  });
}
