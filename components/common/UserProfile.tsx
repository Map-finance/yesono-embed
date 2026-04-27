import React from "react";

interface UserProfileProps {
  userId?: string | number;
  displayName?: string;
  children?: React.ReactNode;
  className?: string;
}

export const UserProfile: React.FC<UserProfileProps> = ({
  children,
  className = "",
}) => {
  return <span className={className}>{children}</span>;
};

export default UserProfile;
