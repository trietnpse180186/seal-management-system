import { UsersTab } from './UsersTab';

export default function AdminUsersView() {
  const token = localStorage.getItem('token');
  return (
    <div className="space-y-6">
      <UsersTab token={token} />
    </div>
  );
}
