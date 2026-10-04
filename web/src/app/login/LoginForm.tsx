"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { createClient } from "@/lib/supabase/client";

export function LoginForm({ next, notice }: { next: string; notice: string | null }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(notice);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    const { error } = await createClient().auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setPending(false);
      setError(
        error.status === 429
          ? "Too many attempts. Please wait a minute and try again."
          : error.status === 400
            ? "That email and password don't match."
            : "We couldn't sign you in. Please try again.",
      );
      return;
    }
    router.replace(next);
    router.refresh();
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Email">
        <Input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Field label="Password">
        <Input
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </Field>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        Sign in
      </Button>
    </form>
  );
}
