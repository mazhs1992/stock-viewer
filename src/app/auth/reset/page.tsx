import { ResetForm } from "./reset-form";

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold">Νέος κωδικός</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Εισάγετε τον νέο σας κωδικό
          </p>
        </div>
        <ResetForm />
      </div>
    </div>
  );
}
