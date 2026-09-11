import React from "react";
import { useApp } from "../context/AppContext";
import { UsersList } from "../components/organisms/UsersList";

export const UsersPage: React.FC = () => {
  const { users, isUsersLoading, handleUpdateUser, handleCreateAdmin } = useApp();

  return (
    <UsersList
      users={users}
      isLoading={isUsersLoading}
      onUpdateUser={handleUpdateUser}
      onCreateAdmin={handleCreateAdmin}
    />
  );
};
