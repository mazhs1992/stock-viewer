import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const { error, message } = await searchParams;

  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            <span className="text-primary">Stock</span> Viewer
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Συνδεθείτε για να συνεχίσετε
          </p>
        </div>

        {error && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}
        {message && (
          <div className="rounded-md border border-border bg-muted px-4 py-3 text-sm">
            {message}
          </div>
        )}

        <LoginForm />
      </div>
    </div>
  );
}
