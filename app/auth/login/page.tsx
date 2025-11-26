"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Import the alert components
import SuccessAlert from "@/components/SuccessAlert"; // comp-271
import ErrorAlert from "@/components/ErrorAlert"; // comp-269
import PasswordAlert from "@/components/PasswordAlert"; // comp-277

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<"success" | "error" | "password" | null>(
    null
  );

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setAlert(null);

    try {
      const res = await fetch("http://100.126.246.124:8060/items/user");
      const json = await res.json();
      const users = json.data;

      const user = users.find(
        (u: any) => u.user_email === email && Number(u.user_department) === 2
      );

      if (!user) {
        setAlert("error"); // User not found or not HR
        setLoading(false);
        return;
      }

      if (user.user_password !== password) {
        setAlert("password"); // Wrong password
        setLoading(false);
        return;
      }

      // Successful login
      localStorage.setItem("user", JSON.stringify(user));
      setAlert("success");

      setTimeout(() => router.push("/dashboard"), 1000); // redirect after 1s
    } catch (err) {
      console.error(err);
      setAlert("error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-muted/40 px-4 space-y-4">
      {/* Alert section on top of the form */}
      {alert === "success" && <SuccessAlert />}
      {alert === "error" && <ErrorAlert />}
      {alert === "password" && <PasswordAlert />}

      <div className="w-full max-w-md rounded-xl border bg-background p-8 shadow-sm space-y-4">
        <div className="flex flex-col items-center gap-2 mb-2">
          <h1 className="text-xl font-semibold">Welcome back</h1>
          <p className="text-sm text-muted-foreground text-center">
            Enter your credentials to login to your account.
          </p>
        </div>

        <form className="space-y-5" onSubmit={handleLogin}>
          <div className="space-y-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                placeholder="hi@yourcompany.com"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                placeholder="Enter your password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <Button className="w-full" type="submit" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </Button>
        </form>
      </div>
    </div>
  );
}
