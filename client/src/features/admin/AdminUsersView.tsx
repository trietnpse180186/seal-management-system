import { useOutletContext } from "react-router-dom";
import { UsersTab } from './UsersTab';

export default function AdminUsersView() {
  const { readOnly = false, roles = [] } = useOutletContext<{ readOnly?: boolean; roles?: any[] }>();
  const token = localStorage.getItem('token');
  return (
    <div className="space-y-6">
      <UsersTab token={token} readOnly={readOnly} roles={roles} />
    </div>
  );
}
