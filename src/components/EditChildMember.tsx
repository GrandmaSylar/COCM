import { AddChildMember } from './AddChildMember';
import type { ChildMember } from './Children';

interface EditChildMemberProps {
  child: ChildMember;
  onBack: () => void;
  onSave: (child: ChildMember) => Promise<void>;
}

export function EditChildMember({ child, onBack, onSave }: EditChildMemberProps) {
  return (
    <AddChildMember
      onBack={onBack}
      initialData={child}
      onSave={async (data) => {
        await onSave({ ...data, id: child.id, joinDate: child.joinDate } as ChildMember);
      }}
    />
  );
}
