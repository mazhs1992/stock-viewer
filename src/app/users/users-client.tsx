"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  inviteUser,
  revokeInvite,
  changeRole,
  toggleActive,
  sendPasswordReset,
} from "./actions";

type Profile = {
  user_id: string;
  email: string;
  role: string;
  active: boolean;
};

type Invite = {
  email: string;
  role: string;
  created_at: string;
  accepted_at: string | null;
};

export function UsersClient({
  profiles,
  invites,
  currentUserId,
}: {
  profiles: Profile[];
  invites: Invite[];
  currentUserId: string;
}) {
  const pendingInvites = invites.filter((i) => !i.accepted_at);

  return (
    <>
      {/* Active users */}
      <section>
        <h2 className="mb-3 text-base font-medium">Χρήστες</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Ρόλος</TableHead>
              <TableHead>Κατάσταση</TableHead>
              <TableHead>Ενέργειες</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {profiles.map((p) => (
              <TableRow key={p.user_id}>
                <TableCell className="font-mono text-sm">{p.email}</TableCell>
                <TableCell>
                  <Badge variant={p.role === "admin" ? "default" : "secondary"}>
                    {p.role}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={p.active ? "outline" : "destructive"}>
                    {p.active ? "Ενεργός" : "Ανενεργός"}
                  </Badge>
                </TableCell>
                <TableCell>
                  {p.user_id !== currentUserId && (
                    <div className="flex gap-1">
                      <form action={changeRole}>
                        <input type="hidden" name="user_id" value={p.user_id} />
                        <input
                          type="hidden"
                          name="role"
                          value={p.role === "admin" ? "member" : "admin"}
                        />
                        <Button variant="ghost" size="xs">
                          {p.role === "admin"
                            ? "Υποβίβαση"
                            : "Προαγωγή"}
                        </Button>
                      </form>
                      <form action={toggleActive}>
                        <input type="hidden" name="user_id" value={p.user_id} />
                        <input
                          type="hidden"
                          name="active"
                          value={String(p.active)}
                        />
                        <Button variant="ghost" size="xs">
                          {p.active ? "Απενεργοποίηση" : "Ενεργοποίηση"}
                        </Button>
                      </form>
                      <form action={sendPasswordReset}>
                        <input type="hidden" name="email" value={p.email} />
                        <Button variant="ghost" size="xs">
                          Reset κωδικού
                        </Button>
                      </form>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      {/* Pending invites */}
      <section>
        <h2 className="mb-3 text-base font-medium">Εκκρεμείς προσκλήσεις</h2>
        {pendingInvites.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Δεν υπάρχουν εκκρεμείς προσκλήσεις.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Ρόλος</TableHead>
                <TableHead>Ημερομηνία</TableHead>
                <TableHead>Ενέργειες</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendingInvites.map((i) => (
                <TableRow key={i.email}>
                  <TableCell className="font-mono text-sm">{i.email}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{i.role}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(i.created_at).toLocaleDateString("el-GR")}
                  </TableCell>
                  <TableCell>
                    <form action={revokeInvite}>
                      <input type="hidden" name="email" value={i.email} />
                      <Button variant="ghost" size="xs">
                        Ανάκληση
                      </Button>
                    </form>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      {/* Add invite */}
      <section>
        <h2 className="mb-3 text-base font-medium">Νέα πρόσκληση</h2>
        <form action={inviteUser} className="flex items-end gap-2">
          <div className="flex-1">
            <Input name="email" type="email" required placeholder="email@example.com" />
          </div>
          <select
            name="role"
            defaultValue="member"
            className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
          >
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
          <Button type="submit" size="sm">
            Πρόσκληση
          </Button>
        </form>
      </section>
    </>
  );
}
