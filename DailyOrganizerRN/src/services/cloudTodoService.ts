import { collection, query, where, onSnapshot, doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { TodoItem } from '../models/Todo';

export function subscribeToTodos(
  uid: string,
  familyId: string | null,
  onChange: (todos: TodoItem[]) => void
): () => void {
  let personal: TodoItem[] = [];
  let family: TodoItem[] = [];

  function emit() {
    onChange([...personal, ...family]);
  }

  const personalQuery = query(collection(db, 'todos'), where('ownerId', '==', uid), where('scope', '==', 'personal'));
  const unsubPersonal = onSnapshot(personalQuery, snap => {
    personal = snap.docs.map(d => d.data() as TodoItem);
    emit();
  });

  let unsubFamily = () => {};
  if (familyId) {
    const familyQuery = query(collection(db, 'todos'), where('familyId', '==', familyId), where('scope', '==', 'family'));
    unsubFamily = onSnapshot(familyQuery, snap => {
      family = snap.docs.map(d => d.data() as TodoItem);
      emit();
    });
  }

  return () => {
    unsubPersonal();
    unsubFamily();
  };
}

export async function upsertTodo(todo: TodoItem): Promise<void> {
  await setDoc(doc(db, 'todos', todo.id), todo);
}

export async function toggleTodo(id: string, done: boolean): Promise<void> {
  await updateDoc(doc(db, 'todos', id), { done });
}

export async function deleteTodo(id: string): Promise<void> {
  await deleteDoc(doc(db, 'todos', id));
}
