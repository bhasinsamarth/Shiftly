import React from "react";
import ResetPasswordForm from "./ResetPasswordPage";

export default function ResetPasswordPage() {
  return (
    <div className="min-h-[calc(100vh-12rem)] flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md">
        <ResetPasswordForm />
      </div>
    </div>
  );
}
