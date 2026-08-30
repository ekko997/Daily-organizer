export interface TodoItem {
  id: string;
  text: string;
  done: boolean;
  scope: 'personal' | 'family';
  ownerId: string;
  familyId: string | null;
  createdAt: string;
  lastModifiedBy?: string;
}
